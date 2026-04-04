import { EXTENSION_NAME } from '@/shared/constants'
import type { RelayExtractFromKeyboardCommand, RelayExtractFromPageCommand, TranscriptResponse } from '@/shared/messages'
import { mountTranscriptButton } from './dom-button'
import { runTranscriptExtraction } from './extract-flow'
import { showToast } from './toast'
import { onYoutubeWatchUrlChanges } from './youtube-spa'

console.log(`[${EXTENSION_NAME}] content script active`, window.location.href)

function setupWatchPage(): void {
  chrome.runtime.sendMessage({ type: 'INSTALL_CAPTION_INTERCEPTOR' })
  mountTranscriptButton()
}

onYoutubeWatchUrlChanges(setupWatchPage)

function formatWordCount(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

chrome.runtime.onMessage.addListener(
  (message: RelayExtractFromPageCommand | RelayExtractFromKeyboardCommand, _sender, sendResponse) => {
    if (message.type === 'RELAY_EXTRACT_FROM_POPUP') {
      void runTranscriptExtraction().then((r: TranscriptResponse) => {
        sendResponse(r)
      })
      return true
    }

    if (message.type === 'RELAY_EXTRACT_FROM_KEYBOARD') {
      void runTranscriptExtraction().then((r: TranscriptResponse) => {
        if (r.type === 'TRANSCRIPT_SUCCESS') {
          showToast(`✓ Transcript copied — ${formatWordCount(r.payload.wordCount)} words`, 'success')
        } else {
          showToast(`✗ ${r.payload.error}`, 'error')
        }
        sendResponse(r)
      })
      return true
    }

    return false
  },
)
