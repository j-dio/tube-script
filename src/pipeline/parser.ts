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

// ─── Caption parsing ──────────────────────────────────────────────────────────

/**
 * YouTube timedtext JSON often includes a leading `)]}'` anti-XSSI prefix. Without
 * stripping it, the payload does not start with `{`, we mis-route to XML parsing,
 * and the transcript appears empty ("Transcript was too short to extract").
 */
function stripTimedtextJsonNoise(raw: string): string {
  let s = raw.trim()
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1).trimStart()
  }
  if (s.startsWith(")]}'")) {
    s = s.slice(4).trimStart()
  }
  if (s.startsWith('while(1);')) {
    s = s.slice(9).trimStart()
  }
  return s
}

/**
 * Parses a raw caption response — JSON3 or XML timedtext — into segments.
 * Returns an empty array for blank or unparseable input.
 */
export function parseCaptionPayload(raw: string): CaptionSegment[] {
  const trimmed = stripTimedtextJsonNoise(raw)
  console.log('[TubeScript] parseCaptionPayload: raw length', raw.length, '| trimmed prefix:', JSON.stringify(trimmed.slice(0, 80)))
  if (!trimmed) return []

  if (trimmed.startsWith('{')) {
    const segs = parseJson3(trimmed)
    console.log('[TubeScript] parseCaptionPayload: JSON3 path → segments:', segs.length)
    return segs
  }
  const segs = parseXml(trimmed)
  console.log('[TubeScript] parseCaptionPayload: XML path → segments:', segs.length)
  return segs
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

/**
 * Parses YouTube timedtext XML using regex rather than DOMParser.
 * DOMParser is absent or unreliable in Chrome Service Workers; regex is portable.
 *
 * YouTube's format: <text start="N.N" dur="N.N">encoded content</text>
 * Attribute order is not guaranteed, so each attribute is extracted separately.
 */
function parseXml(raw: string): CaptionSegment[] {
  const segments: CaptionSegment[] = []
  // Match every <text …>…</text> block, including multi-line content.
  const tagRe = /<text\b([^>]*)>([\s\S]*?)<\/text>/g
  const startRe = /\bstart="([\d.]+)"/
  const durRe = /\bdur="([\d.]+)"/

  let m: RegExpExecArray | null
  while ((m = tagRe.exec(raw)) !== null) {
    const attrs = m[1]
    const inner = m[2]

    const startMatch = startRe.exec(attrs)
    if (!startMatch) continue

    const start = parseFloat(startMatch[1])
    const durMatch = durRe.exec(attrs)
    const duration = durMatch ? parseFloat(durMatch[1]) : 0

    // Strip any inner tags (e.g. <font>) before entity-decoding.
    const rawText = inner.replace(/<[^>]+>/g, '')
    const text = decodeEntities(rawText).trim()
    if (!text) continue

    segments.push({ text, start, duration })
  }
  return segments
}

// ─── Entity decoding ──────────────────────────────────────────────────────────

/**
 * Decodes HTML/XML character references using pure string replacement.
 * Works in any JS environment (Service Worker, Node, browser).
 * `&amp;` must be decoded last to avoid double-decoding (e.g. `&amp;lt;` → `&lt;` not `<`).
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(+dec))
    .replace(/&nbsp;/gi, '\u00a0')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
}
