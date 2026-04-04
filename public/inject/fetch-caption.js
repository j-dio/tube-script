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
;(function tubescriptCaptionInterceptor() {
  // If we've already injected, don't double-inject
  if (window.__tubescriptInterceptorInstalled) {
    // Just read any already-captured data
    return window.__tubescriptCaptionData || ''
  }
  window.__tubescriptInterceptorInstalled = true
  window.__tubescriptCaptionData = ''

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
          window.__tubescriptCaptionData = xhr.responseText
        }
        if (origOnReady) origOnReady.apply(this, arguments)
      }

      // Also handle addEventListener('load')
      xhr.addEventListener('load', function () {
        if (xhr.status === 200 && xhr.responseText) {
          console.log('[TubeScript] interceptor: captured XHR load timedtext, length:', xhr.responseText.length)
          window.__tubescriptCaptionData = xhr.responseText
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
            window.__tubescriptCaptionData = text
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
