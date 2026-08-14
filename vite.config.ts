import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Project GitHub Pages URL: https://dakuy.github.io/restaurant-finder/
export default defineConfig({
  plugins: [react()],
  base: '/restaurant-finder/',
})
