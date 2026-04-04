import type { ExtractTranscriptCommand, TranscriptError, TranscriptResponse } from '@/shared/messages'
import {
  ERR_EXTENSION_NOT_REACHABLE,
  ERR_NO_CAPTION_TRACKS,
  ERR_SOMETHING_WENT_WRONG,
} from '@/shared/user-copy'
import { extractPageCaptionContext } from './extractor'

const SERVICE_WORKER_UNAVAILABLE = /Receiving end does not exist|Could not establish connection|Extension context invalidated/i

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

/**
 * MV3 service workers sleep; first message after idle can fail. Retry once after a short pause.
 */
async function withServiceWorkerRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!SERVICE_WORKER_UNAVAILABLE.test(msg)) {
      throw e
    }
    await sleep(200)
    return await operation()
  }
}

function sendExtractToBackground(command: ExtractTranscriptCommand): Promise<TranscriptResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(command, (response: TranscriptResponse | undefined) => {
      const last = chrome.runtime.lastError
      if (last) {
        reject(new Error(last.message))
        return
      }
      if (
        response?.type === 'TRANSCRIPT_SUCCESS' ||
        response?.type === 'TRANSCRIPT_ERROR'
      ) {
        resolve(response)
        return
      }
      reject(new Error('Unexpected response from background'))
    })
  })
}

function mapExtractorFailure(message: string): TranscriptError {
  if (SERVICE_WORKER_UNAVAILABLE.test(message)) {
    return { type: 'TRANSCRIPT_ERROR', payload: { error: ERR_EXTENSION_NOT_REACHABLE } }
  }
  const lower = message.toLowerCase()
  if (
    lower.includes('no usable caption') ||
    lower.includes('caption tracks') ||
    lower.includes('not found')
  ) {
    return { type: 'TRANSCRIPT_ERROR', payload: { error: ERR_NO_CAPTION_TRACKS } }
  }
  if (lower.includes('timed out')) {
    return { type: 'TRANSCRIPT_ERROR', payload: { error: ERR_SOMETHING_WENT_WRONG } }
  }
  return { type: 'TRANSCRIPT_ERROR', payload: { error: ERR_SOMETHING_WENT_WRONG } }
}

/**
 * Page capture → `EXTRACT_TRANSCRIPT` → background pipeline + clipboard (PRD).
 */
export async function runTranscriptExtraction(): Promise<TranscriptResponse> {
  try {
    const payload = await withServiceWorkerRetry(() => extractPageCaptionContext())
    const command: ExtractTranscriptCommand = { type: 'EXTRACT_TRANSCRIPT', payload }
    const result = await withServiceWorkerRetry(() => sendExtractToBackground(command))

    // If the pipeline succeeded but clipboard failed in the offscreen document,
    // try fallback clipboard write from the content script (has user gesture context).
    if (result.type === 'TRANSCRIPT_SUCCESS' && !result.payload.clipboardOk) {
      console.log('[TubeScript] clipboard fallback: writing from content script')
      try {
        await navigator.clipboard.writeText(result.payload.text)
        console.log('[TubeScript] clipboard fallback: success')
      } catch (clipErr) {
        console.warn('[TubeScript] clipboard fallback: also failed', clipErr)
        // Still return success — the transcript was extracted even if clipboard failed
      }
    }

    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return mapExtractorFailure(msg)
  }
}
