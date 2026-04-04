import toastStyles from './toast.css?inline'

const HOST_ID = 'tubescript-toast-root'

function getOrCreateShadowRoot(): ShadowRoot {
  let host = document.getElementById(HOST_ID) as HTMLDivElement | null
  if (!host) {
    host = document.createElement('div')
    host.id = HOST_ID
    host.setAttribute('data-tubescript', 'toast-host')
    document.documentElement.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = toastStyles
    shadow.appendChild(style)
    const container = document.createElement('div')
    container.className = 'ts-toast-container'
    shadow.appendChild(container)
  }
  return host.shadowRoot as ShadowRoot
}

/**
 * Transient Shadow DOM toast (PRD §3.1 F5) — Tailwind via bundled `toast.css?inline`.
 */
export function showToast(message: string, variant: 'success' | 'error'): void {
  const shadow = getOrCreateShadowRoot()
  const container = shadow.querySelector('.ts-toast-container')
  if (!container) return

  const toast = document.createElement('div')
  toast.className =
    variant === 'success' ? 'ts-toast ts-toast--success' : 'ts-toast ts-toast--error'
  toast.textContent = message
  toast.setAttribute('role', 'status')
  container.appendChild(toast)

  const visibleMs = variant === 'error' ? 6500 : 3000
  window.setTimeout(() => {
    toast.classList.add('ts-toast--leave')
    window.setTimeout(() => toast.remove(), 320)
  }, visibleMs)
}
