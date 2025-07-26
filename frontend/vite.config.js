import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // REMOVE THE BUILD CONFIGURATION HERE:
  // build: {
  //   outDir: '../backend/dist', // This caused issues with path resolution in Render
  //   emptyOutDir: true,
  // }
})