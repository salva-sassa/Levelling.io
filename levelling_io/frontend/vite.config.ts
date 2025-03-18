import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    allowedHosts: [
      '.ngrok-free.app' // Allow any Ngrok subdomain
    ],
    host: true // Optional — allows access from external networks
  }
})