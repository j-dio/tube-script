# Repository structure — TubeScript

## Root

| Path | Role |
|------|------|
| `manifest.json` | MV3 manifest: permissions, background, content_scripts, action popup, icons |
| `package.json` / `package-lock.json` | Dependencies and npm scripts |
| `vite.config.ts` | Vite + CRX + React; `@` alias; offscreen Rollup input |
| `vitest.config.ts` | Unit tests: jsdom, `@` alias |
| `tsconfig.json` | TypeScript project for `src`, tests, configs |
| `tailwind.config.ts` | Tailwind content globs |
| `README.md` | Dev/build/load-unpacked instructions |
| `tube-script-prd.md` | Product requirements document |

## `src/` — Application source

| Path | Role |
|------|------|
| `src/background/service-worker.ts` | Main MV3 worker: navigation hooks, messaging, extract pipeline, offscreen clipboard |
| `src/background/sw-dom-polyfill.ts` | Worker-side DOM compatibility for shared pipeline imports |
| `src/content/` | YouTube content scripts: SPA handling, extraction flow, extractor, UI, toast |
| `src/content/interceptor-bootstrap.ts` | Early-load bootstrap (separate manifest entry) |
| `src/content/index.ts` | Primary content script entry at `document_idle` |
| `src/popup/` | Extension popup (HTML + React) |
| `src/offscreen/clipboard.ts` | Offscreen page clipboard handler |
| `src/pipeline/` | Transcript processing stages (parse, decode, filter, normalize, metadata, timestamps) |
| `src/shared/` | Types, message unions, constants, user-facing copy |
| `src/vite-env.d.ts` | Vite client typings |

## `public/` — Static extension assets

| Path | Role |
|------|------|
| `public/offscreen.html` | Offscreen document shell (Vite input) |
| `public/inject/*.js` | MAIN-world scripts (not bundled through typical TS pipeline as TS modules; copied/used as inject files) |
| `public/icons/` | Extension icons (referenced from `manifest.json`) |

## `tests/`

| Path | Role |
|------|------|
| `tests/unit/*.test.ts` | Vitest unit tests (parser, metadata, filters, normalizer, timestamps, watch-page helpers, overlay) |
| `tests/fixtures/sample-yt-player-response.json` | Fixture for player response shape |
| `tests/e2e/extraction.test.ts` | Placeholder / `it.todo` for future Playwright-style E2E |

## Build output

| Path | Role |
|------|------|
| `dist/` | Production extension bundle (gitignored); load unpacked target |

## Naming conventions (observed)

- **Files:** `kebab-case.ts` for modules (`extract-flow.ts`, `page-metadata-overlay.ts`); React components `PascalCase.tsx` (`Popup.tsx`).
- **Imports:** Path alias `@/` → `src/` (see `tsconfig.json` paths and Vite resolve).
- **Messages:** `SCREAMING_SNAKE_CASE` `type` discriminators in `src/shared/messages.ts`.
- **User strings:** Centralized in `src/shared/user-copy.ts` for consistent UX.

## Entry points (extension)

1. **Background:** `src/background/service-worker.ts` (manifest `background.service_worker`).
2. **Content:** `src/content/interceptor-bootstrap.ts` (document_start), `src/content/index.ts` (document_idle).
3. **Popup:** `src/popup/index.html` → `src/popup/index.tsx`.
4. **Offscreen:** `public/offscreen.html` + `src/offscreen/clipboard.ts`.
