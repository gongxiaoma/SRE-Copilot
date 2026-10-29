import type { HolmesConversationMessage } from './holmes'
export type ChatStatus = 'connecting' | 'streaming' | 'completed' | 'stopped' | 'error'
/** 一轮对话保留请求前历史快照，重新生成时不会重复发送当前用户消息。 */
export interface ChatTurn {
  id: string
  ask: string
  answer: string
  stages: string[]
  progress: string
  status: ChatStatus
  error?: string
  historyBefore: HolmesConversationMessage[]
}
export interface Conversation {
  id: string
  title: string
  history: HolmesConversationMessage[]
  turns: ChatTurn[]
}
