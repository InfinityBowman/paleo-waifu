import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

const config = defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
        // crawlLinks discovers /patch-notes/$postId pages from the index links
        crawlLinks: true,
        // Only prerender static public pages (no D1, no auth)
        filter: ({ path }) => {
          const allowed = ['/', '/privacy', '/terms', '/patch-notes']
          return (
            allowed.includes(path) || path.startsWith('/patch-notes/')
          )
        },
      },
    }),
    viteReact(),
  ],
})

export default config
