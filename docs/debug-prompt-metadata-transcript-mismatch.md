# Debug prompt: metadata from previous video, transcript from current video

Copy everything below the line into a **new chat** (Agent mode) when you want to fix this bug.

---

## Project

**TubeScript** — Chrome MV3 extension in this repo (`tube-script`). TypeScript, Vite, `@crxjs/vite-plugin`. Transcript flow: content script → `EXTRACT_TRANSCRIPT` with `TranscriptRequestPayload` → service worker pipeline → `prependMetadataHeader` + clipboard.

## Observed bug (reliable repro)

1. Open YouTube watch page **video A**, click **Copy Transcript** (injected button below player).  
2. If needed, turn on captions; extraction succeeds.  
3. **Navigate to another video B** (same tab — typical YouTube SPA navigation on `watch?v=`).  
4. Click **Copy Transcript** again.  
5. **Expected:** Metadata block (`Title`, `Channel`, `URL`) and transcript body both describe **video B**.  
6. **Actual:** **Metadata still describes video A**; **transcript text is for video B**.

So: **stale player metadata** paired with **fresh caption payload**.

## Hypothesis (use as starting point, verify in code)

Two different data sources are likely **out of sync** after in-tab navigation:

| Concern | Source today | Updates on SPA nav? |
|--------|----------------|---------------------|
| Title / channel / videoId / watch URL | Built from `ytInitialPlayerResponse` via `READ_YT_INITIAL_PLAYER_RESPONSE` + `extractor.ts` → `TranscriptRequestPayload` | May lag or read a stale snapshot |
| Raw timedtext JSON | `window.__tubescriptCaptionData` filled by `public/inject/fetch-caption.js` interceptor | Updates when player fetches **new** `/api/timedtext` |

If the interceptor captures **B**’s captions but the background still builds metadata from **A**’s `ytInitialPlayerResponse`, you get exactly this symptom.

## Files to inspect first

1. **`src/content/extractor.ts`** — `extractPageCaptionContext()`, how it requests player JSON from the service worker.  
2. **`src/background/service-worker.ts`** — `readYtPlayerJsonWithRetry`, `READ_YT_INITIAL_PLAYER_RESPONSE`, `runExtractPipeline`, `fetchCaptionViaInterceptor`, `installInterceptorAndRead` / `readCapturedCaptions`.  
3. **`public/inject/read-yt-initial-player.js`** — reads `window.ytInitialPlayerResponse` in MAIN world.  
4. **`public/inject/fetch-caption.js`** — `window.__tubescriptCaptionData` lifecycle (never cleared on `navigate`?).  
5. **`src/pipeline/metadata.ts`** — `prependMetadataHeader(body, meta)`; confirm `meta` always comes from the **same** extraction’s payload.  
6. **`src/content/index.ts`** — `INSTALL_CAPTION_INTERCEPTOR` timing vs navigations.

## Concrete questions to answer

- After SPA navigation to video B, does `window.ytInitialPlayerResponse` on the **real** page already reflect B when we read it? (Log or breakpoint in injected read script.)  
- Is there **caching** anywhere (service worker closure, single stale string, reused `TranscriptRequestPayload`)?  
- Should `__tubescriptCaptionData` (or player JSON read) be **cleared** on `yt-navigate-finish` / `history` / `yt-page-data-updated` / `visibilitychange` / `SPA` events?  
- Does `fetchCaptionViaInterceptor` return **cached** timedtext when non-empty, skipping a fresh read that would pair with **new** metadata? (See early return when `captured` is already set.)  
- Is **video id** in the payload ever derived from URL (`window.location`) vs from `videoDetails.videoId` — could they disagree?

## Success criteria

- After any navigation to a new watch URL in the same tab, **Extract** produces metadata **and** body for **that** video.  
- No regression for: first load, captions-off-then-on, popup vs button, offscreen clipboard.  
- Add or extend a **test** or **documented manual checklist** if full E2E isn’t in CI.

## Constraints

- Do **not** break CSP-safe injection (no inline scripts on `youtube.com`); keep using `chrome.scripting.executeScript` + `files` where required.  
- Keep `src/pipeline/` behavior contract clear; prefer fixing orchestration / inject lifecycle / clearing state over silent hacks unless justified.

---

_End of paste-ready prompt._
