/** True when the tab is on a standard watch URL with a `v` id (not embed-only edge cases). */
export function isYoutubeWatchPageHref(href: string): boolean {
  try {
    const u = new URL(href)
    if (!u.hostname.endsWith('youtube.com')) return false
    return u.pathname === '/watch' && u.searchParams.has('v')
  } catch {
    return false
  }
}
