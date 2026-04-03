import { describe, expect, it } from 'vitest'
import { normalizeTranscriptBody } from '@/pipeline/normalizer'

describe('normalizeTranscriptBody', () => {
  // ─── Basic joining ─────────────────────────────────────────────────────────

  it('joins two segments with a single space', () => {
    expect(normalizeTranscriptBody(['a', 'b'])).toBe('a b')
  })

  it('joins multiple segments with single spaces', () => {
    expect(normalizeTranscriptBody(['one', 'two', 'three'])).toBe('one two three')
  })

  it('returns an empty string for an empty array', () => {
    expect(normalizeTranscriptBody([])).toBe('')
  })

  // ─── Empty segment removal ─────────────────────────────────────────────────

  it('removes segments that are empty strings', () => {
    expect(normalizeTranscriptBody(['a', '', 'b'])).toBe('a b')
  })

  it('removes segments that are whitespace-only', () => {
    expect(normalizeTranscriptBody(['a', '   ', 'b'])).toBe('a b')
  })

  it('returns an empty string when all segments are empty', () => {
    expect(normalizeTranscriptBody(['', '  ', '\t'])).toBe('')
  })

  // ─── Whitespace collapsing ─────────────────────────────────────────────────

  it('collapses multiple spaces inside a segment', () => {
    expect(normalizeTranscriptBody(['hello   world'])).toBe('hello world')
  })

  it('collapses tabs and newlines inside a segment', () => {
    expect(normalizeTranscriptBody(['foo\t\tbar', 'baz\nqux'])).toBe('foo bar baz qux')
  })

  it('trims leading whitespace from each segment', () => {
    expect(normalizeTranscriptBody(['  leading', 'space'])).toBe('leading space')
  })

  it('trims trailing whitespace from each segment', () => {
    expect(normalizeTranscriptBody(['trailing  ', '  spaces  '])).toBe('trailing spaces')
  })

  // ─── Residual whitespace from upstream stages ──────────────────────────────

  it('handles segments left with only whitespace after timestamp stripping', () => {
    // Stage 3 leaves " " when a timestamp-only segment like "0:00" is stripped.
    expect(normalizeTranscriptBody([' ', 'actual content', ' '])).toBe('actual content')
  })

  it('handles segments that start or end with spaces after filler stripping', () => {
    // Stage 4 may leave a segment like "  and have a great day." after stripping.
    expect(normalizeTranscriptBody(['  and have a great day.', 'Stay curious.'])).toBe(
      'and have a great day. Stay curious.',
    )
  })

  // ─── Full pipeline simulation ──────────────────────────────────────────────

  it('produces clean output from a realistic mixed array', () => {
    const segments = [
      '  React hooks  ',   // leading/trailing whitespace
      '',                   // empty (from filler removal)
      'were introduced  in  version 16.8.',  // internal extra spaces
      '  ',                 // whitespace-only (from timestamp stripping)
      'They simplify state management.',
    ]
    expect(normalizeTranscriptBody(segments)).toBe(
      'React hooks were introduced in version 16.8. They simplify state management.',
    )
  })
})
