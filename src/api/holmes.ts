import type { HolmesChatRequest } from '../types/holmes'
import { adaptEvent, type ChatEvent } from './protocol'
import { parseSse } from './sse'

export interface StreamChatOptions {
  url: string
  connectTimeoutMs: number
  idleTimeoutMs: number
  signal?: AbortSignal
  onEvent: (event: ChatEvent) => void
  fetcher?: typeof fetch
}

/** fetch + ReadableStream 原生读取；不缓冲整个响应、不自动重试 POST。 */
export async function streamChat(request: HolmesChatRequest, options: StreamChatOptions): Promise<void> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timeoutError: Error | undefined
  const abort = () => {
    controller.abort(options.signal?.reason)
    void reader?.cancel().catch(() => {})
  }
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) abort()
  const arm = (ms: number, label: string) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      timeoutError = new Error(label)
      controller.abort(timeoutError)
      void reader?.cancel().catch(() => {})
    }, ms)
  }
  const check = () => {
    if (timeoutError) throw timeoutError
    controller.signal.throwIfAborted()
  }
  arm(options.connectTimeoutMs, '连接超时，请检查网络或代理配置')
  try {
    check()
    const response = await (options.fetcher ?? fetch)(options.url, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(request), signal: controller.signal,
    })
    check()
    clearTimeout(timer)
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(`请求失败（HTTP ${response.status}）${response.status === 401 || response.status === 403 ? '，请检查网关认证与权限' : '，请检查后端服务'}`)
    }
    const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? ''
    if (contentType.split(';')[0]?.trim() !== 'text/event-stream') {
      await response.body?.cancel()
      throw new Error(`接口未返回支持的流式协议（${contentType || '缺少 Content-Type'}）。请检查后端 stream 支持与代理配置`)
    }
    if (!response.body) throw new Error('服务端未返回响应流')
    reader = response.body.getReader()
    arm(options.idleTimeoutMs, '响应流空闲超时，请重试')
    // 逐次读取原始网络块；空闲计时随每个字节块重置（包含 SSE 心跳）。
    const body = new ReadableStream<Uint8Array>({
      async pull(target) {
        try {
          check()
          const { done, value } = await reader!.read()
          check()
          if (done) target.close()
          else { arm(options.idleTimeoutMs, '响应流空闲超时，请重试'); target.enqueue(value) }
        } catch (error) { target.error(error) }
      },
      async cancel() { await reader?.cancel() },
    }, { highWaterMark: 0 })
    for await (const raw of parseSse(body)) {
      check()
      const event = adaptEvent(raw)
      options.onEvent(event)
      if (event.kind === 'final') return
    }
    check()
    throw new Error('响应流结束但没有最终答案，连接可能中断或响应为空')
  } catch (error) {
    if (timeoutError) throw timeoutError
    if (controller.signal.aborted) throw controller.signal.reason ?? new DOMException('请求已停止', 'AbortError')
    if (error instanceof TypeError) throw new Error('网络连接失败或中断，请检查网络、CORS 和代理配置')
    throw error
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
    try { await reader?.cancel() } catch { /* 网络错误已经在上层报告。 */ }
    reader?.releaseLock()
  }
}
