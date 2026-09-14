import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './'  → the built app works from any folder on IIS
// (e.g. http://server/log-tracker/ ) without rewrites.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: false },
  build: { outDir: 'dist', assetsDir: 'assets', emptyOutDir: true },
});
