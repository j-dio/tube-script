import { EXTENSION_NAME } from '@/shared/constants'
import type { RelayExtractFromPageCommand, TranscriptResponse } from '@/shared/messages'
import { mountTranscriptButton } from './dom-button'
import { runTranscriptExtraction } from './extract-flow'
import { onYoutubeWatchUrlChanges } from './youtube-spa'

console.log(`[${EXTENSION_NAME}] content script active`, window.location.href)

function setupWatchPage(): void {
  chrome.runtime.sendMessage({ type: 'INSTALL_CAPTION_INTERCEPTOR' })
  mountTranscriptButton()
}

onYoutubeWatchUrlChanges(setupWatchPage)

chrome.runtime.onMessage.addListener(
  (message: RelayExtractFromPageCommand, _sender, sendResponse) => {
    if (message.type !== 'RELAY_EXTRACT_FROM_POPUP') return false
    void runTranscriptExtraction().then((r: TranscriptResponse) => {
      sendResponse(r)
    })
    return true
  },
)
