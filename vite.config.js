import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use relative asset paths so the app works on Cloudflare root and subpaths.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist'
  }
});