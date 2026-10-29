/**
 * 依据 HolmesGPT 官方 HTTP API 与 stream.py 定义。
 * 字段及事件可能因部署版本而异；使用 unknown 扩展字段，读取前需运行时校验。
 * https://holmesgpt.dev/latest/reference/http-api/
 */
export interface HolmesExtensible {
  [field: string]: unknown
}

/** 服务端原始历史包含 system、工具调用及多模态内容，必须完整保留。 */
export interface HolmesConversationMessage extends HolmesExtensible {
  role: string
  content?: string | HolmesExtensible[] | null
  tool_calls?: HolmesToolCall[]
  tool_call_id?: string
  name?: string
}

export interface HolmesToolCall extends HolmesExtensible {
  id?: string
  type?: string
  function?: { name: string; arguments: string; [field: string]: unknown }
}

/** 首轮可省略历史；后续传回服务端历史，首条应为 system。 */
export interface HolmesChatRequest extends HolmesExtensible {
  ask: string
  stream: true
  conversation_history?: HolmesConversationMessage[]
  model?: string
  additional_system_prompt?: string
  enable_tool_approval?: boolean
  tool_decisions?: HolmesToolDecision[]
}

export interface HolmesToolDecision extends HolmesExtensible {
  tool_call_id: string
  approved: boolean
  feedback?: string
}

export interface HolmesFollowUpAction extends HolmesExtensible {
  id: string
  action_label: string
  pre_action_notification_text?: string
  prompt: string
}

/** 同时用于非流式响应与 ai_answer_end 的最终结果；可选字段依版本而异。 */
export interface HolmesChatResponse extends HolmesExtensible {
  analysis: string | null
  conversation_history: HolmesConversationMessage[]
  metadata?: HolmesExtensible
  tool_calls?: HolmesExtensible[]
  follow_up_actions?: HolmesFollowUpAction[] | null
}

/** 阶段消息，不能假定为最终答案的 token 增量；reasoning 不默认展示。 */
export interface HolmesAiMessageData extends HolmesExtensible {
  content?: string | null
  reasoning?: string | null
  metadata?: HolmesExtensible
}

export interface HolmesErrorData extends HolmesExtensible {
  description: string
  error_code: number
  msg: string
  success: false
}

export interface HolmesToolStartData extends HolmesExtensible {
  tool_name: string
  tool_call_id: string
  description?: string
}

export interface HolmesToolResultData extends HolmesExtensible {
  tool_call_id: string
  name: string
  role?: string
  result: HolmesExtensible
}

export interface HolmesPendingApproval extends HolmesExtensible {
  tool_call_id: string
  tool_name: string
  description: string
  params: HolmesExtensible
}

export interface HolmesPendingFrontendCall extends HolmesExtensible {
  tool_call_id: string
  tool_name: string
  arguments: HolmesExtensible
}

export interface HolmesApprovalData extends HolmesExtensible {
  analysis?: string | null
  content?: string | null
  conversation_history: HolmesConversationMessage[]
  requires_approval: boolean
  pending_approvals?: HolmesPendingApproval[]
  pending_frontend_tool_calls?: HolmesPendingFrontendCall[]
}

export interface HolmesCompactedData extends HolmesExtensible {
  messages: HolmesConversationMessage[]
  content?: string
  compaction_summary?: string | null
  metadata?: HolmesExtensible
}

export interface HolmesMetadataData extends HolmesExtensible {
  metadata?: HolmesExtensible
}

/** 供下一步协议适配层使用的事件与载荷映射；未知事件须保留或忽略。 */
export interface HolmesStreamEventMap {
  ai_message: HolmesAiMessageData
  ai_answer_end: HolmesChatResponse
  start_tool_calling: HolmesToolStartData
  tool_calling_result: HolmesToolResultData
  error: HolmesErrorData
  approval_required: HolmesApprovalData
  token_count: HolmesMetadataData
  conversation_history_compaction_start: HolmesExtensible
  conversation_history_compacted: HolmesCompactedData
}

export interface HolmesStreamEvent<K extends keyof HolmesStreamEventMap = keyof HolmesStreamEventMap> {
  event: K
  data: HolmesStreamEventMap[K]
}
