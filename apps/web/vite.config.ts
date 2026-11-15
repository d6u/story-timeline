import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const apiUrl = process.env.API_URL ?? 'http://localhost:4000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // The browser calls /graphql on its own origin; Vite forwards it to the API during development.
  server: { port: 5173, strictPort: true, proxy: { '/graphql': apiUrl } },
  build: { chunkSizeWarningLimit: 1000 },
  test: { environment: 'node' },
})
