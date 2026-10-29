import type { SseEvent } from './sse'
import type { HolmesChatRequest, HolmesConversationMessage } from '../types/holmes'

export interface RequestConfig { model?: string; additionalSystemPrompt?: string }
export type ChatEvent =
  | { kind: 'message'; content: string }
  | { kind: 'final'; text: string; history: HolmesConversationMessage[] }
  | { kind: 'progress'; label: string }
  | { kind: 'unknown'; event: string }

/** 仅发送已经通过目标 OpenAPI 核实的字段，模型为空时使用服务端默认值。 */
export function buildChatRequest(ask: string, history: HolmesConversationMessage[], config: RequestConfig): HolmesChatRequest {
  return {
    ask, stream: true,
    ...(history.length ? { conversation_history: history } : {}),
    ...(config.model ? { model: config.model } : {}),
    ...(config.additionalSystemPrompt ? { additional_system_prompt: config.additionalSystemPrompt } : {}),
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function history(value: unknown): value is HolmesConversationMessage[] {
  return Array.isArray(value) && value.length > 0 && value.every(item => object(item) && typeof item.role === 'string') && value[0]?.role === 'system'
}

/** 唯一的 HolmesGPT 版本适配入口。禁止将阶段消息当作 token 增量累加。 */
export function adaptEvent(event: SseEvent): ChatEvent {
  if (event.data.trim() === '[DONE]') throw new Error('收到结束标记，但缺少 HolmesGPT 最终答案事件')
  let data: unknown
  try { data = JSON.parse(event.data) } catch { throw new Error(`事件 ${event.event} 的 JSON 格式无效`) }
  if (!object(data)) throw new Error(`事件 ${event.event} 的载荷必须是对象`)
  switch (event.event) {
    case 'ai_message':
      if (data.content != null && typeof data.content !== 'string') throw new Error('阶段消息格式无效')
      return { kind: 'message', content: typeof data.content === 'string' ? data.content : '' }
    case 'ai_answer_end':
      if (typeof data.analysis !== 'string' || !data.analysis.trim()) throw new Error('服务端返回空答案')
      if (!history(data.conversation_history)) throw new Error('服务端返回无效的历史上下文')
      return { kind: 'final', text: data.analysis, history: data.conversation_history }
    case 'error':
      throw new Error(typeof data.msg === 'string' ? data.msg : typeof data.description === 'string' ? data.description : '服务端流式处理失败')
    case 'approval_required':
      throw new Error('服务端正在等待工具审批或外部操作，当前界面尚不支持审批，请联系管理员')
    case 'start_tool_calling': return { kind: 'progress', label: `正在调用工具${typeof data.tool_name === 'string' ? '：' + data.tool_name : ''}` }
    case 'tool_calling_result': return { kind: 'progress', label: '工具执行完成，正在分析结果' }
    case 'token_count': return { kind: 'progress', label: '正在整理回复' }
    case 'conversation_history_compaction_start': return { kind: 'progress', label: '正在压缩历史上下文' }
    case 'conversation_history_compacted': return { kind: 'progress', label: '上下文已压缩，继续分析' }
    default: return { kind: 'unknown', event: event.event }
  }
}
