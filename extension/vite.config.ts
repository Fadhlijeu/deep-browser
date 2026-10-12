import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  root: resolve(__dirname, 'sidepanel-src'),
  build: {
    outDir: resolve(__dirname, 'sidepanel/dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'sidepanel-src/index.html'),
    },
  },
});
