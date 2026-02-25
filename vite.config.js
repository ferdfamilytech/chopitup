import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Increase chunk size warning limit — this is a large single-file app
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 3000,
    host: true, // needed inside Docker
  },
  preview: {
    port: 3000,
    host: true,
  },
})
