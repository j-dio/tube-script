/**
 * MAIN-world script to trigger YouTube's player to load captions.
 * Retries briefly while #movie_player or caption tracklist is not ready (cold start / SPA).
 */
;(function triggerCaptionLoad() {
  var maxAttempts = 14
  var delayMs = 320
  var attempt = 0

  function scheduleRetry() {
    if (attempt >= maxAttempts) return
    window.setTimeout(run, delayMs)
  }

  function run() {
    attempt++
    try {
      var player = document.querySelector('#movie_player')
      if (!player) {
        scheduleRetry()
        return
      }

      if (typeof player.loadModule === 'function') {
        player.loadModule('captions')
      }

      if (typeof player.setOption !== 'function' || typeof player.getOption !== 'function') {
        scheduleRetry()
        return
      }

      var currentTrack = player.getOption('captions', 'track')
      var tracklist = player.getOption('captions', 'tracklist')

      function enableFirstTrack() {
        if (tracklist && tracklist.length) {
          player.setOption('captions', 'track', tracklist[0])
          console.log('[TubeScript] trigger: enabled captions for track', tracklist[0].languageCode)
          return true
        }
        return false
      }

      if (!currentTrack) {
        if (!enableFirstTrack() && attempt < maxAttempts) {
          scheduleRetry()
        }
        return
      }

      console.log('[TubeScript] trigger: captions already active — toggling CC to force timedtext refresh')
      var prev = currentTrack
      try {
        player.setOption('captions', 'track', {})
      } catch (e1) {
        try {
          player.setOption('captions', 'track', null)
        } catch (e2) {
          console.warn('[TubeScript] trigger: could not disable CC, trying reload module', e2)
        }
      }

      window.setTimeout(function () {
        try {
          player.setOption('captions', 'track', prev)
          console.log('[TubeScript] trigger: re-enabled captions after toggle')
        } catch (e3) {
          console.warn('[TubeScript] trigger: re-enable failed, falling back to first track', e3)
          enableFirstTrack()
        }
      }, 280)
    } catch (e) {
      console.warn('[TubeScript] trigger error:', e)
      scheduleRetry()
    }
  }

  run()
})()
