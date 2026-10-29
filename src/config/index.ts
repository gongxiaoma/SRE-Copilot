function timeout(value: string | undefined, fallback: number): number {
  const result = Number(value)
  return Number.isFinite(result) && result > 0 ? result : fallback
}

export const appConfig = Object.freeze({
  apiUrl: import.meta.env.VITE_HOLMES_API_URL || '/api/chat',
  model: import.meta.env.VITE_HOLMES_MODEL?.trim() || '',
  additionalSystemPrompt: import.meta.env.VITE_HOLMES_SYSTEM_PROMPT?.trim() || '',
  connectTimeoutMs: timeout(import.meta.env.VITE_CONNECT_TIMEOUT_MS, 15_000),
  idleTimeoutMs: timeout(import.meta.env.VITE_STREAM_IDLE_TIMEOUT_MS, 120_000),
})
