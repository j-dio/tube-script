import type { ReadYtPlayerResponsePayload } from '@/shared/messages'
import type { CaptionTrack, TranscriptRequestPayload } from '@/shared/types'
import { applyPageMetadataOverlay } from './page-metadata-overlay'

// ─── Internal shape of the YouTube player response ───────────────────────────

interface YtCaptionTrack {
  baseUrl: string
  name: { simpleText: string }
  languageCode: string
  kind?: string
}

interface YtPlayerResponse {
  videoDetails?: {
    videoId?: string
    title?: string
    author?: string
  }
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: YtCaptionTrack[]
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Reads `window.ytInitialPlayerResponse` from the YouTube page.
 *
 * Content scripts run in an isolated world and cannot read page globals. The
 * service worker injects a static file via `executeScript({ world: 'MAIN', files })`.
 * Do not use inline `<script>` or `executeScript({ func })` on youtube.com — page CSP
 * blocks inline script; extension-origin `files` are allowed.
 */
export function extractPageCaptionContext(): Promise<TranscriptRequestPayload> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'READ_YT_INITIAL_PLAYER_RESPONSE' },
      (response: ReadYtPlayerResponsePayload | undefined) => {
        const last = chrome.runtime.lastError
        if (last) {
          reject(new Error(last.message))
          return
        }
        if (!response) {
          reject(new Error('No response from background'))
          return
        }
        if (!response.ok) {
          reject(new Error(response.error))
          return
        }
        if (!response.json) {
          reject(new Error('ytInitialPlayerResponse not found on this page'))
          return
        }

        try {
          const parsed = JSON.parse(response.json) as YtPlayerResponse
          const result = buildPayload(parsed)
          if (!result) {
            reject(new Error('No usable caption tracks found'))
            return
          }
          resolve(
            applyPageMetadataOverlay(result, {
              href: window.location.href,
              document,
            }),
          )
        } catch {
          reject(new Error('Failed to parse ytInitialPlayerResponse'))
        }
      },
    )
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPayload(data: YtPlayerResponse): TranscriptRequestPayload | null {
  const vd = data.videoDetails
  if (!vd?.videoId) return null

  const rawTracks =
    data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  if (!rawTracks.length) return null

  const captionTracks: CaptionTrack[] = rawTracks.map((t) => ({
    baseUrl: t.baseUrl,
    languageCode: t.languageCode,
    kind: t.kind === 'asr' ? 'asr' : 'manual',
    name: t.name.simpleText,
  }))

  return {
    videoId: vd.videoId,
    title: vd.title ?? '',
    channelName: vd.author ?? '',
    videoUrl: `https://www.youtube.com/watch?v=${vd.videoId}`,
    captionTracks,
  }
}
