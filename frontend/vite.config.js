// note/frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // REMOVE THE ENTIRE BUILD OBJECT to use Vite's default output behavior
  // build: {
  //   outDir: '../backend/dist', // DELETE THIS LINE
  //   emptyOutDir: true,          // DELETE THIS LINE
  // }
})