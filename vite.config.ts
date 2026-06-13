import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/dartslive': {
        target: 'https://league.dartslive.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/dartslive/, ''),
      },
      '/api/data': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})