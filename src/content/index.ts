import { EXTENSION_NAME } from '@/shared/constants'
import type { RelayExtractFromPageCommand, TranscriptResponse } from '@/shared/messages'
import { mountTranscriptButton } from './dom-button'
import { runTranscriptExtraction } from './extract-flow'

console.log(`[${EXTENSION_NAME}] content script active`, window.location.href)

// Install the caption interceptor early so it captures timedtext data
// from the YouTube player's own XHR/fetch requests.
chrome.runtime.sendMessage({ type: 'INSTALL_CAPTION_INTERCEPTOR' })

mountTranscriptButton()

chrome.runtime.onMessage.addListener(
  (message: RelayExtractFromPageCommand, _sender, sendResponse) => {
    if (message.type !== 'RELAY_EXTRACT_FROM_POPUP') return false
    void runTranscriptExtraction().then((r: TranscriptResponse) => {
      sendResponse(r)
    })
    return true
  },
)
