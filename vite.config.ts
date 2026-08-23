import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { lodgeAuthPlugin } from './server/vite-plugin.ts'

export default defineConfig({
  plugins: [react(), lodgeAuthPlugin()],
  base: process.env.VITE_BASE ?? '/',
})
