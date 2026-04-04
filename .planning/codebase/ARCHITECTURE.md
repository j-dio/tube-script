# Architecture — TubeScript

## High-level pattern

**Manifest V3 extension** with a **thin UI layer** (popup + injected page button), a **service worker orchestrator**, **content scripts** for page lifecycle and user gesture context, **MAIN-world inject scripts** for CSP-safe access to page/player state, and a **pure TypeScript pipeline** for caption parsing and transcript formatting.

## Major components

### 1. Service worker (`src/background/service-worker.ts`)

- **Entry:** Declared in `manifest.json` as ES module service worker.
- **Responsibilities:**
  - Handle `PING`, `EXTRACT_TRANSCRIPT`, `READ_YT_INITIAL_PLAYER_RESPONSE`, and internal `INSTALL_CAPTION_INTERCEPTOR`-style flows.
  - Install caption interceptor on YouTube watch/Shorts navigations via `chrome.webNavigation` + `chrome.scripting.executeScript` (MAIN world, static files).
  - Run **`runExtractPipeline`**: track selection → interceptor-based caption fetch → parse/decode/normalize/filter → metadata header → optional offscreen clipboard.
- **Supporting:** `src/background/sw-dom-polyfill.ts` — DOM polyfills needed in worker context for pipeline modules.

### 2. Content scripts

- **`src/content/interceptor-bootstrap.ts`** — Loaded at `document_start` (see `manifest.json`); early hookup related to interceptor lifecycle.
- **`src/content/index.ts`** — `document_idle`: logs activation, registers SPA watch-page setup (`youtube-spa`), mounts UI (`dom-button`), relays popup extraction via `RELAY_EXTRACT_FROM_POPUP`.
- **`src/content/extract-flow.ts`** — User-facing extraction orchestration: retries for sleeping MV3 worker, sends `EXTRACT_TRANSCRIPT`, clipboard fallback.
- **`src/content/extractor.ts`** — Requests `READ_YT_INITIAL_PLAYER_RESPONSE` from background, parses JSON, builds `TranscriptRequestPayload`, applies `page-metadata-overlay`.
- **`src/content/youtube-spa.ts`** — Detects `/watch?v=` URL changes (popstate + title `MutationObserver`) to re-run watch setup.
- **`src/content/watch-page.ts`** — `isYoutubeWatchPageHref` helper.
- **`src/content/page-metadata-overlay.ts`** — Aligns title/URL/channel metadata with DOM/URL when player JSON is stale (SPA).
- **`src/content/dom-button.ts`**, `toast.ts`, `toast.css` — In-page button and feedback.

### 3. Popup (`src/popup/`)

- React app (`Popup.tsx`, `index.tsx`, `index.html`, `popup.css`) opened from toolbar action. Queries active tab and sends `RELAY_EXTRACT_FROM_POPUP` to content script (stays on user gesture path for messaging).

### 4. Offscreen document (`public/offscreen.html`, `src/offscreen/clipboard.ts`)

- Created on demand with `chrome.offscreen` reason `CLIPBOARD`. Service worker sends `CLIPBOARD_WRITE`; offscreen responds with success/error. Worker uses retries to handle listener boot races.

### 5. Pipeline (`src/pipeline/`)

Stateless transforms used by the service worker:

- `parser.ts` — Caption track extraction / payload parsing / track selection.
- `decoder.ts` — Decode caption segment text.
- `timestamps.ts` — Strip timing artifacts.
- `filters.ts` — Remove filler segments.
- `normalizer.ts` — Body normalization.
- `metadata.ts` — Prepend header (title, channel, URL, video id).

### 6. Shared contracts (`src/shared/`)

- `messages.ts` — Discriminated unions for all extension messages (popup, content, worker, offscreen).
- `types.ts` — `CaptionTrack`, `TranscriptRequestPayload`, `CaptionSegment`.
- `constants.ts` — Extension name, offscreen path, inject file names.
- `user-copy.ts` — Canonical user-visible error and hint strings.

## Data flow (happy path)

1. User on `/watch?v=…` — content script installs interceptor (via message to worker) and shows button; SPA navigations re-trigger setup.
2. **Extract** — `extractPageCaptionContext()` → worker reads MAIN-world player JSON (+ title) with retries until `videoId` matches tab URL when possible → builds payload.
3. **Pipeline** — Worker selects track (browser language heuristic), pulls raw caption XML/text via interceptor scripts, parses → decodes → strips timestamps → filters → normalizes → prepends metadata.
4. **Clipboard** — Worker ensures offscreen doc, writes full text; if that fails, success response still returns and content script may call `navigator.clipboard.writeText`.

## Design constraints

- **CSP:** YouTube blocks inline injection; all MAIN-world logic uses **bundled static files** under `public/inject/`.
- **MV3 service worker:** Ephemeral; messaging uses explicit retries (`extract-flow.ts`, offscreen clipboard retries in `service-worker.ts`).
