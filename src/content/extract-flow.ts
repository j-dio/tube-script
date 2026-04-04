import type { ExtractTranscriptCommand, TranscriptError, TranscriptResponse } from '@/shared/messages'
import { extractPageCaptionContext } from './extractor'

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
  const lower = message.toLowerCase()
  if (
    lower.includes('no usable caption') ||
    lower.includes('caption tracks') ||
    lower.includes('not found')
  ) {
    return { type: 'TRANSCRIPT_ERROR', payload: { error: 'No transcript available for this video' } }
  }
  if (lower.includes('timed out')) {
    return {
      type: 'TRANSCRIPT_ERROR',
      payload: { error: 'Something went wrong. Try refreshing the page.' },
    }
  }
  return {
    type: 'TRANSCRIPT_ERROR',
    payload: { error: 'Something went wrong. Try refreshing the page.' },
  }
}

/**
 * Page capture → `EXTRACT_TRANSCRIPT` → background pipeline + clipboard (PRD).
 */
export async function runTranscriptExtraction(): Promise<TranscriptResponse> {
  try {
    const payload = await extractPageCaptionContext()
    const command: ExtractTranscriptCommand = { type: 'EXTRACT_TRANSCRIPT', payload }
    const result = await sendExtractToBackground(command)

    // If the pipeline succeeded but clipboard failed in the offscreen document,
    // try fallback clipboard write from the content script (has user gesture context).
    if (result.type === 'TRANSCRIPT_SUCCESS' && !result.payload.clipboardOk) {
      console.log('[TubeScript] clipboard fallback: writing from content script')
      try {
        await navigator.clipboard.writeText(result.payload.text)
        console.log('[TubeScript] clipboard fallback: success')
      } catch (clipErr) {
        console.error('[TubeScript] clipboard fallback: also failed', clipErr)
        // Still return success — the transcript was extracted even if clipboard failed
      }
    }

    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return mapExtractorFailure(msg)
  }
}
