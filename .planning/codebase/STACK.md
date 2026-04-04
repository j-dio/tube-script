# Codebase stack — TubeScript

**Purpose:** Chrome extension (Manifest V3) for one-click YouTube transcript extraction. Product spec: `tube-script-prd.md`.

## Languages and runtime

- **TypeScript** — `tsconfig.json` targets **ES2022**, `module` ESNext, `moduleResolution` bundler, **strict** mode, `noUnusedLocals` / `noUnusedParameters`, JSX `react-jsx`.
- **JavaScript (MAIN-world inject scripts)** — Plain scripts in `public/inject/*.js` executed via `chrome.scripting.executeScript` in the **MAIN** world (CSP-safe; no inline `func` injection on YouTube).

## Application model

- **Chrome Extension MV3** — `manifest.json`: service worker background, content scripts on `https://www.youtube.com/*`, action popup, `offscreen` + `clipboardWrite` + `scripting` + `webNavigation` permissions.
- **React 19** — Popup UI (`src/popup/`) with Tailwind utility classes.

## Build and bundling

- **Vite 8** — `vite.config.ts`: `base: ''` for extension-friendly relative asset URLs; `@` alias → `src/`.
- **@crxjs/vite-plugin** — CRX build from `manifest.json`; bundles extension entries.
- **@vitejs/plugin-react** — React refresh and JSX for popup (and Vitest).
- **Extra Rollup input** — `offscreen` entry from `public/offscreen.html` so the offscreen document’s TS is compiled and script URLs rewritten (`vite.config.ts`).

## Styling

- **Tailwind CSS 3.4** — `tailwind.config.ts` scans `src/**/*.{js,ts,jsx,tsx,html}`.
- **PostCSS / Autoprefixer** — Standard Vite pipeline (see `package.json` devDependencies).

## Key dependencies

| Area        | Packages |
|------------|----------|
| UI         | `react`, `react-dom` |
| Extension  | `@crxjs/vite-plugin`, `manifest.json` as Vite import |
| Types      | `@types/chrome`, `@types/react`, `@types/node` |
| Test       | `vitest`, `jsdom` |

## Configuration files (reference)

- `package.json` — Scripts: `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `test` (`vitest run`).
- `manifest.json` — MV3 surface area and host permissions.
- `tsconfig.json` — Strict TS, path `@/*` → `src/*`, Chrome + Vite client types.
- `vitest.config.ts` — jsdom, globals, `@` alias mirroring Vite.

## Output artifact

- Production build emits unpackable extension under **`dist/`** (load unpacked in Chrome per `README.md`).
