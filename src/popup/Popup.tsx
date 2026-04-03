import { useCallback, useState } from 'react'
import { EXTENSION_NAME } from '@/shared/constants'
import type { RelayExtractFromPageCommand, TranscriptResponse } from '@/shared/messages'

type Phase = 'idle' | 'loading' | 'success' | 'error'

export function Popup() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [wordCount, setWordCount] = useState<number>(0)
  const [errorDetail, setErrorDetail] = useState<string>('')

  const extractTranscript = useCallback(() => {
    setPhase('loading')
    setErrorDetail('')
    setWordCount(0)

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      const url = tab?.url ?? ''
      if (!tab?.id || !url.includes('youtube.com/watch')) {
        setPhase('error')
        setErrorDetail('Open a YouTube watch page, then try again.')
        return
      }

      const relay: RelayExtractFromPageCommand = { type: 'RELAY_EXTRACT_FROM_POPUP' }
      chrome.tabs.sendMessage(tab.id, relay, (response: TranscriptResponse | undefined) => {
        const last = chrome.runtime.lastError
        if (last) {
          setPhase('error')
          setErrorDetail(
            last.message?.includes('Could not establish connection')
              ? 'Reload the YouTube tab so TubeScript can run on this page.'
              : last.message ?? 'Could not reach the page.',
          )
          return
        }

        if (response?.type === 'TRANSCRIPT_SUCCESS') {
          setPhase('success')
          setWordCount(response.payload.wordCount)
          return
        }

        if (response?.type === 'TRANSCRIPT_ERROR') {
          setPhase('error')
          setErrorDetail(response.payload.error)
          return
        }

        setPhase('error')
        setErrorDetail('Unexpected response from the extension.')
      })
    })
  }, [])

  return (
    <div className="w-80 bg-slate-950 p-4 text-slate-100">
      <h1 className="text-lg font-semibold tracking-tight text-sky-400">{EXTENSION_NAME}</h1>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        One click copies a cleaned transcript (with metadata) to your clipboard.
      </p>

      <button
        type="button"
        disabled={phase === 'loading'}
        onClick={extractTranscript}
        className="mt-4 w-full rounded-lg bg-sky-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {phase === 'loading' ? 'Extracting…' : 'Extract Transcript'}
      </button>

      <div className="mt-4 min-h-[3rem] rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs leading-relaxed" aria-live="polite">
        {phase === 'idle' && (
          <p className="text-slate-500">Use on a video page. The result is copied automatically.</p>
        )}
        {phase === 'loading' && <p className="text-slate-300">Running pipeline and copying to clipboard…</p>}
        {phase === 'success' && (
          <div className="text-emerald-300">
            <p className="font-medium">Copied to clipboard</p>
            <p className="mt-1 text-emerald-200/90">
              {wordCount.toLocaleString()} words · includes title, channel, and URL header
            </p>
          </div>
        )}
        {phase === 'error' && (
          <div className="text-red-300">
            <p className="font-medium">Could not finish</p>
            <p className="mt-1 text-red-200/90">{errorDetail}</p>
          </div>
        )}
      </div>
    </div>
  )
}
