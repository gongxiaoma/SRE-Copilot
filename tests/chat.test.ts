import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { streamChat } from '../src/api/holmes'
import { useChatStore } from '../src/stores/chat'
vi.mock('../src/api/holmes', () => ({ streamChat: vi.fn() }))
const history = [{ role: 'system', content: 's' }, { role: 'assistant', content: '完成' }]
beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
describe('会话生命周期', () => {
  it('保留后端历史，重新生成使用该轮之前的快照且不重复用户消息', async () => {
    vi.mocked(streamChat).mockImplementation(async (_request, options) => { options.onEvent({ kind: 'final', text: '完成', history }) })
    const chat = useChatStore()
    await chat.send('第一轮')
    await chat.send('第二轮')
    expect(vi.mocked(streamChat).mock.calls[1]![0].conversation_history).toEqual(history)
    await chat.regenerate()
    expect(chat.current!.turns).toHaveLength(2)
    expect(vi.mocked(streamChat).mock.calls[2]![0].conversation_history).toEqual(history)
    expect(chat.current!.turns[1]!.status).toBe('completed')
  })
  it('防止并发提交，清空后拒绝迟到事件', async () => {
    let finish!: () => void
    let callback!: Parameters<typeof streamChat>[1]['onEvent']
    vi.mocked(streamChat).mockImplementation(async (_request, options) => { callback = options.onEvent; await new Promise<void>(resolve => { finish = resolve }) })
    const chat = useChatStore()
    const pending = chat.send('问题')
    await chat.send('重复')
    expect(streamChat).toHaveBeenCalledTimes(1)
    chat.clearCurrent()
    callback({ kind: 'final', text: '迟到', history })
    finish(); await pending
    expect(chat.current!.turns).toHaveLength(0)
    expect(chat.busy).toBe(false)
  })
  it('切换会话停止生成；失败保留问题，可重新生成', async () => {
    vi.mocked(streamChat).mockRejectedValue(new Error('断开'))
    const chat = useChatStore()
    await chat.send('问题')
    expect(chat.current!.turns[0]!.error).toBe('断开')
    const old = chat.current!.id
    chat.newConversation()
    expect(chat.current!.turns).toHaveLength(0)
    chat.select(old)
    expect(chat.current!.turns[0]!.ask).toBe('问题')
  })
})
