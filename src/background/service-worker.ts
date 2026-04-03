import { EXTENSION_NAME } from '@/shared/constants'
import type { InboundMessage, PingResponse } from '@/shared/messages'

chrome.runtime.onInstalled.addListener(() => {
  console.log(`[${EXTENSION_NAME}] service worker installed`)
})

chrome.runtime.onMessage.addListener(
  (
    message: InboundMessage,
    _sender,
    sendResponse: (response: PingResponse | void) => void,
  ) => {
    if (message.type === 'PING') {
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version })
      return true
    }
    return false
  },
)
