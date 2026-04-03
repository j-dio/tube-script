/** Caption track metadata relayed from the content script (see PRD §5.2). */
export interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind: 'asr' | 'manual'
  name: string
}

export interface TranscriptRequestPayload {
  videoId: string
  title: string
  channelName: string
  videoUrl: string
  captionTracks: CaptionTrack[]
}

/** Content script → service worker */
export interface TranscriptRequest {
  type: 'EXTRACT_TRANSCRIPT'
  payload: TranscriptRequestPayload
}

/** Service worker → content script / popup */
export interface TranscriptResponse {
  type: 'TRANSCRIPT_RESULT'
  payload:
    | { success: true; wordCount: number }
    | { success: false; error: string }
}

/** Parsed caption segment after Stage 1. */
export interface CaptionSegment {
  text: string
  start: number
  duration: number
}
