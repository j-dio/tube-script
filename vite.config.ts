import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // Extension pages are file:-like URLs; asset URLs must be relative, not "/assets/...".
  base: '',
  resolve: {
    alias: { '@': path.resolve(dirname, 'src') },
  },
  plugins: [react(), crx({ manifest })],
})
