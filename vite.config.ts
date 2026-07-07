import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the site from /readyreaders/
  base: process.env.NODE_ENV === 'production' ? '/readyreaders/' : '/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600, // phaser is a single large chunk
  },
  server: {
    host: true,
  },
});
