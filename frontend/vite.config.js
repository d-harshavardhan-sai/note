// note/frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { // <-- Make sure this is present and correct
    outDir: '../backend/dist', // Output to the 'dist' folder inside 'backend' (relative to frontend)
    emptyOutDir: true, // Clear the output directory before building
  }
})