import type { TranscriptRequestPayload } from '@/shared/types'

/** Parse watch `v=`, `/shorts/id`, or youtu.be from a location href (for tests pass any URL string). */
export function extractVideoIdFromLocationHref(href: string): string | null {
  try {
    const u = new URL(href)
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id || null
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return v
      const shorts = u.pathname.match(/^\/shorts\/([^/?#]+)/)
      if (shorts) return shorts[1]
    }
  } catch {
    /* ignore */
  }
  return null
}

function stripYoutubeTitleSuffix(raw: string): string {
  return raw.replace(/\s*-\s*YouTube\s*$/i, '').trim()
}

function readOpenGraphTitle(doc: Document): string {
  const meta = doc.querySelector('meta[property="og:title"]')
  const t = meta?.getAttribute('content')?.trim()
  if (t) return stripYoutubeTitleSuffix(t)
  return stripYoutubeTitleSuffix(doc.title || '')
}

function readChannelNameFromDom(doc: Document): string {
  const selectors = [
    '#channel-name a',
    'ytd-watch-metadata #channel-name a',
    'ytd-watch-metadata ytd-channel-name a',
    '#owner #channel-name a',
    '#owner ytd-channel-name a',
    'ytd-video-owner-renderer #channel-name a',
    'ytd-video-owner-renderer ytd-channel-name a',
  ]
  for (const sel of selectors) {
    const el = doc.querySelector(sel)
    const text = el?.textContent?.trim()
    if (text) return text
  }
  return ''
}

function canonicalUrlForVideo(href: string, pageVid: string): string {
  try {
    const u = new URL(href)
    if (!u.protocol.startsWith('http')) {
      return `https://www.youtube.com/watch?v=${pageVid}`
    }
    if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/shorts/')) {
      return `${u.origin}/shorts/${pageVid}`
    }
    if (u.hostname.includes('youtube.com') && u.searchParams.has('v')) {
      return `${u.origin}${u.pathname}?v=${encodeURIComponent(pageVid)}`
    }
    if (u.hostname === 'youtu.be') {
      return `https://youtu.be/${pageVid}`
    }
  } catch {
    /* ignore */
  }
  return `https://www.youtube.com/watch?v=${pageVid}`
}

export type PageMetadataOverlayContext = {
  href: string
  document: Document
  /**
   * Title read in the page MAIN world (matched `ytInitialPlayerResponse`, watch h1, then og:title).
   * Prefer this over isolated-world meta tags, which often lag behind SPA navigations.
   */
  watchTitleMain?: string | null
}

/**
 * Prefer the visible watch URL and DOM for metadata. Title uses MAIN-world hint first;
 * channel still uses light-DOM selectors in the content script.
 */
export function applyPageMetadataOverlay(
  payload: TranscriptRequestPayload,
  ctx: PageMetadataOverlayContext,
): TranscriptRequestPayload {
  const pageVid = extractVideoIdFromLocationHref(ctx.href)
  if (!pageVid) {
    return payload
  }

  const mainTitle = ctx.watchTitleMain?.trim() ?? ''
  const fallbackDomTitle = readOpenGraphTitle(ctx.document)
  const title = mainTitle || fallbackDomTitle || payload.title
  const channel = readChannelNameFromDom(ctx.document)

  return {
    ...payload,
    videoId: pageVid,
    videoUrl: canonicalUrlForVideo(ctx.href, pageVid),
    title,
    channelName: channel || payload.channelName,
  }
}
