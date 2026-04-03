import { describe, expect, it } from 'vitest'
import { stripTimestampsFromSegments } from '@/pipeline/timestamps'

// Helper: strips from a single segment.
const strip = (s: string) => stripTimestampsFromSegments([s])[0]

describe('stripTimestampsFromSegments', () => {
  // ─── Plain timestamps ──────────────────────────────────────────────────────

  describe('plain format (M:SS / MM:SS / H:MM:SS)', () => {
    it('strips 0:00', () => {
      expect(strip('intro at 0:00')).toBe('intro at ')
    })

    it('strips MM:SS', () => {
      expect(strip('see 12:34 for details')).toBe('see  for details')
    })

    it('strips H:MM:SS', () => {
      expect(strip('jump to 1:02:15 now')).toBe('jump to  now')
    })

    it('strips a timestamp that is the entire segment', () => {
      expect(strip('0:00')).toBe('')
      expect(strip('59:59')).toBe('')
      expect(strip('1:23:45')).toBe('')
    })

    it('strips multiple timestamps in one segment', () => {
      expect(strip('from 1:00 to 2:30')).toBe('from  to ')
    })
  })

  // ─── Bracketed timestamps ──────────────────────────────────────────────────

  describe('bracketed format [M:SS] / [MM:SS] / [H:MM:SS]', () => {
    it('strips [0:00] including the brackets', () => {
      expect(strip('start [0:00]')).toBe('start ')
    })

    it('strips [12:34]', () => {
      expect(strip('chapter [12:34] begins')).toBe('chapter  begins')
    })

    it('strips [1:02:15]', () => {
      expect(strip('[1:02:15] key moment')).toBe(' key moment')
    })

    it('leaves no orphaned brackets', () => {
      expect(strip('[5:00]')).toBe('')
    })
  })

  // ─── Parenthetical timestamps ──────────────────────────────────────────────

  describe('parenthetical format (M:SS) / (MM:SS) / (H:MM:SS)', () => {
    it('strips (0:00) including the parens', () => {
      expect(strip('at (0:00) in the video')).toBe('at  in the video')
    })

    it('strips (12:34)', () => {
      expect(strip('see (12:34)')).toBe('see ')
    })

    it('strips (1:02:15)', () => {
      expect(strip('(1:02:15)')).toBe('')
    })
  })

  // ─── No false positives ────────────────────────────────────────────────────

  describe('false positive prevention', () => {
    it('does not strip plain integers — "I have 100 apples"', () => {
      expect(strip('I have 100 apples')).toBe('I have 100 apples')
    })

    it('does not strip large numbers without colons — "100 million views"', () => {
      expect(strip('100 million views')).toBe('100 million views')
    })

    it('does not strip decimal numbers — "version 2.0"', () => {
      expect(strip('version 2.0')).toBe('version 2.0')
    })

    it('does not strip 3+ digit groups before a colon — "100:00" is not a valid timestamp format', () => {
      // \d{1,2} ensures 3-digit groups are rejected
      expect(strip('100:00 minutes')).toBe('100:00 minutes')
    })

    it('does not mangle a sentence that has no timestamp', () => {
      const s = 'React hooks were introduced in version 16.8.'
      expect(strip(s)).toBe(s)
    })
  })

  // ─── Multi-segment array handling ─────────────────────────────────────────

  describe('array input', () => {
    it('processes every segment independently', () => {
      const input = ['0:00 intro', 'main content', '12:34 outro']
      expect(stripTimestampsFromSegments(input)).toEqual([
        ' intro',
        'main content',
        ' outro',
      ])
    })

    it('returns an empty array for empty input', () => {
      expect(stripTimestampsFromSegments([])).toEqual([])
    })
  })
})
