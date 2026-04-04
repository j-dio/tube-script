# Code conventions — TubeScript

## TypeScript

- **Strict mode** enabled (`tsconfig.json`): prefer explicit types; avoid `any` (project aligns with strict TS expectations).
- **Path alias:** Use `@/` for imports from `src/` (e.g. `import { … } from '@/shared/messages'`).
- **Discriminated unions:** Extension messages are modeled as unions on a `type` field in `src/shared/messages.ts` — handlers should narrow on `message.type`.
- **Chrome APIs:** Typed via `@types/chrome`; callbacks and `chrome.runtime.lastError` are checked after async-style `sendMessage` in several places (`src/content/extract-flow.ts`, `src/popup/Popup.tsx`).

## React (popup)

- **React 19** with function components and hooks (`useState`, `useCallback` in `src/popup/Popup.tsx`).
- **Styling:** Tailwind utility classes in JSX; separate `popup.css` for any non-utility rules.
- **UX copy:** Prefer importing strings from `src/shared/user-copy.ts` rather than duplicating hints in components.

## Content scripts and workers

- **Logging:** Prefixed console logs e.g. `[TubeScript]` in `src/background/service-worker.ts` and `src/content/extract-flow.ts` for traceability.
- **MV3 resilience:** Wrap fragile `sendMessage` calls with retry helpers where “Receiving end does not exist” is expected (`withServiceWorkerRetry` in `src/content/extract-flow.ts`; offscreen retry loop in `src/background/service-worker.ts`).
- **MAIN-world injection:** Use `chrome.scripting.executeScript({ world: 'MAIN', files: [...] })` with files under `public/inject/` — documented in `src/content/extractor.ts` comments (avoid inline `func` on YouTube).

## Error handling

- **User-facing errors:** Pipeline and UI map failures to stable messages in `src/shared/user-copy.ts` (`ERR_*`, `USER_HINT_*`).
- **Worker → client:** `unknownToTranscriptError` in `src/background/service-worker.ts` normalizes thrown values to `TRANSCRIPT_ERROR`.
- **Silent catches:** Some `catch` blocks intentionally swallow errors (e.g. tab closed during script injection) with empty bodies — pattern is “best effort” for extension lifecycle noise.

## Formatting and organization

- **Section banners:** Large files use ASCII section comments (e.g. `// ─── Extract pipeline ───` in `src/background/service-worker.ts`).
- **Module boundaries:** Pipeline logic stays in `src/pipeline/` without UI; shared types only in `src/shared/`.

## Linting

- No ESLint config file was present in the mapped tree at documentation time; quality gates rely on **`tsc --noEmit`** in `npm run build` and **Vitest** for regressions.
