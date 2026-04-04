import { describe, expect, it } from 'vitest'
import {
  applyPageMetadataOverlay,
  extractVideoIdFromLocationHref,
} from '@/content/page-metadata-overlay'
import type { TranscriptRequestPayload } from '@/shared/types'

function basePayload(over: Partial<TranscriptRequestPayload> = {}): TranscriptRequestPayload {
  return {
    videoId: 'OLD_ID',
    title: 'Old title',
    channelName: 'Old channel',
    videoUrl: 'https://www.youtube.com/watch?v=OLD_ID',
    captionTracks: [
      {
        baseUrl: 'https://example.com/caption',
        languageCode: 'en',
        kind: 'manual',
        name: 'English',
      },
    ],
    ...over,
  }
}

describe('extractVideoIdFromLocationHref', () => {
  it('parses watch v=', () => {
    expect(extractVideoIdFromLocationHref('https://www.youtube.com/watch?v=abc123')).toBe('abc123')
  })

  it('parses shorts path', () => {
    expect(extractVideoIdFromLocationHref('https://www.youtube.com/shorts/xyz789')).toBe('xyz789')
  })

  it('parses youtu.be', () => {
    expect(extractVideoIdFromLocationHref('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
})

describe('applyPageMetadataOverlay', () => {
  it('re-binds watch url from page even when player id already matches', () => {
    const doc = document.implementation.createHTMLDocument()
    const p = basePayload({ videoId: 'SAME' })
    const out = applyPageMetadataOverlay(p, {
      href: 'https://www.youtube.com/watch?v=SAME&list=PLx',
      document: doc,
    })
    expect(out).not.toBe(p)
    expect(out.videoId).toBe('SAME')
    expect(out.videoUrl).toBe('https://www.youtube.com/watch?v=SAME')
    expect(out.captionTracks).toEqual(p.captionTracks)
  })

  it('overlays id and url when page disagrees with player snapshot', () => {
    const doc = document.implementation.createHTMLDocument()
    doc.head.innerHTML =
      '<meta property="og:title" content="Real title - YouTube">'
    doc.body.innerHTML =
      '<a href="/channel">Real channel</a>'
    const anchor = doc.querySelector('a')!
    const wrap = doc.createElement('ytd-watch-metadata')
    const ch = doc.createElement('ytd-channel-name')
    ch.appendChild(anchor)
    wrap.appendChild(ch)
    doc.body.appendChild(wrap)

    const p = basePayload()
    const out = applyPageMetadataOverlay(p, {
      href: 'https://www.youtube.com/watch?v=NEW_ID',
      document: doc,
    })

    expect(out.videoId).toBe('NEW_ID')
    expect(out.videoUrl).toContain('NEW_ID')
    expect(out.title).toBe('Real title')
    expect(out.channelName).toBe('Real channel')
    expect(out.captionTracks).toEqual(p.captionTracks)
  })

  it('uses shorts canonical url on shorts pages', () => {
    const doc = document.implementation.createHTMLDocument()
    const p = basePayload()
    const out = applyPageMetadataOverlay(p, {
      href: 'https://www.youtube.com/shorts/SHORT99',
      document: doc,
    })
    expect(out.videoId).toBe('SHORT99')
    expect(out.videoUrl).toBe('https://www.youtube.com/shorts/SHORT99')
  })

  it('prefers MAIN-world title hint over og:title and payload', () => {
    const doc = document.implementation.createHTMLDocument()
    doc.head.innerHTML = '<meta property="og:title" content="Stale OG - YouTube">'
    const p = basePayload({ title: 'Stale payload title' })
    const out = applyPageMetadataOverlay(p, {
      href: 'https://www.youtube.com/watch?v=V',
      document: doc,
      watchTitleMain: 'Fresh MAIN title',
    })
    expect(out.title).toBe('Fresh MAIN title')
  })
})
