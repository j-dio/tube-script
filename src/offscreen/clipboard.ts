import type {
  ClipboardWriteMessage,
  ClipboardSuccessResponse,
  ClipboardErrorResponse,
} from '@/shared/messages'

/**
 * Offscreen document clipboard writer (PRD §2.4).
 *
 * The service worker creates this document via chrome.offscreen.createDocument,
 * then posts a CLIPBOARD_WRITE message. We call navigator.clipboard.writeText
 * (available here because the offscreen document has a real DOM), then reply
 * with CLIPBOARD_SUCCESS or CLIPBOARD_ERROR.
 */
chrome.runtime.onMessage.addListener(
  (message: ClipboardWriteMessage, _sender, sendResponse) => {
    if (message.type !== 'CLIPBOARD_WRITE') return false

    navigator.clipboard.writeText(message.payload.text).then(
      () => {
        const response: ClipboardSuccessResponse = { type: 'CLIPBOARD_SUCCESS' }
        sendResponse(response)
      },
      (err: unknown) => {
        const response: ClipboardErrorResponse = {
          type: 'CLIPBOARD_ERROR',
          payload: {
            error: err instanceof Error ? err.message : 'Clipboard write failed',
          },
        }
        sendResponse(response)
      },
    )

    return true // keep the message channel open for the async response
  },
)
