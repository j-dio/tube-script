/**
 * MAIN-world caption interceptor — captures YouTube's own timedtext responses.
 *
 * YouTube's player fetches captions via XHR to /api/timedtext with player-generated
 * signature params. Direct fetch() calls (even from the page context) return empty
 * because they lack these signatures. Instead of fetching ourselves, we intercept
 * the player's own requests.
 *
 * This file is injected via chrome.scripting.executeScript({ world: 'MAIN', files })
 * so it bypasses YouTube's strict CSP.
 *
 * Strategy:
 *  - Hook XMLHttpRequest.open/send to intercept timedtext responses
 *  - Hook fetch() to intercept timedtext responses
 *  - Store captured caption data on a DOM attribute for the extension to read
 *  - If captions haven't been loaded yet, trigger the player to load them
 */
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

function videoIdFromTimedtextUrl(urlStr) {
  try {
    var abs = urlStr.indexOf('http') === 0 ? urlStr : location.origin + (urlStr.charAt(0) === '/' ? '' : '/') + urlStr
    var u = new URL(abs)
    var vid = u.searchParams.get('v')
    if (vid) return vid
    vid = u.searchParams.get('video_id')
    if (vid) return vid
    var id = u.searchParams.get('id')
    if (id && id.length >= 8) return id
    return null
  } catch (e) {
    return null
  }
}

function storeCaptionPayload(text, requestUrl) {
  window.__tubescriptCaptionData = text
  var fromReq = videoIdFromTimedtextUrl(requestUrl)
  var pv = pageVideoId()
  window.__tubescriptLastTimedtextVideoId = fromReq || pv || window.__tubescriptLastTimedtextVideoId
}

;(function tubescriptCaptionInterceptor() {
  // If we've already injected, don't double-inject
  if (window.__tubescriptInterceptorInstalled) {
    var pv = pageVideoId()
    var lv = window.__tubescriptLastTimedtextVideoId
    if (pv && lv && pv !== lv) {
      window.__tubescriptCaptionData = ''
      window.__tubescriptLastTimedtextVideoId = null
    }
    return window.__tubescriptCaptionData || ''
  }
  window.__tubescriptInterceptorInstalled = true
  window.__tubescriptCaptionData = ''
  window.__tubescriptLastTimedtextVideoId = null

  var TIMEDTEXT_PATTERN = /\/api\/timedtext/

  // ─── Hook XMLHttpRequest ────────────────────────────────────────────────
  var OrigXHR = window.XMLHttpRequest
  var origOpen = OrigXHR.prototype.open
  var origSend = OrigXHR.prototype.send

  OrigXHR.prototype.open = function (method, url) {
    this.__tsUrl = typeof url === 'string' ? url : url.toString()
    return origOpen.apply(this, arguments)
  }

  OrigXHR.prototype.send = function () {
    if (this.__tsUrl && TIMEDTEXT_PATTERN.test(this.__tsUrl)) {
      var xhr = this
      var origOnReady = xhr.onreadystatechange
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200 && xhr.responseText) {
          console.log('[TubeScript] interceptor: captured XHR timedtext response, length:', xhr.responseText.length)
          storeCaptionPayload(xhr.responseText, xhr.__tsUrl || '')
        }
        if (origOnReady) origOnReady.apply(this, arguments)
      }

      // Also handle addEventListener('load')
      xhr.addEventListener('load', function () {
        if (xhr.status === 200 && xhr.responseText) {
          console.log('[TubeScript] interceptor: captured XHR load timedtext, length:', xhr.responseText.length)
          storeCaptionPayload(xhr.responseText, xhr.__tsUrl || '')
        }
      })
    }
    return origSend.apply(this, arguments)
  }

  // ─── Hook fetch ─────────────────────────────────────────────────────────
  var origFetch = window.fetch
  window.fetch = function () {
    var url = arguments[0]
    var urlStr = typeof url === 'string' ? url : (url instanceof Request ? url.url : String(url))

    if (TIMEDTEXT_PATTERN.test(urlStr)) {
      return origFetch.apply(this, arguments).then(function (response) {
        var cloned = response.clone()
        cloned.text().then(function (text) {
          if (text) {
            console.log('[TubeScript] interceptor: captured fetch timedtext, length:', text.length)
            storeCaptionPayload(text, urlStr)
          }
        })
        return response
      })
    }
    return origFetch.apply(this, arguments)
  }

  console.log('[TubeScript] interceptor: hooks installed, waiting for player timedtext requests')

  // Return whatever we have so far (likely empty on first install)
  return window.__tubescriptCaptionData || ''
})()
