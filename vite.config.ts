import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      // route Nitro thuần (không qua TanStack), xem giải thích trong file
      routes: {
        '/api/media/:key': './src/server/media-route.ts',
        '/api/card-media/:file': './src/server/card-media-route.ts',
        '/api/grammar-media/:file': './src/server/grammar-media-route.ts',
        '/api/essential-media/:slug/:dir/:file': './src/server/essential-media-route.ts',
        '/api/tts': './src/server/tts-route.ts',
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
