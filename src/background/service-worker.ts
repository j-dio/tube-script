import { decodeCaptionSegments } from '@/pipeline/decoder'
import { filterFillerSegments } from '@/pipeline/filters'
import { prependMetadataHeader } from '@/pipeline/metadata'
import { normalizeTranscriptBody } from '@/pipeline/normalizer'
import {
  extractCaptionTracks,
  fetchCaptionTrack,
  parseCaptionPayload,
  selectCaptionTrack,
} from '@/pipeline/parser'
import { stripTimestampsFromSegments } from '@/pipeline/timestamps'
import { EXTENSION_NAME, OFFSCREEN_DOCUMENT_PATH } from '@/shared/constants'
import type {
  ClipboardWriteMessage,
  InboundMessage,
  OffscreenResponse,
  PingResponse,
  TranscriptError,
  TranscriptResponse,
  TranscriptSuccess,
} from '@/shared/messages'
import type { TranscriptRequestPayload } from '@/shared/types'
import { installServiceWorkerDomPolyfill } from './sw-dom-polyfill'

installServiceWorkerDomPolyfill()

chrome.runtime.onInstalled.addListener(() => {
  console.log(`[${EXTENSION_NAME}] service worker installed`)
})

chrome.runtime.onMessage.addListener(
  (
    message: InboundMessage | ClipboardWriteMessage,
    _sender,
    sendResponse: (r: PingResponse | TranscriptResponse | void) => void,
  ) => {
    if (message.type === 'CLIPBOARD_WRITE') {
      return false
    }

    if (message.type === 'PING') {
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version })
      return false
    }

    if (message.type === 'EXTRACT_TRANSCRIPT') {
      void runExtractPipeline(message.payload)
        .then(sendResponse)
        .catch((err: unknown) => {
          sendResponse(unknownToTranscriptError(err))
        })
      return true
    }

    return false
  },
)

function unknownToTranscriptError(err: unknown): TranscriptError {
  const msg = err instanceof Error ? err.message : 'Something went wrong. Try refreshing the page.'
  return { type: 'TRANSCRIPT_ERROR', payload: { error: msg } }
}

function payloadToPlayerResponse(payload: TranscriptRequestPayload): unknown {
  return {
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: payload.captionTracks.map((t) => ({
          baseUrl: t.baseUrl,
          languageCode: t.languageCode,
          kind: t.kind === 'asr' ? 'asr' : undefined,
          name: { simpleText: t.name },
        })),
      },
    },
  }
}

async function fetchCaptionWithRetry(baseUrl: string): Promise<string> {
  try {
    return await fetchCaptionTrack(baseUrl)
  } catch {
    return await fetchCaptionTrack(baseUrl)
  }
}

async function ensureOffscreenDocument(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return
  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH),
    reasons: [chrome.offscreen.Reason.CLIPBOARD],
    justification: 'Write the processed transcript to the clipboard (Manifest V3).',
  })
}

async function closeOffscreenWhenDone(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) {
    await chrome.offscreen.closeDocument()
  }
}

function writeClipboardViaOffscreen(text: string): Promise<void> {
  const msg: ClipboardWriteMessage = { type: 'CLIPBOARD_WRITE', payload: { text } }
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response: OffscreenResponse | undefined) => {
      const last = chrome.runtime.lastError
      if (last) {
        reject(new Error(last.message))
        return
      }
      if (response?.type === 'CLIPBOARD_SUCCESS') {
        resolve()
        return
      }
      if (response?.type === 'CLIPBOARD_ERROR') {
        reject(new Error(response.payload.error))
        return
      }
      reject(new Error('Clipboard response missing'))
    })
  })
}

function countWords(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

async function runExtractPipeline(payload: TranscriptRequestPayload): Promise<TranscriptResponse> {
  const tracks = extractCaptionTracks(payloadToPlayerResponse(payload))
  if (!tracks.length) {
    return {
      type: 'TRANSCRIPT_ERROR',
      payload: { error: 'No transcript available for this video' },
    }
  }

  const browserLang =
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en'
  const selected = selectCaptionTrack(tracks, browserLang)
  if (!selected) {
    return {
      type: 'TRANSCRIPT_ERROR',
      payload: { error: 'No transcript available for this video' },
    }
  }

  let raw: string
  try {
    raw = await fetchCaptionWithRetry(selected.baseUrl)
  } catch (e) {
    const technical = e instanceof Error ? e.message : String(e)
    if (technical.includes('fetch') || technical.includes('Caption fetch')) {
      return {
        type: 'TRANSCRIPT_ERROR',
        payload: { error: 'Something went wrong. Try refreshing the page.' },
      }
    }
    return unknownToTranscriptError(e)
  }

  const parsed = parseCaptionPayload(raw)
  const segmentTexts = parsed.map((s) => s.text)
  const decoded = decodeCaptionSegments(segmentTexts)
  const stripped = stripTimestampsFromSegments(decoded)
  const filtered = filterFillerSegments(stripped)
  const body = normalizeTranscriptBody(filtered)

  if (!body.trim()) {
    return {
      type: 'TRANSCRIPT_ERROR',
      payload: { error: 'Transcript was too short to extract' },
    }
  }

  const finalText = prependMetadataHeader(body, {
    videoId: payload.videoId,
    title: payload.title,
    channelName: payload.channelName,
    videoUrl: payload.videoUrl,
  })

  const wordCount = countWords(body)

  try {
    await ensureOffscreenDocument()
    await writeClipboardViaOffscreen(finalText)
  } catch {
    return {
      type: 'TRANSCRIPT_ERROR',
      payload: { error: "Couldn't copy to clipboard. Check permissions." },
    }
  } finally {
    await closeOffscreenWhenDone()
  }

  const success: TranscriptSuccess = {
    type: 'TRANSCRIPT_SUCCESS',
    payload: { wordCount, text: finalText },
  }
  return success
}
