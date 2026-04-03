import { useCallback, useState } from 'react'
import { EXTENSION_NAME } from '@/shared/constants'
import type { ExtensionMessage, PingResponse } from '@/shared/messages'

type Status = 'idle' | 'checking' | 'ready' | 'error'

export function Popup() {
  const [status, setStatus] = useState<Status>('idle')
  const [detail, setDetail] = useState<string>('')

  const pingServiceWorker = useCallback(() => {
    setStatus('checking')
    setDetail('')
    const message: ExtensionMessage = { type: 'PING' }
    chrome.runtime.sendMessage(message, (response: PingResponse | undefined) => {
      const err = chrome.runtime.lastError
      if (err) {
        setStatus('error')
        setDetail(err.message ?? 'Unknown error')
        return
      }
      if (response?.ok) {
        setStatus('ready')
        setDetail(`v${response.version}`)
        return
      }
      setStatus('error')
      setDetail('Unexpected response')
    })
  }, [])

  return (
    <div className="w-72 bg-slate-950 p-4 text-slate-100">
      <h1 className="text-lg font-semibold tracking-tight text-sky-400">{EXTENSION_NAME}</h1>
      <p className="mt-1 text-xs text-slate-400">YouTube transcript extractor — pipeline wiring next.</p>
      <button
        type="button"
        onClick={pingServiceWorker}
        className="mt-4 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-950"
      >
        Check background
      </button>
      <p className="mt-3 min-h-[1.25rem] text-xs text-slate-300" aria-live="polite">
        {status === 'idle' && 'Tap the button to verify the service worker.'}
        {status === 'checking' && 'Connecting…'}
        {status === 'ready' && `Background OK (${detail})`}
        {status === 'error' && `Error: ${detail}`}
      </p>
    </div>
  )
}
