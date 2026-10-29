import { describe, expect, it } from 'vitest'
import { parseSse } from '../src/api/sse'

async function toArray<T>(source: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = []
  for await (const value of source) result.push(value)
  return result
}

async function collect(parts: string[] | Uint8Array[]) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(typeof part === 'string' ? encoder.encode(part) : part)
      controller.close()
    },
  })
  return toArray(parseSse(stream))
}

describe('SSE 解析', () => {
  it('支持跨字节 UTF-8、跨分片 CRLF、多行 data 和多个事件', async () => {
    const bytes = new TextEncoder().encode('\uFEFF:heartbeat\r\nevent: ai_message\r\ndata: 你好\r\ndata: 世界\r\n\r\nevent: ai_answer_end\ndata: {}\n\n')
    const events = await collect(Array.from(bytes, byte => Uint8Array.of(byte)))
    expect(events).toEqual([
      { event: 'ai_message', data: '你好\n世界', id: '' },
      { event: 'ai_answer_end', data: '{}', id: '' },
    ])
  })
  it('支持 CR、默认事件、空 data、id 继承和合法 retry', async () => {
    expect(await collect(['id: 7\rretry: 10\rdata:\r\rdata: next\r\r'])).toEqual([
      { event: 'message', data: '', id: '7', retry: 10 },
      { event: 'message', data: 'next', id: '7' },
    ])
  })
  it('忽略注释、未知字段和非法 retry；不派发未完成事件', async () => {
    expect(await collect([': ping\nunknown: x\nretry: -1\nid: a\u0000b\ndata: ok\n\ndata: incomplete'])).toEqual([
      { event: 'message', data: 'ok', id: '' },
    ])
  })
  it('流读取异常向上传递并释放锁', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.error(new Error('连接中断')) } })
    await expect(toArray(parseSse(stream))).rejects.toThrow('连接中断')
    expect(stream.locked).toBe(false)
  })
  it('调用方提前退出时取消读取并释放锁', async () => {
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(new TextEncoder().encode('data: ok\n\n')) },
      cancel() { cancelled = true },
    })
    for await (const event of parseSse(stream)) { expect(event.data).toBe('ok'); break }
    expect(cancelled).toBe(true)
    expect(stream.locked).toBe(false)
  })
})
