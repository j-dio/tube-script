import { describe, expect, it } from 'vitest'
import { prependMetadataHeader } from '@/pipeline/metadata'

const BASE_META = {
  videoId: 'dQw4w9WgXcQ',
  title: 'How to Build a Chrome Extension in 2026',
  channelName: 'Fireship',
  videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
}

const BODY = 'This is the cleaned transcript body.'

describe('prependMetadataHeader', () => {
  // ─── Header format ─────────────────────────────────────────────────────────

  it('produces the exact header format specified in the PRD', () => {
    const result = prependMetadataHeader(BODY, BASE_META)
    const expected = [
      '---',
      'Title: How to Build a Chrome Extension in 2026',
      'Channel: Fireship',
      'URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      '---',
      '',
      BODY,
    ].join('\n')
    expect(result).toBe(expected)
  })

  it('starts with ---', () => {
    expect(prependMetadataHeader(BODY, BASE_META)).toMatch(/^---\n/)
  })

  it('contains a Title line', () => {
    expect(prependMetadataHeader(BODY, BASE_META)).toContain(
      'Title: How to Build a Chrome Extension in 2026',
    )
  })

  it('contains a Channel line using channelName', () => {
    expect(prependMetadataHeader(BODY, BASE_META)).toContain('Channel: Fireship')
  })

  it('contains a URL line', () => {
    expect(prependMetadataHeader(BODY, BASE_META)).toContain(
      'URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    )
  })

  it('closes the header block with ---', () => {
    const lines = prependMetadataHeader(BODY, BASE_META).split('\n')
    // Line 0: ---, lines 1-3: fields, line 4: ---
    expect(lines[4]).toBe('---')
  })

  it('separates header from body with a blank line', () => {
    const result = prependMetadataHeader(BODY, BASE_META)
    expect(result).toContain('---\n\n')
  })

  it('ends with the transcript body', () => {
    const result = prependMetadataHeader(BODY, BASE_META)
    expect(result.endsWith(BODY)).toBe(true)
  })

  // ─── Special characters in metadata fields ─────────────────────────────────

  it('handles a colon in the title without breaking the format', () => {
    const meta = { ...BASE_META, title: 'React: From Zero to Hero' }
    const result = prependMetadataHeader(BODY, meta)
    expect(result).toContain('Title: React: From Zero to Hero')
  })

  it('handles quotes in the title', () => {
    const meta = { ...BASE_META, title: 'The "Real" Guide to TypeScript' }
    const result = prependMetadataHeader(BODY, meta)
    expect(result).toContain('Title: The "Real" Guide to TypeScript')
  })

  it('handles special characters in the channel name', () => {
    const meta = { ...BASE_META, channelName: "Theo - t3.gg" }
    const result = prependMetadataHeader(BODY, meta)
    expect(result).toContain("Channel: Theo - t3.gg")
  })

  it('handles an ampersand in the title', () => {
    const meta = { ...BASE_META, title: 'HTML & CSS for Beginners' }
    expect(prependMetadataHeader(BODY, meta)).toContain('Title: HTML & CSS for Beginners')
  })

  // ─── Edge cases ────────────────────────────────────────────────────────────

  it('works with an empty body', () => {
    const result = prependMetadataHeader('', BASE_META)
    expect(result).toMatch(/^---\n/)
    expect(result.endsWith('\n')).toBe(true)
  })

  it('works with a multi-line body', () => {
    const multiBody = 'First sentence.\nSecond sentence.'
    const result = prependMetadataHeader(multiBody, BASE_META)
    expect(result).toContain('First sentence.\nSecond sentence.')
  })
})
