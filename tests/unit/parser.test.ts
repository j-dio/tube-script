import { describe, expect, it } from 'vitest'
import { parseCaptionPayload } from '@/pipeline/parser'

describe('parseCaptionPayload', () => {
  it('returns an empty list until Stage 1 is implemented', () => {
    expect(parseCaptionPayload('')).toEqual([])
  })
})
