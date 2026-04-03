import type { TranscriptRequestPayload } from './types'

// ─── Commands: popup → service worker ─────────────────────────────────────────

export type PingCommand = { type: 'PING' }

export type ExtractTranscriptCommand = {
  type: 'EXTRACT_TRANSCRIPT'
  payload: TranscriptRequestPayload
}

/** Every message the popup is allowed to send. */
export type PopupMessage = PingCommand | ExtractTranscriptCommand

/** Every message the content script is allowed to send. */
export type ContentMessage = ExtractTranscriptCommand

/** Popup → content script: run page capture + background pipeline, return transcript result. */
export type RelayExtractFromPageCommand = { type: 'RELAY_EXTRACT_FROM_POPUP' }

/** Union of all messages the service worker can receive. */
export type InboundMessage = PopupMessage | ContentMessage

// ─── Responses: service worker → popup / content ──────────────────────────────

export type PingResponse = { ok: true; version: string }

export type TranscriptSuccess = {
  type: 'TRANSCRIPT_SUCCESS'
  payload: { wordCount: number; text: string }
}

export type TranscriptError = {
  type: 'TRANSCRIPT_ERROR'
  payload: { error: string }
}

/** Discriminated union returned after an extraction attempt. */
export type TranscriptResponse = TranscriptSuccess | TranscriptError

// ─── Offscreen messages: service worker ↔ offscreen document ──────────────────

export type ClipboardWriteMessage = {
  type: 'CLIPBOARD_WRITE'
  payload: { text: string }
}

export type ClipboardSuccessResponse = { type: 'CLIPBOARD_SUCCESS' }

export type ClipboardErrorResponse = {
  type: 'CLIPBOARD_ERROR'
  payload: { error: string }
}

/** Messages the service worker sends to the offscreen document. */
export type OffscreenMessage = ClipboardWriteMessage

/** Responses the offscreen document sends back. */
export type OffscreenResponse = ClipboardSuccessResponse | ClipboardErrorResponse

// ─── Back-compat alias ────────────────────────────────────────────────────────

/** @deprecated Use InboundMessage for service-worker handlers, PopupMessage in the popup. */
export type ExtensionMessage = InboundMessage
