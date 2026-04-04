import type { TranscriptResponse } from '@/shared/messages'
import { COPY_TRANSCRIPT_BUTTON_TITLE } from '@/shared/user-copy'
import { runTranscriptExtraction } from './extract-flow'
import { showToast } from './toast'

const BUTTON_ID = 'tubescript-copy-transcript-btn'
const BTN_STYLE_ID = 'tubescript-button-styles'

let mutationObserverStarted = false

function ensureButtonKeyframes(): void {
  if (document.getElementById(BTN_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = BTN_STYLE_ID
  style.textContent = `
    @keyframes tubescript-btn-spin { to { transform: rotate(360deg); } }
    #${BUTTON_ID} .tubescript-btn-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.25);
      border-top-color: rgba(255,255,255,0.95);
      border-radius: 50%;
      animation: tubescript-btn-spin 0.7s linear infinite;
      flex-shrink: 0;
    }
  `
  document.head.appendChild(style)
}

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

function setButtonLoading(btn: HTMLButtonElement, loading: boolean): void {
  const idle = btn.querySelector('.tubescript-btn-idle') as HTMLElement | null
  const busy = btn.querySelector('.tubescript-btn-busy') as HTMLElement | null
  if (!idle || !busy) return
  idle.style.display = loading ? 'none' : 'inline-flex'
  busy.style.display = loading ? 'inline-flex' : 'none'
  btn.setAttribute('aria-busy', loading ? 'true' : 'false')
  btn.setAttribute('aria-label', loading ? 'Copying transcript…' : 'Copy video transcript')
}

function injectButton(anchor: Element): void {
  if (document.getElementById(BUTTON_ID)) return

  ensureButtonKeyframes()

  const btn = document.createElement('button')
  btn.id = BUTTON_ID
  btn.type = 'button'
  btn.setAttribute('aria-label', 'Copy video transcript')
  btn.setAttribute('aria-busy', 'false')
  btn.setAttribute('title', COPY_TRANSCRIPT_BUTTON_TITLE)

  const idle = document.createElement('span')
  idle.className = 'tubescript-btn-idle'
  idle.style.cssText = 'display:inline-flex;align-items:center;gap:6px;'
  idle.append(document.createTextNode('📋 '))
  const idleLabel = document.createElement('span')
  idleLabel.textContent = 'Copy Transcript'
  idle.appendChild(idleLabel)

  const busy = document.createElement('span')
  busy.className = 'tubescript-btn-busy'
  busy.style.cssText = 'display:none;align-items:center;gap:8px;'
  const spinner = document.createElement('span')
  spinner.className = 'tubescript-btn-spinner'
  spinner.setAttribute('aria-hidden', 'true')
  const busyLabel = document.createElement('span')
  busyLabel.textContent = 'Working…'
  busy.append(spinner, busyLabel)

  btn.append(idle, busy)

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
    setButtonLoading(btn, true)
    void runTranscriptExtraction()
      .then(handleTranscriptResult)
      .finally(() => {
        setButtonLoading(btn, false)
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
