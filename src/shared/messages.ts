import type { TranscriptRequest, TranscriptResponse } from './types'

/** Popup / content script ↔ service worker message union (extend as features land). */
export type ExtensionMessage =
  | { type: 'PING' }
  | TranscriptRequest
  | TranscriptResponse

export type PingResponse = { ok: true; version: string }
