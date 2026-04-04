# Concerns and technical debt — TubeScript

## External fragility (highest risk)

- **YouTube coupling:** Extraction depends on in-page JSON shape (`ytInitialPlayerResponse`), caption track URLs, and intercepted network timing. YouTube can change behavior, breaking the interceptor or parser **without** a semver signal.
- **MAIN-world inject scripts:** Logic in `public/inject/*.js` is harder to type-check and test than TypeScript in `src/`. Drift between TS pipeline expectations and JS inject behavior is a maintenance risk.

## Manifest V3 operational quirks

- **Service worker sleep:** First message after idle can fail; the codebase mitigates with retries (`src/content/extract-flow.ts`, offscreen boot delay in `src/background/service-worker.ts`). Residual edge cases may still produce intermittent “could not reach extension” errors for users.
- **Offscreen clipboard races:** Document explicitly comments on listener registration timing; multiple retry loops exist. Failures are softened by returning success with `clipboardOk: false` and attempting content-script clipboard fallback — users might occasionally get transcript without automatic clipboard.

## Coverage gaps

- **No real E2E:** `tests/e2e/extraction.test.ts` is `it.todo` only — no automated validation of full Chrome + YouTube flow.
- **Limited integration tests:** Service worker orchestration, `chrome.scripting` injection chains, and live caption capture are not unit-tested.

## Security and privacy

- **Host access:** Broad `https://www.youtube.com/*` permission; acceptable for scope but should stay minimal if features expand.
- **No remote exfiltration in mapped code:** Processing appears local; still re-verify before adding analytics or remote APIs.
- **User data:** Transcripts pass through extension memory and clipboard — document handling for sensitive content is user responsibility.

## Code health

- **No TODO/FIXME markers** were found via repository grep in `*.ts/tsx/js` at mapping time — good signal, but does not imply absence of known product gaps (see PRD vs implementation).
- **Console logging:** Verbose `console.log` / `warn` in `src/background/service-worker.ts` may be noisy in production; consider gated debug logging if shipping to a wide audience.

## Product / UX edge cases (from architecture review)

- **Popup URL check:** `src/popup/Popup.tsx` validates `youtube.com/watch` — **Shorts** or other YouTube URL patterns might be inconsistently supported vs service worker logic (which handles Shorts for interceptor installation). Worth aligning UX messaging and eligibility checks.
- **Stale metadata:** Mitigated by `page-metadata-overlay.ts` and player JSON retry — complex SPA edge cases may still produce rare mismatches.

## Documentation drift

- **PRD vs code:** `tube-script-prd.md` is large; periodic diff against actual behavior (especially capture strategy) is advisable after YouTube-facing changes.
