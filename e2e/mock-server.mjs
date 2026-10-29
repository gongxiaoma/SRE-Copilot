// 只用于浏览器契约测试，不冒充真实后端协议验证。
import http from 'node:http'
http.createServer(async (req, res) => {
  if (req.url !== '/api/chat') { res.writeHead(404).end(); return }
  let input = ''
  for await (const chunk of req) input += chunk
  const body = JSON.parse(input)
  if (body.ask === 'HTTP失败') { res.writeHead(503).end(); return }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  send('ai_message', { content: '正在检查测试数据。' })
  const timer = setTimeout(() => {
    if (body.ask === '连接中断') { res.end(); return }
    const analysis = '## 排查结果\n\n| 项目 | 状态 |\n| --- | --- |\n| 服务 | 正常 |\n\n> 请先核实环境。\n\n- 检查日志\n- 检查指标\n\n```bash\nkubectl get pods\n```\n\n<img src=x onerror=alert(1)>\n\n完成：' + body.ask
    send('ai_answer_end', { analysis, conversation_history: [...(body.conversation_history || [{ role: 'system', content: '测试系统提示' }]), { role: 'user', content: body.ask }, { role: 'assistant', content: analysis }] })
    res.end()
  }, 900)
  res.on('close', () => clearTimeout(timer))
}).listen(5179, '127.0.0.1')
