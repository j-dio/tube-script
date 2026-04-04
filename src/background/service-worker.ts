import { decodeCaptionSegments } from '@/pipeline/decoder'
import { filterFillerSegments } from '@/pipeline/filters'
import { prependMetadataHeader } from '@/pipeline/metadata'
import { normalizeTranscriptBody } from '@/pipeline/normalizer'
import {
  extractCaptionTracks,
  parseCaptionPayload,
  selectCaptionTrack,
} from '@/pipeline/parser'
import { stripTimestampsFromSegments } from '@/pipeline/timestamps'
import {
  EXTENSION_NAME,
  OFFSCREEN_DOCUMENT_PATH,
  READ_WATCH_TITLE_INJECT_FILE,
  READ_YT_PLAYER_INJECT_FILE,
} from '@/shared/constants'
import type {
  ClipboardWriteMessage,
  InboundMessage,
  OffscreenResponse,
  PingResponse,
  ReadYtPlayerResponseErr,
  ReadYtPlayerResponseOk,
  ReadYtPlayerResponsePayload,
  TranscriptError,
  TranscriptResponse,
  TranscriptSuccess,
} from '@/shared/messages'
import type { TranscriptRequestPayload } from '@/shared/types'
import { installServiceWorkerDomPolyfill } from './sw-dom-polyfill'

installServiceWorkerDomPolyfill()

/** Watch URL, Shorts, or youtu.be — used to reject stale `ytInitialPlayerResponse` after SPA navigation. */
function extractVideoIdFromTabUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id || null
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return v
      const shorts = u.pathname.match(/^\/shorts\/([^/?#]+)/)
      if (shorts) return shorts[1]
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Static MAIN-world scripts under `public/inject/` (CSP-safe). */
const INTERCEPTOR_FILE = 'inject/fetch-caption.js'
const TRIGGER_FILE = 'inject/trigger-captions.js'
const READ_CAPTIONS_FILE = 'inject/read-captions.js'

chrome.runtime.onInstalled.addListener(() => {
  console.log(`[${EXTENSION_NAME}] service worker installed`)
})

function isYoutubeWatchOrShortsUrl(raw: string | undefined): boolean {
  if (!raw) return false
  try {
    const u = new URL(raw)
    if (!u.hostname.endsWith('youtube.com')) return false
    if (u.pathname === '/watch' && u.searchParams.has('v')) return true
    return /^\/shorts\/[^/?#]+/.test(u.pathname)
  } catch {
    return false
  }
}

function installCaptionInterceptorForTab(tabId: number): void {
  void chrome.scripting
    .executeScript({
      target: { tabId },
      world: 'MAIN',
      files: [INTERCEPTOR_FILE],
    })
    .catch(() => {
      /* Tab closed or no access */
    })
}

const YT_NAV_FILTER = { hostSuffix: 'youtube.com' } as const

chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId !== 0) return
    if (!isYoutubeWatchOrShortsUrl(details.url)) return
    installCaptionInterceptorForTab(details.tabId)
  },
  { url: [YT_NAV_FILTER] },
)

chrome.webNavigation.onCommitted.addListener(
  (details) => {
    if (details.frameId !== 0) return
    if (!isYoutubeWatchOrShortsUrl(details.url)) return
    installCaptionInterceptorForTab(details.tabId)
  },
  { url: [YT_NAV_FILTER] },
)

async function readWatchTitleInMain(tabId: number): Promise<string> {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      files: [READ_WATCH_TITLE_INJECT_FILE],
    })
    const r = injection?.result
    return typeof r === 'string' ? r : ''
  } catch {
    return ''
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: InboundMessage | ClipboardWriteMessage | { type: 'INSTALL_CAPTION_INTERCEPTOR' },
    sender,
    sendResponse: (r: PingResponse | TranscriptResponse | ReadYtPlayerResponsePayload | void) => void,
  ) => {
    if (message.type === 'CLIPBOARD_WRITE') {
      return false
    }

    if (message.type === 'PING') {
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version })
      return false
    }

    // Early interceptor install — called by content script at load time.
    if (message.type === 'INSTALL_CAPTION_INTERCEPTOR') {
      const tabId = sender.tab?.id
      if (tabId !== undefined) {
        installCaptionInterceptorForTab(tabId)
      }
      return false
    }

    if (message.type === 'READ_YT_INITIAL_PLAYER_RESPONSE') {
      const tabId = sender.tab?.id
      if (tabId === undefined) {
        const err: ReadYtPlayerResponseErr = { ok: false, error: 'No tab for this message' }
        sendResponse(err)
        return false
      }
      void Promise.all([readYtPlayerJsonWithRetry(tabId), readWatchTitleInMain(tabId)])
        .then(([json, watchTitle]) => {
          const ok: ReadYtPlayerResponseOk = {
            ok: true,
            json,
            watchTitle: watchTitle.trim() ? watchTitle.trim() : null,
          }
          sendResponse(ok)
        })
        .catch((err: unknown) => {
          const e: ReadYtPlayerResponseErr = {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          }
          sendResponse(e)
        })
      return true
    }

    if (message.type === 'EXTRACT_TRANSCRIPT') {
      const tabId = sender.tab?.id
      if (tabId === undefined) {
        sendResponse(unknownToTranscriptError(new Error('No tab context for fetch')))
        return false
      }
      void runExtractPipeline(message.payload, tabId)
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

/**
 * Polls MAIN-world `ytInitialPlayerResponse` until it matches the tab URL’s video id when
 * possible (SPA navigation). If it never catches up, returns the last non-null snapshot so
 * the content script can still build a payload; metadata is aligned from the page URL/DOM there.
 */
async function readYtPlayerJsonWithRetry(tabId: number): Promise<string | null> {
  const delayMs = 200
  const maxAttempts = 16
  let lastNonNullJson: string | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let expectedVid: string | null = null
    try {
      const tab = await chrome.tabs.get(tabId)
      expectedVid = extractVideoIdFromTabUrl(tab.url)
    } catch {
      return null
    }

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      files: [READ_YT_PLAYER_INJECT_FILE],
    })
    const json = injection?.result as string | null | undefined
    if (!json) {
      await new Promise((r) => setTimeout(r, delayMs))
      continue
    }

    lastNonNullJson = json

    if (!expectedVid) {
      return json
    }

    let playerVid: string | null = null
    try {
      const o = JSON.parse(json) as { videoDetails?: { videoId?: string } }
      playerVid = o.videoDetails?.videoId ?? null
    } catch {
      return json
    }

    if (playerVid === expectedVid) {
      return json
    }

    await new Promise((r) => setTimeout(r, delayMs))
  }

  return lastNonNullJson
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

// ─── Caption retrieval via interceptor ────────────────────────────────────

/**
 * Install the XHR/fetch interceptor and read any already-captured data.
 */
async function installInterceptorAndRead(tabId: number): Promise<string> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    files: [INTERCEPTOR_FILE],
  })
  return (injection?.result ?? '') as string
}

/**
 * Trigger YouTube's player to load captions via static MAIN-world script.
 */
async function triggerCaptionLoad(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    files: [TRIGGER_FILE],
  })
}

/**
 * Read captured captions via static MAIN-world script.
 */
async function readCapturedCaptions(tabId: number): Promise<string> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    files: [READ_CAPTIONS_FILE],
  })
  return (injection?.result ?? '') as string
}

/**
 * Gets caption text by:
 * 1. Installing the interceptor (hooks XHR/fetch in MAIN world)
 * 2. Triggering the YouTube player to load captions
 * 3. Polling until caption data is captured
 */
async function fetchCaptionViaInterceptor(tabId: number): Promise<string> {
  // Step 1: Install interceptor and check for already-captured data
  let captured = await installInterceptorAndRead(tabId)
  if (captured) {
    console.log('[TubeScript] interceptor: already had captured data, length:', captured.length)
    return captured
  }

  // Step 2: Trigger / refresh captions (toggle if CC already on — see trigger-captions.js)
  console.log('[TubeScript] interceptor: no captured timedtext yet, triggering caption load...')
  await triggerCaptionLoad(tabId)
  // Let trigger-captions.js finish its CC toggle window (~280ms) before polling.
  await new Promise((r) => setTimeout(r, 360))

  // Step 3: Poll for captured data
  const pollDelay = 280
  const maxPolls = 24
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, pollDelay))
    captured = await readCapturedCaptions(tabId)
    if (captured) {
      console.log('[TubeScript] interceptor: captured after', (i + 1) * pollDelay, 'ms, length:', captured.length)
      return captured
    }
  }

  console.warn('[TubeScript] interceptor: timed out waiting for caption data')
  return ''
}

// ─── Offscreen / clipboard ────────────────────────────────────────────────

/** ES-module offscreen page may register `onMessage` after `createDocument` resolves — wait briefly. */
const OFFSCREEN_LISTENER_BOOT_MS = 220

async function ensureOffscreenDocument(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return
  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH),
    reasons: [chrome.offscreen.Reason.CLIPBOARD],
    justification: 'Write the processed transcript to the clipboard (Manifest V3).',
  })
  await new Promise((r) => setTimeout(r, OFFSCREEN_LISTENER_BOOT_MS))
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

const OFFSCREEN_CONNECTION_ERR = /Receiving end does not exist|Could not establish connection/i

/** Retries when the offscreen document has not finished registering `runtime.onMessage` yet. */
async function writeClipboardViaOffscreenReliable(text: string): Promise<void> {
  let lastErr: Error | undefined
  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 60 + attempt * 45))
    }
    try {
      await writeClipboardViaOffscreen(text)
      return
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (!OFFSCREEN_CONNECTION_ERR.test(lastErr.message)) {
        throw lastErr
      }
    }
  }
  throw lastErr ?? new Error('Offscreen clipboard unavailable')
}

function countWords(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

// ─── Extract pipeline ─────────────────────────────────────────────────────

async function runExtractPipeline(payload: TranscriptRequestPayload, tabId: number): Promise<TranscriptResponse> {
  const tracks = extractCaptionTracks(payloadToPlayerResponse(payload))
  console.log('[TubeScript] pipeline: tracks found:', tracks.length, tracks.map((t) => `${t.languageCode}/${t.kind}`))
  if (!tracks.length) {
    return {
      type: 'TRANSCRIPT_ERROR',
      payload: { error: 'No transcript available for this video' },
    }
  }

  const browserLang =
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en'
  const selected = selectCaptionTrack(tracks, browserLang)
  console.log('[TubeScript] pipeline: selected track:', selected?.languageCode, selected?.kind)
  if (!selected) {
    return {
      type: 'TRANSCRIPT_ERROR',
      payload: { error: 'No transcript available for this video' },
    }
  }

  let raw: string
  try {
    raw = await fetchCaptionViaInterceptor(tabId)
    console.log('[TubeScript] pipeline: interceptor result, raw length:', raw.length,
      '| prefix:', JSON.stringify(raw.slice(0, 80)))
  } catch (e) {
    console.error('[TubeScript] pipeline: interceptor error', e)
    return {
      type: 'TRANSCRIPT_ERROR',
      payload: { error: 'Something went wrong. Try refreshing the page.' },
    }
  }

  if (!raw) {
    return {
      type: 'TRANSCRIPT_ERROR',
      payload: { error: 'Could not capture captions. Try enabling subtitles on the video first, then try again.' },
    }
  }

  const parsed = parseCaptionPayload(raw)
  console.log('[TubeScript] pipeline: parsed segments:', parsed.length, '| first:', parsed[0]?.text?.slice(0, 60))

  const segmentTexts = parsed.map((s) => s.text)
  const decoded = decodeCaptionSegments(segmentTexts)
  console.log('[TubeScript] pipeline: decoded segments:', decoded.length, '| first:', decoded[0]?.slice(0, 60))

  const stripped = stripTimestampsFromSegments(decoded)
  console.log('[TubeScript] pipeline: stripped segments:', stripped.length)

  const filtered = filterFillerSegments(stripped)
  console.log('[TubeScript] pipeline: filtered (non-empty):', filtered.filter(Boolean).length)

  const body = normalizeTranscriptBody(filtered)
  console.log('[TubeScript] pipeline: body chars:', body.length, '| blank:', !body.trim())

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

  let clipboardOk = false
  try {
    await ensureOffscreenDocument()
    await writeClipboardViaOffscreenReliable(finalText)
    clipboardOk = true
    console.log('[TubeScript] pipeline: clipboard write OK')
  } catch (clipErr) {
    console.error('[TubeScript] pipeline: clipboard write FAILED:', clipErr)
    // Don't fail the whole pipeline — return the text so the caller can try a fallback
  } finally {
    try { await closeOffscreenWhenDone() } catch { /* ignore */ }
  }

  const success: TranscriptSuccess = {
    type: 'TRANSCRIPT_SUCCESS',
    payload: { wordCount, text: finalText, clipboardOk },
  }
  return success
}
