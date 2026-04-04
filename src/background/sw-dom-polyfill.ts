/**
 * `parser.ts` no longer uses `document` or `DOMParser` — entity decoding is pure-JS
 * and XML parsing is regex-based. This polyfill is kept as a safeguard in case future
 * code accidentally reintroduces a DOM call in the SW context.
 */
export function installServiceWorkerDomPolyfill(): void {
  // No-op: DOM polyfill no longer required.
}
