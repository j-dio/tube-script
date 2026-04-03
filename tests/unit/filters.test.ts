import { describe, expect, it } from 'vitest'
import { filterFillerSegments } from '@/pipeline/filters'

// Helper: filter a single segment.
const filter = (s: string) => filterFillerSegments([s])[0]

// A segment guaranteed to be > 200 characters.
const LONG_PREFIX =
  'In this comprehensive guide we will cover the fundamentals of React hooks ' +
  'including useState useEffect useCallback and useMemo which are critical for ' +
  'building performant and maintainable modern web applications. '

describe('filterFillerSegments', () => {
  // ─── Preserves non-filler content ─────────────────────────────────────────

  describe('non-filler preservation', () => {
    it('passes through ordinary content unchanged', () => {
      expect(filter('hello')).toBe('hello')
      expect(filter('React hooks are powerful.')).toBe('React hooks are powerful.')
    })

    it('passes through an empty string', () => {
      expect(filter('')).toBe('')
    })
  })

  // ─── Whole-segment patterns (standalone filler words) ──────────────────────

  describe('standalone filler words (whole-segment removal)', () => {
    it('removes "um"', () => {
      expect(filter('um')).toBe('')
    })

    it('removes "uh"', () => {
      expect(filter('uh')).toBe('')
    })

    it('removes elongated variants — "umm", "uhh"', () => {
      expect(filter('umm')).toBe('')
      expect(filter('uhh')).toBe('')
    })

    it('removes "you know"', () => {
      expect(filter('you know')).toBe('')
      expect(filter('you know.')).toBe('')
    })

    it('removes "basically"', () => {
      expect(filter('basically')).toBe('')
    })

    it('removes "so yeah"', () => {
      expect(filter('so yeah')).toBe('')
      expect(filter('so yeah!')).toBe('')
    })

    it('removes "right" as a standalone segment', () => {
      expect(filter('right')).toBe('')
      expect(filter('right.')).toBe('')
    })

    it('removes "i mean"', () => {
      expect(filter('i mean')).toBe('')
    })

    it('removes "to be honest" and "to be fair"', () => {
      expect(filter('to be honest')).toBe('')
      expect(filter('to be fair')).toBe('')
    })

    it('removes "like i said"', () => {
      expect(filter('like i said')).toBe('')
    })

    it('does NOT remove "you know what I mean" — phrase extends beyond the standalone pattern', () => {
      expect(filter('you know what I mean')).toBe('you know what I mean')
    })

    it('does NOT remove "right, so the answer is 42" — word "right" is not the whole segment', () => {
      expect(filter('right, so the answer is 42')).toBe('right, so the answer is 42')
    })
  })

  // ─── Substring patterns (engagement, intros, sponsor, outros) ─────────────

  describe('engagement / CTA phrases', () => {
    it('removes "don\'t forget to subscribe"', () => {
      expect(filter("don't forget to subscribe")).toBe('')
    })

    it('removes "smash that like button"', () => {
      expect(filter('smash that like button')).toBe('')
    })

    it('removes "hit the bell icon"', () => {
      expect(filter('hit the bell icon')).toBe('')
    })

    it('removes "like and subscribe"', () => {
      expect(filter('like and subscribe')).toBe('')
    })

    it('removes "leave a comment below"', () => {
      expect(filter('leave a comment below')).toBe('')
    })

    it('is case-insensitive', () => {
      expect(filter('THANKS FOR WATCHING')).toBe('')
      expect(filter('Thanks For Watching')).toBe('')
    })
  })

  describe('intro phrases', () => {
    it('removes "welcome back to my channel"', () => {
      expect(filter('hey guys, welcome back to my channel')).toBe('')
    })

    it('removes "welcome back to another video"', () => {
      expect(filter('welcome back to another video')).toBe('')
    })
  })

  describe('sponsor phrases', () => {
    it('removes "this video is sponsored by"', () => {
      expect(filter('this video is sponsored by Squarespace')).toBe('')
    })

    it('removes "brought to you by"', () => {
      expect(filter('brought to you by NordVPN')).toBe('')
    })

    it('removes "use code X for Y% off"', () => {
      expect(filter('use code JOHN for 20% off')).toBe('')
    })
  })

  describe('outro phrases', () => {
    it('removes "thanks for watching"', () => {
      expect(filter('thanks for watching')).toBe('')
    })

    it('removes "see you in the next one"', () => {
      expect(filter('see you in the next one')).toBe('')
    })

    it('removes "until next time"', () => {
      expect(filter('until next time')).toBe('')
    })

    it('removes "peace out"', () => {
      expect(filter('peace out')).toBe('')
    })
  })

  // ─── Length guard (> 200 characters) ──────────────────────────────────────

  describe('length guard — segments longer than 200 characters', () => {
    it('does NOT remove a long segment even when it contains a filler phrase', () => {
      const longSeg = LONG_PREFIX + 'Thanks for watching and see you in the next one.'
      expect(longSeg.length).toBeGreaterThan(200)
      const result = filter(longSeg)
      // Segment is preserved (not removed entirely)
      expect(result).not.toBe('')
      // Substantive content is kept
      expect(result).toContain('React hooks')
    })

    it('strips the matched filler substring from a long segment', () => {
      const longSeg = LONG_PREFIX + 'Thanks for watching this content.'
      const result = filter(longSeg)
      expect(result).not.toContain('thanks for watching')
      expect(result.toLowerCase()).not.toContain('thanks for watching')
      expect(result).toContain('React hooks')
    })

    it('collapses extra whitespace after substring stripping in long segments', () => {
      const longSeg = LONG_PREFIX + 'Peace out and have a great day everyone.'
      const result = filter(longSeg)
      // No double spaces
      expect(result).not.toMatch(/\s{2,}/)
    })

    it('does NOT strip "you know" mid-sentence from a long segment', () => {
      // "you know" is a WHOLE_SEGMENT_ONLY pattern — never applied as substring.
      const longSeg =
        LONG_PREFIX +
        'You know, this is really important when building applications that need ' +
        'to scale across different platforms and devices in the real world today.'
      const result = filter(longSeg)
      expect(result.toLowerCase()).toContain('you know')
    })
  })

  // ─── Array handling ────────────────────────────────────────────────────────

  describe('array input', () => {
    it('filters each segment independently', () => {
      const input = ['thanks for watching', 'this is real content', 'um']
      expect(filterFillerSegments(input)).toEqual(['', 'this is real content', ''])
    })

    it('returns an empty array for empty input', () => {
      expect(filterFillerSegments([])).toEqual([])
    })
  })
})
