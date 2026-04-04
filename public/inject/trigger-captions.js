/**
 * MAIN-world script to trigger YouTube's player to load captions.
 * Causes the player to hit /api/timedtext so the interceptor can capture it.
 *
 * If captions are already on, the player often skips a new timedtext fetch.
 * We briefly turn CC off then restore the same track to force a fresh download.
 */
;(function triggerCaptionLoad() {
  try {
    var player = document.querySelector('#movie_player')
    if (!player) {
      console.log('[TubeScript] trigger: no #movie_player found')
      return
    }

    if (typeof player.loadModule === 'function') {
      player.loadModule('captions')
    }

    if (typeof player.setOption !== 'function' || typeof player.getOption !== 'function') {
      return
    }

    var currentTrack = player.getOption('captions', 'track')
    var tracklist = player.getOption('captions', 'tracklist')

    function enableFirstTrack() {
      if (tracklist && tracklist.length) {
        player.setOption('captions', 'track', tracklist[0])
        console.log('[TubeScript] trigger: enabled captions for track', tracklist[0].languageCode)
      }
    }

    if (!currentTrack) {
      enableFirstTrack()
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
  }
})()
