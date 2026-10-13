import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  root: 'frontend',
  base: '/',
  resolve: { alias: {events: 'events/', url: fileURLToPath(new URL('./frontend/lib/browser-url.ts', import.meta.url))} },
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  optimizeDeps: { exclude: ['@cornerstonejs/dicom-image-loader'] },
  worker: { format: 'es' },
  server: {
    host: '127.0.0.1', port: 3000, strictPort: true,
    headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' },
  },
})
