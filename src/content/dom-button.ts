import type { TranscriptResponse } from '@/shared/messages'
import { COPY_TRANSCRIPT_BUTTON_TITLE } from '@/shared/user-copy'
import { runTranscriptExtraction } from './extract-flow'
import { showToast } from './toast'

const BUTTON_ID = 'tubescript-copy-transcript-btn'

let mutationObserverStarted = false

function formatWordCount(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function handleTranscriptResult(result: TranscriptResponse): void {
  if (result.type === 'TRANSCRIPT_SUCCESS') {
    showToast(`✓ Transcript copied — ${formatWordCount(result.payload.wordCount)} words`, 'success')
    return
  }
  showToast(`✗ ${result.payload.error}`, 'error')
}

function injectButton(anchor: Element): void {
  if (document.getElementById(BUTTON_ID)) return

  const btn = document.createElement('button')
  btn.id = BUTTON_ID
  btn.type = 'button'
  btn.setAttribute('aria-label', 'Copy video transcript')
  btn.setAttribute('title', COPY_TRANSCRIPT_BUTTON_TITLE)
  btn.append(document.createTextNode('📋 '), document.createTextNode('Copy Transcript'))
  btn.style.cssText = [
    'margin-inline-start: 8px',
    'padding: 0 12px',
    'height: 36px',
    'border-radius: 18px',
    'border: 1px solid var(--yt-spec-10-percent-layer, rgba(255,255,255,0.2))',
    'background: var(--yt-spec-badge-chip-background, rgba(255,255,255,0.1))',
    'color: var(--yt-spec-text-primary, #f1f1f1)',
    'font: 500 14px Roboto, Arial, sans-serif',
    'cursor: pointer',
    'display: inline-flex',
    'align-items: center',
    'gap: 6px',
    'flex-shrink: 0',
  ].join(';')

  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'var(--yt-spec-10-percent-layer, rgba(255,255,255,0.15))'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'var(--yt-spec-badge-chip-background, rgba(255,255,255,0.1))'
  })

  btn.addEventListener('click', () => {
    if (btn.disabled) return
    btn.disabled = true
    void runTranscriptExtraction()
      .then(handleTranscriptResult)
      .finally(() => {
        btn.disabled = false
      })
  })

  anchor.appendChild(btn)
}

function tryMount(): void {
  const anchor = document.querySelector('#top-level-buttons-computed')
  if (!anchor || !(anchor instanceof HTMLElement)) return
  injectButton(anchor)
}

/**
 * Waits for the primary video action row (like / share) and injects "Copy Transcript" (PRD §3.1 F6).
 */
export function mountTranscriptButton(): void {
  tryMount()
  if (mutationObserverStarted) return
  mutationObserverStarted = true
  const observer = new MutationObserver(() => {
    tryMount()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
