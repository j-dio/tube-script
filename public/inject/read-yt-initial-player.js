/**
 * MAIN-world read of `ytInitialPlayerResponse` — loaded from chrome-extension:// (CSP-safe).
 * Ends with an expression whose value becomes `executeScript` `results[0].result`.
 */
;(function storeYtPlayerJson() {
  try {
    var d = window.ytInitialPlayerResponse
    window.__tubescriptYtJson =
      d !== undefined && d !== null ? JSON.stringify(d) : null
  } catch (e) {
    window.__tubescriptYtJson = null
  }
})()

;(function readAndClearTubescriptYtJson() {
  var j = window.__tubescriptYtJson
  try {
    delete window.__tubescriptYtJson
  } catch (e) {
    try {
      window.__tubescriptYtJson = undefined
    } catch (e2) {}
  }
  return j
})()
