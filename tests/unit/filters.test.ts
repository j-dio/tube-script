import { describe, expect, it } from 'vitest'
import { filterFillerSegments } from '@/pipeline/filters'

describe('filterFillerSegments', () => {
  it('passes through segments until Stage 4 is implemented', () => {
    expect(filterFillerSegments(['hello'])).toEqual(['hello'])
  })
})
