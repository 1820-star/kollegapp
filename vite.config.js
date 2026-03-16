import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// when deploying to GitHub Pages under repo kollegapp, set base to "/kollegapp/"
// using relative paths "./" also works if you host root, but pages uses /repo/ path.
export default defineConfig({
  base: '/kollegapp/',
  plugins: [react()],
  build: {
    outDir: 'dist'
  }
});