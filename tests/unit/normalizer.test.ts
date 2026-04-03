import { describe, expect, it } from 'vitest'
import { normalizeTranscriptBody } from '@/pipeline/normalizer'

describe('normalizeTranscriptBody', () => {
  it('joins segments with a space', () => {
    expect(normalizeTranscriptBody(['a', 'b'])).toBe('a b')
  })
})
