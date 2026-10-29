import { describe, expect, it, vi } from 'vitest'
import { buildChatRequest, adaptEvent } from '../src/api/protocol'
import { streamChat } from '../src/api/holmes'

const final = 'event: ai_answer_end\ndata: {"analysis":"完成","conversation_history":[{"role":"system","content":"s"},{"role":"assistant","content":"完成"}]}\n\n'
function response(body: string, type = 'text/event-stream') {
  return new Response(body, { headers: { 'Content-Type': type } })
}
const options = { url: '/api/chat', connectTimeoutMs: 1000, idleTimeoutMs: 1000 }

describe('真实 HolmesGPT 协议适配', () => {
  it('首轮不伪造历史和模型，后续保留完整工具历史', () => {
    expect(buildChatRequest('你好', [], { model: '', additionalSystemPrompt: '' })).toEqual({ ask: '你好', stream: true })
    const history = [{ role: 'system', content: 's' }, { role: 'tool', tool_call_id: '1', content: 'ok' }]
    expect(buildChatRequest('继续', history, { model: 'my-alias' })).toEqual({ ask: '继续', stream: true, model: 'my-alias', conversation_history: history })
  })
  it('校验已知事件，保留未知事件，拒绝错误 JSON 与伪完成标记', () => {
    expect(adaptEvent({ event: 'ai_message', data: '{"content":"阶段"}', id: '' })).toEqual({ kind: 'message', content: '阶段' })
    expect(adaptEvent({ event: 'future', data: '{}', id: '' })).toEqual({ kind: 'unknown', event: 'future' })
    expect(() => adaptEvent({ event: 'ai_message', data: '{', id: '' })).toThrow('JSON')
    expect(() => adaptEvent({ event: 'message', data: '[DONE]', id: '' })).toThrow('结束')
    expect(() => adaptEvent({ event: 'ai_answer_end', data: '{"analysis":"","conversation_history":[]}', id: '' })).toThrow('空')
  })
  it('在响应结束前派发阶段消息，最终响应只消费一次', async () => {
    let writer!: ReadableStreamDefaultController<Uint8Array>
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({ start(c) { writer = c } })
    const events: string[] = []
    let notify!: () => void
    const early = new Promise<void>(resolve => { notify = resolve })
    const fetcher = vi.fn(async () => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }))
    const pending = streamChat({ ask: 'hi', stream: true }, { ...options, fetcher, onEvent(e) { events.push(e.kind); if (e.kind === 'message') notify() } })
    writer.enqueue(encoder.encode('event: ai_message\ndata: {"content":"正在分析"}\n\n'))
    await early
    expect(events).toEqual(['message'])
    writer.enqueue(encoder.encode(final))
    await pending
    expect(events).toEqual(['message', 'final'])
  })
  it('处理 HTTP 错误、非 SSE、空响应、断流和流内错误', async () => {
    for (const [res, message] of [
      [new Response('denied', { status: 401 }), '401'],
      [response('{"analysis":"x"}', 'application/json'), '流式'],
      [response(''), '结束'],
      [response('event: ai_message\ndata: {"content":"半截"}\n\n'), '结束'],
      [response('event: error\ndata: {"msg":"模型不可用"}\n\n'), '模型不可用'],
      [response('event: approval_required\ndata: {}\n\n'), '审批'],
    ] as const) {
      await expect(streamChat({ ask: 'hi', stream: true }, { ...options, fetcher: async () => res, onEvent() {} })).rejects.toThrow(message)
    }
  })
  it('连接超时、流空闲超时与外部取消都能终止请求', async () => {
    const hanging: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })
    await expect(streamChat({ ask: 'hi', stream: true }, { ...options, connectTimeoutMs: 10, fetcher: hanging, onEvent() {} })).rejects.toThrow('超时')
    const controller = new AbortController()
    const pending = streamChat({ ask: 'hi', stream: true }, { ...options, signal: controller.signal, fetcher: hanging, onEvent() {} })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true } })
    await expect(streamChat({ ask: 'hi', stream: true }, { ...options, idleTimeoutMs: 10, fetcher: async () => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }), onEvent() {} })).rejects.toThrow('超时')
    expect(cancelled).toBe(true)
  })
})
