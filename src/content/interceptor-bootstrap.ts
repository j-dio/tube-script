/**
 * Runs at document_start so the MAIN-world caption hooks are installed before
 * YouTube's player issues early /api/timedtext requests (cold watch load).
 */
void chrome.runtime.sendMessage({ type: 'INSTALL_CAPTION_INTERCEPTOR' }).catch(() => {
  /* Service worker may be waking; extraction path will retry install. */
})
