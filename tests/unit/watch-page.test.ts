import { describe, expect, it } from 'vitest'
import { isYoutubeWatchPageHref } from '@/content/watch-page'

describe('isYoutubeWatchPageHref', () => {
  it('is true for /watch with v=', () => {
    expect(isYoutubeWatchPageHref('https://www.youtube.com/watch?v=abc')).toBe(true)
  })

  it('is false for homepage', () => {
    expect(isYoutubeWatchPageHref('https://www.youtube.com/')).toBe(false)
  })

  it('is false for /watch without v', () => {
    expect(isYoutubeWatchPageHref('https://www.youtube.com/watch')).toBe(false)
  })
})
