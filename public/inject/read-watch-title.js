/**
 * MAIN-world: best-effort title for the *current* watch page.
 * Prefer ytInitialPlayerResponse when its videoId matches the URL, then watch UI h1, then og:title.
 * Ends with an expression for executeScript result.
 */
;(function readWatchTitle() {
  function pageVideoId() {
    try {
      var u = new URL(location.href)
      var v = u.searchParams.get('v')
      if (v) return v
      var m = u.pathname.match(/^\/shorts\/([^/?#]+)/)
      return m ? m[1] : null
    } catch (e) {
      return null
    }
  }

  function stripYouTubeSuffix(t) {
    return String(t || '')
      .replace(/\s*-\s*YouTube\s*$/i, '')
      .trim()
  }

  try {
    var pv = pageVideoId()
    var y = window.ytInitialPlayerResponse
    if (y && y.videoDetails && pv && y.videoDetails.videoId === pv && y.videoDetails.title) {
      return stripYouTubeSuffix(y.videoDetails.title)
    }
  } catch (e) {
    /* ignore */
  }

  try {
    var h = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')
    if (h && h.textContent) return stripYouTubeSuffix(h.textContent.trim())
  } catch (e2) {
    /* ignore */
  }

  var og = document.querySelector('meta[property="og:title"]')
  if (og) {
    var c = og.getAttribute('content')
    if (c) return stripYouTubeSuffix(c.trim())
  }

  return stripYouTubeSuffix(document.title || '')
})()
