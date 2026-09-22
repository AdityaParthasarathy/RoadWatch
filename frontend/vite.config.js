import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'leaflet', 'react-leaflet'],
  },
  server: {
    port: 5173,
    host: true,   // expose on LAN so phones can reach it via local IP
  },
})
