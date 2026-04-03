import { describe, expect, it } from 'vitest'
import {
  extractCaptionTracks,
  selectCaptionTrack,
  parseCaptionPayload,
} from '@/pipeline/parser'
import type { CaptionTrack } from '@/shared/types'
import fixture from '../fixtures/sample-yt-player-response.json'

// ─── extractCaptionTracks ─────────────────────────────────────────────────────

describe('extractCaptionTracks', () => {
  it('extracts tracks from the real fixture', () => {
    const tracks = extractCaptionTracks(fixture)
    expect(tracks.length).toBeGreaterThan(0)
  })

  it('returns the correct shape for each track in the fixture', () => {
    const tracks = extractCaptionTracks(fixture)
    for (const track of tracks) {
      expect(track).toHaveProperty('baseUrl')
      expect(track).toHaveProperty('languageCode')
      expect(track.kind === 'asr' || track.kind === 'manual').toBe(true)
      expect(typeof track.name).toBe('string')
    }
  })

  it('maps asr kind correctly from fixture', () => {
    // The fixture has one auto-generated English track.
    const tracks = extractCaptionTracks(fixture)
    const asrTrack = tracks.find((t) => t.languageCode === 'en')
    expect(asrTrack).toBeDefined()
    expect(asrTrack?.kind).toBe('asr')
  })

  it('returns an empty array when captionTracks is absent', () => {
    expect(extractCaptionTracks({})).toEqual([])
    expect(extractCaptionTracks({ captions: {} })).toEqual([])
    expect(
      extractCaptionTracks({
        captions: { playerCaptionsTracklistRenderer: {} },
      }),
    ).toEqual([])
  })

  it('silently drops tracks missing baseUrl', () => {
    const tracks = extractCaptionTracks({
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            { languageCode: 'en', kind: 'asr', name: { simpleText: 'English' } },
          ],
        },
      },
    })
    expect(tracks).toEqual([])
  })

  it('silently drops tracks missing languageCode', () => {
    const tracks = extractCaptionTracks({
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            { baseUrl: 'https://example.com', kind: 'asr', name: { simpleText: 'English' } },
          ],
        },
      },
    })
    expect(tracks).toEqual([])
  })

  it('treats missing or empty kind as manual', () => {
    const tracks = extractCaptionTracks({
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: 'https://example.com/1',
              languageCode: 'en',
              name: { simpleText: 'English' },
              // kind is absent
            },
            {
              baseUrl: 'https://example.com/2',
              languageCode: 'es',
              kind: '',
              name: { simpleText: 'Spanish' },
            },
          ],
        },
      },
    })
    expect(tracks[0].kind).toBe('manual')
    expect(tracks[1].kind).toBe('manual')
  })
})

// ─── selectCaptionTrack ───────────────────────────────────────────────────────

const MANUAL_EN: CaptionTrack = {
  baseUrl: 'https://example.com/manual-en',
  languageCode: 'en',
  kind: 'manual',
  name: 'English',
}
const MANUAL_ES: CaptionTrack = {
  baseUrl: 'https://example.com/manual-es',
  languageCode: 'es',
  kind: 'manual',
  name: 'Spanish',
}
const ASR_EN: CaptionTrack = {
  baseUrl: 'https://example.com/asr-en',
  languageCode: 'en',
  kind: 'asr',
  name: 'English (auto-generated)',
}
const ASR_FR: CaptionTrack = {
  baseUrl: 'https://example.com/asr-fr',
  languageCode: 'fr',
  kind: 'asr',
  name: 'French (auto-generated)',
}

describe('selectCaptionTrack', () => {
  it('returns null for an empty track list', () => {
    expect(selectCaptionTrack([], 'en')).toBeNull()
  })

  it('priority 1: prefers manual in browser language over everything', () => {
    const tracks = [ASR_EN, MANUAL_ES, MANUAL_EN]
    expect(selectCaptionTrack(tracks, 'en')).toBe(MANUAL_EN)
  })

  it('priority 2: falls back to first manual when no manual matches browser lang', () => {
    const tracks = [ASR_EN, MANUAL_ES]
    expect(selectCaptionTrack(tracks, 'en')).toBe(MANUAL_ES)
  })

  it('priority 3: falls back to ASR in browser language when no manual exists', () => {
    const tracks = [ASR_FR, ASR_EN]
    expect(selectCaptionTrack(tracks, 'en')).toBe(ASR_EN)
  })

  it('priority 4: falls back to first ASR when nothing else matches', () => {
    const tracks = [ASR_FR, ASR_EN]
    expect(selectCaptionTrack(tracks, 'de')).toBe(ASR_FR)
  })

  it('matches browser lang using BCP-47 base subtag (en-US → en)', () => {
    const tracks = [ASR_FR, MANUAL_EN]
    expect(selectCaptionTrack(tracks, 'en-US')).toBe(MANUAL_EN)
  })

  it('selects from the real fixture tracks for English browser', () => {
    const tracks = extractCaptionTracks(fixture)
    const selected = selectCaptionTrack(tracks, 'en')
    expect(selected).not.toBeNull()
    expect(selected?.languageCode).toBe('en')
  })
})

// ─── parseCaptionPayload ──────────────────────────────────────────────────────

const SAMPLE_XML = `<?xml version="1.0" encoding="utf-8" ?>
<transcript>
  <text start="0.5" dur="4.18">Hello, welcome to this tutorial.</text>
  <text start="4.68" dur="2.1">Today we&#39;re going to learn React.</text>
  <text start="6.78" dur="1.5">   </text>
</transcript>`

const SAMPLE_JSON3 = JSON.stringify({
  events: [
    // Window event (no segs) — should be skipped.
    { tStartMs: 0, dDurationMs: 5000 },
    {
      tStartMs: 500,
      dDurationMs: 4180,
      segs: [{ utf8: 'Hello, ' }, { utf8: 'welcome to this tutorial.' }],
    },
    {
      tStartMs: 4680,
      dDurationMs: 2100,
      segs: [{ utf8: "Today we're going to learn React." }],
    },
    // Blank segment — should be skipped.
    { tStartMs: 6780, dDurationMs: 1500, segs: [{ utf8: '\n' }] },
  ],
})

describe('parseCaptionPayload', () => {
  it('returns an empty array for blank input', () => {
    expect(parseCaptionPayload('')).toEqual([])
    expect(parseCaptionPayload('   ')).toEqual([])
  })

  describe('XML format', () => {
    it('parses segment count correctly', () => {
      const segs = parseCaptionPayload(SAMPLE_XML)
      // Whitespace-only <text> node is dropped.
      expect(segs).toHaveLength(2)
    })

    it('parses start and duration as numbers in seconds', () => {
      const [first] = parseCaptionPayload(SAMPLE_XML)
      expect(first.start).toBeCloseTo(0.5)
      expect(first.duration).toBeCloseTo(4.18)
    })

    it('decodes HTML entities in XML', () => {
      const segs = parseCaptionPayload(SAMPLE_XML)
      expect(segs[1].text).toContain("we're")
    })

    it('returns an empty array for malformed XML', () => {
      expect(parseCaptionPayload('<transcript><broken>')).toEqual([])
    })
  })

  describe('JSON3 format', () => {
    it('parses segment count correctly', () => {
      const segs = parseCaptionPayload(SAMPLE_JSON3)
      // Window event and blank segment are dropped.
      expect(segs).toHaveLength(2)
    })

    it('converts tStartMs to seconds', () => {
      const [first] = parseCaptionPayload(SAMPLE_JSON3)
      expect(first.start).toBeCloseTo(0.5)
      expect(first.duration).toBeCloseTo(4.18)
    })

    it('joins multi-segment events into a single text string', () => {
      const [first] = parseCaptionPayload(SAMPLE_JSON3)
      expect(first.text).toBe('Hello, welcome to this tutorial.')
    })

    it('returns an empty array for malformed JSON', () => {
      expect(parseCaptionPayload('{not valid json')).toEqual([])
    })
  })
})
