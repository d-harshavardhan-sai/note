import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { // <-- ADD THIS BUILD CONFIGURATION
    outDir: '../backend/dist', // Output to backend/dist folder
    emptyOutDir: true, // Clear the output directory before building
  }
})