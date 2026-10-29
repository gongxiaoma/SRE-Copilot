/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_HOLMES_API_URL?: string
  readonly VITE_HOLMES_MODEL?: string
  readonly VITE_HOLMES_SYSTEM_PROMPT?: string
  readonly VITE_CONNECT_TIMEOUT_MS?: string
  readonly VITE_STREAM_IDLE_TIMEOUT_MS?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
