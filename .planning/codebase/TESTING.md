# Testing — TubeScript

## Framework and runner

- **Vitest 4** — `npm run test` → `vitest run` (`package.json`).
- **Config:** `vitest.config.ts` — `environment: 'jsdom'`, `globals: true`, includes `tests/**/*.test.ts` and `tests/**/*.test.tsx`.
- **React plugin:** `@vitejs/plugin-react` enabled in Vitest config for JSX if needed in tests.
- **Path alias:** `@/` → `src/` matches Vite (`vitest.config.ts` `resolve.alias`).

## Test layout

| Path | Focus |
|------|--------|
| `tests/unit/parser.test.ts` | Caption parsing / track selection (`src/pipeline/parser.ts`) |
| `tests/unit/metadata.test.ts` | Metadata header behavior (`src/pipeline/metadata.ts`) |
| `tests/unit/filters.test.ts` | Filler filtering (`src/pipeline/filters.ts`) |
| `tests/unit/normalizer.test.ts` | Transcript body normalization (`src/pipeline/normalizer.ts`) |
| `tests/unit/timestamps.test.ts` | Timestamp stripping (`src/pipeline/timestamps.ts`) |
| `tests/unit/watch-page.test.ts` | Watch URL detection (`src/content/watch-page.ts`) |
| `tests/unit/page-metadata-overlay.test.ts` | Metadata overlay / SPA alignment (`src/content/page-metadata-overlay.ts`) |

## Fixtures

- `tests/fixtures/sample-yt-player-response.json` — Sample player response JSON for unit tests that depend on structure.

## End-to-end

- `tests/e2e/extraction.test.ts` — Currently a **placeholder** (`it.todo` for Playwright + loaded extension). **No automated browser E2E** is implemented yet.

## Coverage and CI

- **Coverage:** No explicit coverage thresholds found in `vitest.config.ts` at mapping time; extend config if you need enforced coverage.
- **CI:** No `.github/workflows` was enumerated in this mapping pass; local verification is `npm run build` + `npm run test`.

## Mocking patterns

- Unit tests exercise **pure functions** in `src/pipeline/` and small **DOM-free helpers** where possible — minimal mocking of Chrome APIs in the files reviewed.
- Extension integration (service worker, `chrome.scripting`, offscreen) is **not** covered by unit tests — would require dedicated harness or E2E.

## Suggested additions (for planners)

- Chrome API fakes or `vitest` mocks for `extract-flow` / `extractor` if you need regression tests without a browser.
- Real E2E per the todo in `tests/e2e/extraction.test.ts` for full extraction confidence.
