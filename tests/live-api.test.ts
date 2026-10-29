import { describe, expect, it } from 'vitest'
import { streamChat } from '../src/api/holmes'
import { buildChatRequest } from '../src/api/protocol'
import type { HolmesConversationMessage } from '../src/types/holmes'

// 默认不访问内网、不消耗模型。只有显式设置地址才执行真实后端验收。
describe.skipIf(!process.env.HOLMES_LIVE_API)('真实后端协议验收', () => {
  it('原生 fetch 流读取与服务端历史支持两轮对话', async () => {
    let history: HolmesConversationMessage[] = []
    const kinds: string[] = []
    for (const ask of ['请只回复你好。不调用任何工具，不访问集群。', '只复述上一轮你回复的内容，不调用任何工具。']) {
      let answer = ''
      await streamChat(buildChatRequest(ask, history, {}), {
        url: process.env.HOLMES_LIVE_API!, connectTimeoutMs: 10_000, idleTimeoutMs: 30_000,
        onEvent(event) {
          kinds.push(event.kind)
          if (event.kind === 'final') { history = event.history; answer = event.text }
        },
      })
      expect(answer.trim().length).toBeGreaterThan(0)
      expect(history[0]?.role).toBe('system')
    }
    expect(history.filter(item => item.role === 'user')).toHaveLength(2)
    console.info('已验证两轮真实响应；事件种类：', [...new Set(kinds)].join(', '))
  }, 90_000)
})
