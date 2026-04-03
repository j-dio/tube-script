import { describe, expect, it } from 'vitest'
import { stripTimestampsFromSegments } from '@/pipeline/timestamps'

describe('stripTimestampsFromSegments', () => {
  it('passes through until Stage 3 is implemented', () => {
    expect(stripTimestampsFromSegments(['0:00 intro'])).toEqual(['0:00 intro'])
  })
})
