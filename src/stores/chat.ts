import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { appConfig } from '../config'
import { streamChat } from '../api/holmes'
import { buildChatRequest } from '../api/protocol'
import type { ChatTurn, Conversation } from '../types/chat'

export const useChatStore = defineStore('chat', () => {
  const STORAGE_KEY = 'holmes-chat-conversations-v1'
  function restore() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return { conversations: [] as Conversation[], activeId: '' }
      const data = JSON.parse(saved) as { conversations?: Conversation[]; activeId?: string }
      const conversations = Array.isArray(data.conversations) ? data.conversations : []
      return { conversations, activeId: conversations.some(chat => chat.id === data.activeId) ? data.activeId! : conversations[0]?.id ?? '' }
    } catch {
      return { conversations: [] as Conversation[], activeId: '' }
    }
  }
  const savedState = restore()
  const conversations = ref<Conversation[]>(savedState.conversations)
  const activeId = ref(savedState.activeId)
  const busy = ref(false)
  const current = computed(() => conversations.value.find(chat => chat.id === activeId.value))
  let running: { controller: AbortController; turn: ChatTurn } | undefined

  watch([conversations, activeId], () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversations: conversations.value, activeId: activeId.value })) } catch { /* 浏览器存储不可用或空间不足时继续正常使用。 */ }
  }, { deep: true })

  function stop() {
    if (!running) return
    const run = running
    running = undefined
    run.turn.status = 'stopped'
    run.turn.progress = '已停止生成'
    busy.value = false
    run.controller.abort()
  }
  function newConversation() {
    stop()
    const chat: Conversation = { id: crypto.randomUUID(), title: '新对话', history: [], turns: [] }
    conversations.value.unshift(chat)
    activeId.value = chat.id
  }
  function select(id: string) {
    if (id === activeId.value || !conversations.value.some(chat => chat.id === id)) return
    stop()
    activeId.value = id
  }
  function clearCurrent() {
    stop()
    if (!current.value) return
    current.value.turns = []
    current.value.history = []
    current.value.title = '新对话'
  }
  function remove(id: string) {
    if (id === activeId.value) stop()
    conversations.value = conversations.value.filter(chat => chat.id !== id)
    if (!conversations.value.length) newConversation()
    else if (activeId.value === id) activeId.value = conversations.value[0]!.id
  }
  async function execute(chat: Conversation, turn: ChatTurn) {
    const run = { controller: new AbortController(), turn }
    running = run
    busy.value = true
    try {
      await streamChat(buildChatRequest(turn.ask, turn.historyBefore, appConfig), {
        url: appConfig.apiUrl, connectTimeoutMs: appConfig.connectTimeoutMs, idleTimeoutMs: appConfig.idleTimeoutMs,
        signal: run.controller.signal,
        onEvent(event) {
          if (running !== run) return
          if (event.kind === 'message') {
            turn.status = 'streaming'
            if (event.content) turn.stages.push(event.content)
          } else if (event.kind === 'progress') {
            turn.status = 'streaming'
            turn.progress = event.label
          } else if (event.kind === 'final') {
            turn.answer = event.text
            turn.status = 'completed'
            turn.progress = ''
            chat.history = structuredClone(event.history)
          }
        },
      })
    } catch (error) {
      if (running !== run) return
      turn.status = 'error'
      turn.error = error instanceof Error ? error.message : '请求失败，请重试'
    } finally {
      if (running === run) { running = undefined; busy.value = false }
    }
  }
  async function send(input: string) {
    const ask = input.trim()
    if (busy.value || !ask) return
    if (!current.value) newConversation()
    const chat = current.value!
    // 未完成的上一轮须先重试或清空，避免展示历史与后端上下文不一致。
    if (chat.turns.length && chat.turns.at(-1)!.status !== 'completed') return
    if (!chat.turns.length) chat.title = ask.slice(0, 24)
    chat.turns.push({ id: crypto.randomUUID(), ask, answer: '', stages: [], progress: '正在连接 HolmesGPT', status: 'connecting', historyBefore: JSON.parse(JSON.stringify(chat.history)) })
    await execute(chat, chat.turns.at(-1)!)
  }
  async function regenerate() {
    const chat = current.value
    if (busy.value || !chat?.turns.length) return
    const turn = chat.turns.at(-1)!
    turn.answer = ''; turn.stages = []; turn.error = undefined
    turn.status = 'connecting'; turn.progress = '正在重新生成'
    chat.history = JSON.parse(JSON.stringify(turn.historyBefore))
    await execute(chat, turn)
  }
  if (!conversations.value.length) newConversation()
  return { conversations, activeId, current, busy, send, stop, regenerate, newConversation, select, clearCurrent, remove }
})
