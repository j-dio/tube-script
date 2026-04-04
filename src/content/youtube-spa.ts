import { isYoutubeWatchPageHref } from './watch-page'

/**
 * YouTube moves between routes via history API without reloading the extension context.
 * Run `onWatchPage` when the URL becomes a new /watch?v= page (title element updates on most navigations).
 */
export function onYoutubeWatchUrlChanges(onWatchPage: () => void): void {
  let lastWatchHref: string | null = null

  function prime(): void {
    const href = window.location.href
    if (!isYoutubeWatchPageHref(href)) return
    lastWatchHref = href
    onWatchPage()
  }

  prime()

  const check = (): void => {
    const href = window.location.href
    if (!isYoutubeWatchPageHref(href)) {
      lastWatchHref = null
      return
    }
    if (href !== lastWatchHref) {
      lastWatchHref = href
      onWatchPage()
    }
  }

  window.addEventListener('popstate', check)

  const titleEl = document.querySelector('head > title')
  if (titleEl) {
    const mo = new MutationObserver(check)
    mo.observe(titleEl, { childList: true, subtree: true, characterData: true })
  }
}
