/** SSE 传输事件；data 保持原文，由协议适配层负责 JSON 解析。 */
export interface SseEvent {
  event: string
  data: string
  id: string
  retry?: number
}

/**
 * 解析 fetch Response.body。支持 UTF-8 分片、LF/CRLF/CR、多行 data 与注释。
 * 按 SSE 规则，仅空行结束的事件会被派发；EOF 丢弃未完成事件。
 * 消费方提前退出时取消 reader；网络取消由 fetch 的 AbortSignal 控制。
 */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let line = ''
  let skipLf = false
  let event = ''
  let data: string[] = []
  let id = ''
  let retry: number | undefined
  let finished = false

  function acceptLine(value: string): SseEvent | undefined {
    if (value === '') {
      const result = data.length ? {
        event: event || 'message', data: data.join('\n'), id,
        ...(retry === undefined ? {} : { retry }),
      } : undefined
      event = ''
      data = []
      retry = undefined
      return result
    }
    if (value.startsWith(':')) return
    const colon = value.indexOf(':')
    const field = colon < 0 ? value : value.slice(0, colon)
    let content = colon < 0 ? '' : value.slice(colon + 1)
    if (content.startsWith(' ')) content = content.slice(1)
    switch (field) {
      case 'event': event = content; break
      case 'data': data.push(content); break
      case 'id': if (!content.includes('\0')) id = content; break
      case 'retry':
        if (/^\d+$/.test(content) && Number.isSafeInteger(Number(content))) retry = Number(content)
        break
    }
  }

  function* consume(text: string): Generator<SseEvent> {
    for (const char of text) {
      if (skipLf) {
        skipLf = false
        if (char === '\n') continue
      }
      if (char === '\r' || char === '\n') {
        skipLf = char === '\r'
        const result = acceptLine(line)
        line = ''
        if (result) yield result
      } else {
        line += char
      }
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        finished = true
        yield* consume(decoder.decode())
        return
      }
      yield* consume(decoder.decode(value, { stream: true }))
    }
  } finally {
    try {
      if (!finished) await reader.cancel()
    } finally {
      reader.releaseLock()
    }
  }
}
