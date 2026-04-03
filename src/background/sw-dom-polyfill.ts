/**
 * `parseCaptionPayload` (parser.ts) decodes entities via `document.createElement('textarea')`.
 * Extension service workers have no DOM; provide a minimal global `document` before running the pipeline.
 */
export function installServiceWorkerDomPolyfill(): void {
  if (typeof globalThis.document !== 'undefined') return

  globalThis.document = {
    createElement(tagName: string) {
      if (tagName.toLowerCase() !== 'textarea') {
        throw new Error(`TubeScript SW: unsupported createElement(${JSON.stringify(tagName)})`)
      }
      const state = { innerHTML: '' }
      return {
        get innerHTML() {
          return state.innerHTML
        },
        set innerHTML(v: string) {
          state.innerHTML = v
        },
        get value() {
          const doc = new DOMParser().parseFromString('', 'text/html')
          const ta = doc.createElement('textarea')
          ta.innerHTML = state.innerHTML
          return ta.value
        },
      } as unknown as HTMLTextAreaElement
    },
  } as unknown as Document
}
