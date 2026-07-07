import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '面談レコーダー',
        short_name: '面談レコーダー',
        description: '産業医面談・訪問診療の音声メモを医療文書化するアプリ',
        lang: 'ja',
        display: 'standalone',
        theme_color: '#1565c0',
        background_color: '#f4f6f8',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
