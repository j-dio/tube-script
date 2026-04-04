# External integrations — TubeScript

## YouTube (first-party, in-page)

- **Host permission:** `https://www.youtube.com/*` (`manifest.json`).
- **Page globals and APIs:** Logic depends on YouTube’s embedded player data (e.g. `ytInitialPlayerResponse` shape) and timedtext/caption network traffic. These are **not** stable public APIs; the extension is coupled to current YouTube web behavior.
- **Caption capture:** MAIN-world scripts in `public/inject/` hook or read player/network state:
  - `public/inject/fetch-caption.js` — Interceptor (XHR/fetch) installed by the service worker on navigation (`src/background/service-worker.ts`).
  - `public/inject/trigger-captions.js` — Nudges the player to load captions.
  - `public/inject/read-captions.js` — Reads captured caption payload.
  - `public/inject/read-yt-initial-player.js` — Reads serialized player response from MAIN world.
  - `public/inject/read-watch-title.js` — Reads watch title from MAIN world for metadata alignment.

## Chrome extension platform

- **`chrome.runtime`** — Messaging between popup, content script, service worker, and offscreen document; manifest version from `getManifest()`.
- **`chrome.tabs` + `chrome.scripting`** — `executeScript` with `world: 'MAIN'` and **file** URLs only (CSP on YouTube blocks inline function injection).
- **`chrome.webNavigation`** — `onHistoryStateUpdated` / `onCommitted` to reinstall caption interceptor on SPA navigations to watch/Shorts URLs (`src/background/service-worker.ts`).
- **`chrome.offscreen`** — Offscreen document for **clipboard** writes under MV3 (`public/offscreen.html`, `src/offscreen/clipboard.ts`).
- **`navigator.clipboard` (content script)** — Fallback copy when offscreen reports failure but extraction succeeded (`src/content/extract-flow.ts`).

## Network

- **Caption track `baseUrl`** — Comes from player response metadata; the interceptor path fetches/processes caption payloads **as observed from the page** (not a separate documented REST API in-repo). Any `fetch` of caption URLs is subject to YouTube cookies, CORS, and URL expiry behavior.

## Auth and backends

- **None in-repo.** No Convex, Supabase, or custom API server. No OAuth. All processing is local in the extension.

## Third-party services

- **None required** for core extraction. Repository metadata references GitHub (`package.json` `repository` / `bugs` URLs) for distribution only.

## Risk note

- **YouTube changes** (DOM, player JSON, caption delivery) can break extraction without code changes elsewhere. Treat YouTube as an integration with **implicit contracts**, not versioned APIs.
