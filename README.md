# SRE-Copilot AI 运维助手

Vue 3 + Vite + TypeScript + Pinia + Element Plus，中文 ChatGPT 风格界面。
在现有项目骨架上实现，浏览器仅使用原生 fetch + ReadableStream 对接 HTTP API，无 WebSocket、EventSource 或伪造的打字效果。

## 启动与构建

需要 Node.js >= 22.12、npm。所有命令在本项目目录执行。

```sh
npm ci
npm run dev
# 默认 http://localhost:5173
npm run typecheck
npm test
npm run build
npm run preview
```

生产文件位于 `dist/`。`preview` 只用于本地检查静态文件，不提供开发代理，不作为生产服务器。
依赖已锁定在 `package-lock.json`，CI/部署用 `npm ci`。

## 配置

| 配置 | 用途 | 默认 |
| --- | --- | --- |
| `VITE_HOLMES_API_URL` | 浏览器请求地址 | `/api/chat` |
| `VITE_HOLMES_MODEL` | 后端实际配置的模型名称或别名；为空时不发送 model | 空 |
| `VITE_HOLMES_SYSTEM_PROMPT` | 可选 additional_system_prompt，公开提示词 | 空 |
| `VITE_CONNECT_TIMEOUT_MS` | 收到响应头前的超时 | 15000 |
| `VITE_STREAM_IDLE_TIMEOUT_MS` | 收不到任何网络块的空闲超时；心跳也重置计时 | 120000 |
| `HOLMES_PROXY_TARGET` | 仅 Vite 开发服务器使用的上游地址 | `http://172.16.119.92:30395` |

`.env.development` 和 `.env.production` 已提供；本机覆盖写入被 Git 忽略的 `.env.development.local` 或 `.env.production.local`。
旧骨架的 `VITE_API_BASE_URL` / `VITE_CHAT_PATH` 已移除，统一使用 `VITE_HOLMES_API_URL`。
VITE 配置在构建时嵌入静态文件，修改后需要重新构建。不要把 API key、令牌或任何敏感信息放入 VITE 变量。
模型必须使用目标 HolmesGPT 配置中存在的值；不自动假定 OpenAI 模型名与服务端别名相同。

## 已核实的真实 API 协议

核对日期：2026-10-26。目标接口：`http://172.16.119.92:30395/api/chat`。

1. 已读取目标 `/openapi.json`：ChatRequest 的必填字段为 `ask`；支持 `stream`、`conversation_history`、`model`、`additional_system_prompt` 等字段。
2. 真实 POST 的 HTTP 状态为 200，Content-Type 为 `text/event-stream; charset=utf-8`，传输为 chunked。
3. 两轮无工具问候测试中观察到 `token_count` 和 `ai_answer_end` 事件。最终事件包含 `analysis`、`conversation_history`、`follow_up_actions`、`metadata`；首轮历史为 system/user/assistant，第二轮扩展至五条消息并正确复述上文。
4. 已通过本项目 `streamChat` 再执行两轮真实后端验收，确认原生流读取、事件解析和服务端历史回传可用。
5. **这些样本没有逐 token 最终答案增量。** 页面实时显示已经收到的阶段消息和工具状态，收到 `ai_answer_end.analysis` 时立即展示最终答案；不会先等待整个 HTTP 响应结束，但不能提前展示服务端尚未发送的文字。若需要逐字生成最终答案，应由后端增加并明确约定文本增量事件，再在 `api/protocol.ts` 适配，不能通过前端动画模拟。
6. 工具调用、审批、真实中断、代理生产链路、跨域与实际认证场景未做线上验证。相关异常、阶段事件及取消路径使用本地契约测试验证。目标 OpenAPI 的 200 响应 Schema 为空，事件字段同时参考官方文档与实际样本，不能仅凭 OpenAPI 推断。

请求示例（首轮不自行伪造 system 提示）：

```json
{ "ask": "如何排查服务延迟？", "stream": true }
```

后续请求将服务端返回的 `conversation_history` **完整原样传回**，保留 system、tool、tool_calls 等字段，不能用页面展示消息重建历史。
重新生成最后一轮时使用该轮之前的上下文快照，不重复增加 user 消息。
审批型工具暂停会显示明确错误，当前界面不提供工具审批，也不自动批准操作；未发送 frontend_tools 或伪造审批参数。

协议依据：

- [HolmesGPT 官方 HTTP API](https://holmesgpt.dev/latest/reference/http-api/)
- [官方流格式化实现](https://github.com/HolmesGPT/holmesgpt/blob/master/holmes/utils/stream.py)
- [官方数据模型](https://github.com/HolmesGPT/holmesgpt/blob/master/holmes/core/models.py)

## 流式处理与错误边界

- `api/sse.ts` 负责传输层：TextDecoder 流式解码 UTF-8，保留跨网络块的行和事件，支持 LF/CRLF/CR、SSE 多行 data、注释与事件 ID。
- 只有接收到完整 SSE 事件才执行 JSON.parse，因此 JSON 跨块不会被截断解析。
- `api/protocol.ts` 负责版本相关字段校验；阶段消息单独显示，不能按 token 增量拼接；reasoning 不默认展示。
- 收到最终事件立即更新 UI 并结束读取；EOF、空响应和 `[DONE]` 本身不能代替 HolmesGPT 最终事件。无最终答案会报告中断。
- 若服务端忽略 stream、返回 JSON 或其他协议，显示“不支持的流式协议”，不会等待整包后伪造流式效果。需要在协议模块按实际部署改造；若后端确实不支持流式，只能升级后端或明确提供非流式模式。
- fetch 使用 AbortController，停止、切换、删除、清空会话和组件卸载都会取消请求。请求身份校验阻止迟到响应污染状态。
- 单个页面同时只允许一个请求；连接超时与流空闲超时分别管理。非 2xx 显示状态码；网络中断与流内 error 显示可重试错误；不自动重发 POST。
- 未完成的一轮保留问题和已到达的阶段内容，需先重试/重新生成或清空再继续，避免显示历史与模型上下文错位。

## 界面与安全

- 可折叠会话侧栏、多个独立会话、新建/删除/清空、重新生成、停止生成和错误提示。
- 会话保存在 Pinia **内存**，刷新后清除；没有伪装成持久化服务。没有将运维日志、服务端 system 提示或工具结果写入 localStorage。
- Enter 发送，Shift+Enter 换行，处理中文输入法组合输入；长输入框可滚动。
- Markdown 表格、列表、引用、代码高亮与复制；只在用户位于消息区底部时跟随滚动，手动上翻后显示“回到最新消息”。
- 用户消息通过 Vue 文本插值展示。模型输出关闭原始 HTML，语法高亮后通过 DOMPurify 净化，v-html 只消费净化结果；代码内容与语言标签转义。
- 远程图片显示为文本占位，不自动加载；不执行模型返回的代码或工具指令。剪贴板需要 HTTPS 或 localhost 及浏览器权限。
- 前端不保存/硬编码上游密钥。生产请求使用 same-origin 凭据，认证由网关会话或 SSO 提供。

## 开发 CORS 与网络可达性

推荐方式：浏览器使用 `/api/chat`，Vite 原样代理到 `HOLMES_PROXY_TARGET`，开发机必须能够访问内网 IP。
生产构建不会保留 Vite 代理逻辑。

可选方式：将 `VITE_HOLMES_API_URL` 设置为完整后端 URL，并由后端/网关配置允许的具体前端 Origin、POST、实际请求头及 OPTIONS 预检。
不要用 `no-cors`：opaque 响应无法读取流。当前默认不发送跨站 cookie，若采用跨域 cookie 认证，须同步调整 fetch 凭据策略、明确 Origin 与 CSRF 防护。
HTTPS 前端不能直接请求 HTTP 内网地址，应使用 HTTPS 同源反向代理。

## 生产部署

1. 在有网络依赖源的构建机执行 `npm ci && npm run typecheck && npm test && npm run build`。
2. 将 `dist/` 的内容部署至 Nginx 的 `/usr/share/nginx/html/`，使用 `deploy/nginx.conf` 示例，替换域名、证书路径与静态目录。
3. Nginx 所在服务器须能访问 `172.16.119.92:30395`。浏览器无需访问该内网 IP，只连接 HTTPS 站点。
4. 在暴露站点前接入现有企业 SSO、auth_request 或受控 VPN 访问边界。示例是代理配置，不包含认证系统，不能直接作为公共匿名运维入口。采用 cookie 认证时，网关应验证 Origin/CSRF，并对接口做用户鉴权与审计。
5. 如 HolmesGPT 启用 HOLMES_API_KEY，在服务器私有 include 中注入 X-API-Key 或 Bearer，替换示例中剥离上游鉴权头的两行；密钥文件不进仓库。不要以浏览器传来的任意头作为上游可信凭据。
6. 执行 `nginx -t` 后按部署平台重载 Nginx，并从真实 HTTPS 域名验证发送、停止、多轮、认证失败与长响应。示例已关闭代理缓冲、缓存和 SSE 压缩，读取超时为 180 秒；如前面还有网关/负载均衡，也须关闭流缓冲并匹配超时。

Nginx 配置附带 CSP、nosniff、Referrer-Policy 与 frame 限制。应用通过 Element Plus 动态样式，需要 style-src 的 unsafe-inline；脚本仍限制为 self。
本机未安装 Nginx，未执行 nginx -t 或真实生产发布；证书、SSO、生产网关与长耗时模型须在目标环境验收。

## 测试

```sh
npm test                     # 单元/契约测试；真实后端测试默认跳过
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e             # 自动启动本机 Mock HTTP 流服务与 Vite
# 如本机已有 Chrome：
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
# 显式访问内网后端，两轮无工具问候（消耗模型调用）：
HOLMES_LIVE_API=http://172.16.119.92:30395/api/chat npm test -- tests/live-api.test.ts
```

已执行：15 项单元/契约测试、3 项 Chrome 浏览器测试、1 项真实后端两轮验收、TypeScript 检查与生产构建，均通过。
浏览器测试覆盖实时阶段事件、Markdown/XSS、代码复制、多轮/重生成/清空、错误重试、停止、侧栏与移动端输入法。
浏览器测试基于本地模拟协议，不能替代真实后端验收；截图保存在被 Git 忽略的 `test-results/`。

## 目录

```text
holmes-chat-web/
├── src/
│   ├── api/                 # holmes.ts 请求生命周期、protocol.ts 协议适配、sse.ts 解析
│   ├── components/chat/     # 会话侧栏、消息列表、单轮消息、Markdown、输入框
│   ├── config/              # 环境配置集中管理
│   ├── stores/              # Pinia 会话和请求状态
│   ├── types/               # 可扩展 API interface 与前端状态类型
│   ├── utils/               # Markdown、高亮与 HTML 净化
│   ├── views/               # ChatView 页面编排
│   ├── styles/              # 响应式布局
│   ├── App.vue
│   └── main.ts
├── tests/                   # SSE、协议、超时、状态、安全和可选真实接口测试
├── e2e/                     # 浏览器测试与本机流式 Mock
├── deploy/nginx.conf
├── .env.development
├── .env.production
├── .env.example
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── package.json
└── package-lock.json
```
