import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icon.svg'],
    manifest: {
      name: 'Better Every Day',
      short_name: 'Better Day',
      description: 'A private, local-first personal growth tracker.',
      theme_color: '#142a26',
      background_color: '#f5f7f2',
      display: 'standalone',
      start_url: '/',
      icons: [{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]
    }
  })]
})