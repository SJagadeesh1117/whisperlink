import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // @ts-ignore
    viteCompression({ algorithm: 'gzip' }),
    // @ts-ignore
    viteCompression({ algorithm: 'brotliCompress' }),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192x192.png', 'icon-512x512.png'],
      manifest: {
        name: 'WhisperLink Secure Chat',
        short_name: 'WhisperLink',
        description: 'Anonymous, ephemeral, end-to-end encrypted chat.',
        theme_color: '#030712',
        background_color: '#030712',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Exclude all API and WebSocket paths from being cached
        navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
        runtimeCaching: [] // Default offline shell handles assets, we specifically don't want runtime caching of dynamic data
      }
    })
  ],
})
