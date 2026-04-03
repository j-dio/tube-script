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

/** Parsed caption segment after Stage 1. */
export interface CaptionSegment {
  text: string
  start: number
  duration: number
}
