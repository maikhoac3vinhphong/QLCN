import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA: hôm nay chỉ cần "offline shell" (mở app khi mất mạng).
// Offline đầy đủ (ghi khi offline + đồng bộ) sẽ thêm ở Ngày 4.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'QLCN — Quản Lý Chủ Nhiệm',
        short_name: 'QLCN',
        description: 'Quản lý nề nếp & thi đua lớp, kết nối phụ huynh',
        theme_color: '#0d9488',
        background_color: '#f6f8f9',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ]
})
