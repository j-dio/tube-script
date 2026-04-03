# TubeScript

Chrome extension (Manifest V3) for one-click YouTube transcript extraction. See `tube-script-prd.md` for the full specification.

## Development

```bash
npm install
npm run dev
```

Load **unpacked** from the `dist` folder after a production build:

```bash
npm run build
```

In Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → select the `dist` directory.

## Scripts

| Command        | Description                          |
| -------------- | ------------------------------------ |
| `npm run dev`  | Vite + CRXJS dev server with HMR     |
| `npm run build`| Production build to `dist/`          |
| `npm run test` | Vitest unit tests                    |

## Tech stack

Vite, React, TypeScript, Tailwind CSS, `@crxjs/vite-plugin` (MV3).
