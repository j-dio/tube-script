import type { CaptionTrack, TranscriptRequestPayload } from '@/shared/types'

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
 * Content scripts execute in an isolated JS world and cannot directly access
 * page globals. We work around this by injecting a temporary inline <script>
 * that runs in the MAIN world, reads the variable, serialises it, and posts it
 * back to us via window.postMessage with a unique one-time key.
 *
 * A 5-second timeout guards against pages where the variable never appears.
 */
export function extractPageCaptionContext(): Promise<TranscriptRequestPayload> {
  return new Promise((resolve, reject) => {
    // Unique key prevents cross-contamination if multiple tabs are open.
    const key = `tube-script-yrp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    let settled = false

    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for ytInitialPlayerResponse'))
    }, 5_000)

    function onMessage(event: MessageEvent) {
      if (
        event.source !== window ||
        !event.data ||
        (event.data as { type?: unknown }).type !== key
      ) {
        return
      }
      cleanup()

      const payload = (event.data as { payload: string | null }).payload
      if (!payload) {
        reject(new Error('ytInitialPlayerResponse not found on this page'))
        return
      }

      try {
        const parsed = JSON.parse(payload) as YtPlayerResponse
        const result = buildPayload(parsed)
        if (!result) {
          reject(new Error('No usable caption tracks found'))
          return
        }
        resolve(result)
      } catch {
        reject(new Error('Failed to parse ytInitialPlayerResponse'))
      }
    }

    function cleanup() {
      if (settled) return
      settled = true
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
    }

    window.addEventListener('message', onMessage)

    // Inject a self-contained inline script that runs in the MAIN world.
    const script = document.createElement('script')
    script.textContent = `
      (function () {
        var data = window.ytInitialPlayerResponse;
        window.postMessage(
          { type: ${JSON.stringify(key)}, payload: data ? JSON.stringify(data) : null },
          window.location.origin || '*'
        );
      })();
    `
    document.documentElement.appendChild(script)
    script.remove()
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
