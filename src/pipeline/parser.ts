import type { CaptionSegment, CaptionTrack } from '@/shared/types'

// ─── Track extraction ─────────────────────────────────────────────────────────

interface RawCaptionTrack {
  baseUrl?: string
  languageCode?: string
  kind?: string
  name?: { simpleText?: string }
}

interface RawPlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: RawCaptionTrack[]
    }
  }
}

/**
 * Navigates `captions.playerCaptionsTracklistRenderer.captionTracks` inside a
 * raw `ytInitialPlayerResponse` object and maps to our typed `CaptionTrack[]`.
 *
 * Tracks with missing `baseUrl` or `languageCode` are silently dropped.
 */
export function extractCaptionTracks(playerResponse: unknown): CaptionTrack[] {
  const data = playerResponse as RawPlayerResponse
  const rawTracks =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []

  const tracks: CaptionTrack[] = []
  for (const t of rawTracks) {
    if (!t.baseUrl || !t.languageCode) continue
    tracks.push({
      baseUrl: t.baseUrl,
      languageCode: t.languageCode,
      kind: t.kind === 'asr' ? 'asr' : 'manual',
      name: t.name?.simpleText ?? t.languageCode,
    })
  }
  return tracks
}

// ─── Track selection ──────────────────────────────────────────────────────────

/**
 * Picks the best caption track from the list following PRD priority order:
 *
 * 1. Manual captions in the user's browser language
 * 2. Manual captions in the video's default language (first manual track)
 * 3. Auto-generated (ASR) captions in the user's browser language
 * 4. Auto-generated (ASR) captions in any available language
 *
 * Language matching uses the BCP-47 base subtag (e.g. "en-US" → "en").
 */
export function selectCaptionTrack(
  tracks: CaptionTrack[],
  browserLang: string,
): CaptionTrack | null {
  if (!tracks.length) return null

  const lang = browserLang.split('-')[0].toLowerCase()
  const matches = (t: CaptionTrack) =>
    t.languageCode.split('-')[0].toLowerCase() === lang

  const manual = tracks.filter((t) => t.kind === 'manual')
  const asr = tracks.filter((t) => t.kind === 'asr')

  return (
    manual.find(matches) ?? // 1. manual × browser lang
    manual[0] ??             // 2. manual × default (first)
    asr.find(matches) ??     // 3. asr × browser lang
    asr[0] ??                // 4. asr × any
    null
  )
}

// ─── Caption fetch ────────────────────────────────────────────────────────────

/**
 * Fetches the raw caption payload for a track.
 * Requests JSON3 format to simplify parsing; falls back gracefully.
 */
export async function fetchCaptionTrack(baseUrl: string): Promise<string> {
  const url = new URL(baseUrl)
  url.searchParams.set('fmt', 'json3')

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`Caption fetch failed: ${res.status} ${res.statusText}`)
  }
  return res.text()
}

// ─── Caption parsing ──────────────────────────────────────────────────────────

/**
 * Parses a raw caption response — JSON3 or XML timedtext — into segments.
 * Returns an empty array for blank or unparseable input.
 */
export function parseCaptionPayload(raw: string): CaptionSegment[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('{')) {
    return parseJson3(trimmed)
  }
  return parseXml(trimmed)
}

// ─── JSON3 ────────────────────────────────────────────────────────────────────

interface Json3Seg {
  utf8?: string
}

interface Json3Event {
  tStartMs?: number
  dDurationMs?: number
  segs?: Json3Seg[]
}

interface Json3Response {
  events?: Json3Event[]
}

function parseJson3(raw: string): CaptionSegment[] {
  let data: Json3Response
  try {
    data = JSON.parse(raw) as Json3Response
  } catch {
    return []
  }

  const segments: CaptionSegment[] = []
  for (const event of data.events ?? []) {
    // Events without segs are window/style events — skip them.
    if (event.tStartMs === undefined || !event.segs?.length) continue

    const text = event.segs
      .map((s) => s.utf8 ?? '')
      .join('')
      .replace(/\n/g, ' ')
      .trim()

    if (!text) continue

    segments.push({
      text: decodeEntities(text),
      start: event.tStartMs / 1000,
      duration: (event.dDurationMs ?? 0) / 1000,
    })
  }
  return segments
}

// ─── XML timedtext ────────────────────────────────────────────────────────────

function parseXml(raw: string): CaptionSegment[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'text/xml')

  // A parse error produces a <parsererror> root element.
  if (doc.querySelector('parsererror')) return []

  const segments: CaptionSegment[] = []
  for (const node of doc.querySelectorAll('text')) {
    const start = parseFloat(node.getAttribute('start') ?? '0')
    const duration = parseFloat(node.getAttribute('dur') ?? '0')
    const text = decodeEntities(node.textContent ?? '').trim()
    if (!text) continue
    segments.push({ text, start, duration })
  }
  return segments
}

// ─── Entity decoding ──────────────────────────────────────────────────────────

/**
 * Decodes HTML entities using the browser DOM (or jsdom in tests).
 * Example: `&#39;` → `'`, `&amp;` → `&`.
 */
function decodeEntities(text: string): string {
  const ta = document.createElement('textarea')
  ta.innerHTML = text
  return ta.value
}
