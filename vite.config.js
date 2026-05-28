import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/TableOne/',
  server: {
    port: 3000,
    open: true,
    proxy:{
      '/images':{
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/api':{
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})