/**
 * MAIN-world script to read any captured caption data from the interceptor.
 * Returns the captured timedtext response text, or empty string if nothing captured yet.
 */
;(function readCapturedCaptions() {
  return window.__tubescriptCaptionData || ''
})()
