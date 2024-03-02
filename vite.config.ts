import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [solid(), crx({ manifest })],
  build: {
    lib: {
      entry: {
        background: "./src/background.ts",
        content_script: "./src/content.tsx",
      },
      name: "background",
    },
  },
})
