import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Project Pages URL: https://joseph-pq.github.io/yugioh-simulator/
  base: process.env.NODE_ENV === 'production' ? '/yugioh-simulator/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
