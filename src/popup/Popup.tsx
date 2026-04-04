import { useCallback, useState } from 'react'
import { EXTENSION_NAME } from '@/shared/constants'
import { USER_HINT_EXTRACT_STEPS } from '@/shared/user-copy'
import type { RelayExtractFromPageCommand, TranscriptResponse } from '@/shared/messages'
import { TubeScriptLogoMark } from './TubeScriptLogoMark'

type Phase = 'idle' | 'loading' | 'success' | 'error'

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
      />
    </svg>
  )
}

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
      />
    </svg>
  )
}

function firstMeaningfulLine(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0)
  if (!line) return ''
  const t = line.trim()
  return t.length > 72 ? `${t.slice(0, 69)}…` : t
}

export function Popup() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [wordCount, setWordCount] = useState<number>(0)
  const [errorDetail, setErrorDetail] = useState<string>('')
  const [titleSnippet, setTitleSnippet] = useState<string>('')

  const extractTranscript = useCallback(() => {
    setPhase('loading')
    setErrorDetail('')
    setWordCount(0)
    setTitleSnippet('')

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
          setTitleSnippet(firstMeaningfulLine(response.payload.text))
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
    <div className="flex w-[380px] flex-col bg-surface text-on-surface antialiased">
      <header className="flex w-full items-center gap-3 border-b border-outline-variant bg-surface-header px-4 py-3">
        <TubeScriptLogoMark className="h-9 w-9 shrink-0 object-contain" />
        <span className="text-lg font-bold tracking-tight text-on-surface">{EXTENSION_NAME}</span>
      </header>

      <main className="flex flex-col gap-5 p-5">
        <section
          className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5"
          aria-labelledby="tubescript-intro-heading"
        >
          <h2 id="tubescript-intro-heading" className="text-base font-bold text-on-surface">
            One-click transcript
          </h2>
          <p className="mt-1 text-xs font-medium leading-relaxed text-on-surface-variant">
            Copies cleaned text with a metadata header (title, channel, URL).
          </p>
        </section>

        <section
          className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-3"
          aria-labelledby="tubescript-checklist-heading"
        >
          <h3
            id="tubescript-checklist-heading"
            className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
          >
            Before you extract
          </h3>
          <ol className="mt-2.5 list-decimal space-y-2 pl-4 text-xs leading-snug text-on-surface [list-style-position:outside] marker:font-semibold marker:text-primary">
            {USER_HINT_EXTRACT_STEPS.map((step) => (
              <li key={step} className="pl-1">
                {step}
              </li>
            ))}
          </ol>
        </section>

        <button
          type="button"
          disabled={phase === 'loading'}
          onClick={extractTranscript}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-primary to-primary-strong py-3.5 text-base font-bold text-on-primary-fixed shadow-md shadow-slate-900/10 transition hover:shadow-cta-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
        >
          <IconCopy className="shrink-0 opacity-90" />
          {phase === 'loading' ? 'Extracting…' : 'Extract Transcript'}
        </button>

        <div
          className="min-h-[5.5rem] rounded-xl border border-outline-variant bg-surface-container-low p-4 text-xs leading-relaxed"
          aria-live="polite"
          role="status"
        >
          {phase === 'idle' && (
            <p className="text-on-surface-variant">
              Use on a watch page (toolbar or here). When extraction succeeds, the transcript is copied
              automatically.
            </p>
          )}
          {phase === 'loading' && (
            <p className="text-on-surface">Running pipeline and copying to clipboard…</p>
          )}
          {phase === 'success' && (
            <div className="border-l-4 border-tertiary pl-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-emerald-100 p-2 text-tertiary">
                  <IconCheckCircle />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-tertiary">Copied to clipboard</h3>
                  <p className="mt-1 text-on-surface-variant">
                    Transcript and metadata header (title, channel, URL) successfully captured.
                  </p>
                  <div className="mt-3 flex items-stretch gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Words
                      </span>
                      <span className="text-sm font-medium text-on-surface tabular-nums">
                        {wordCount.toLocaleString()}
                      </span>
                    </div>
                    <div
                      className="w-px shrink-0 self-stretch min-h-[2.5rem] bg-outline-variant"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Preview
                      </span>
                      <span
                        className="truncate text-sm font-medium text-on-surface"
                        title={titleSnippet || undefined}
                      >
                        {titleSnippet || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {phase === 'error' && (
            <div className="border-l-4 border-error-ink pl-3">
              <p className="text-sm font-bold text-error-ink">Could not finish</p>
              <p className="mt-1 text-on-surface-variant">{errorDetail}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
