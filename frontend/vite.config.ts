import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        story: resolve(__dirname, 'views/story.html'),
        testBackend: resolve(__dirname, 'views/test-backend.html'),
        testBackbook: resolve(__dirname, 'views/test-backbook.html'),
        testFlip: resolve(__dirname, 'views/test-flip.html'),
      },
    },
  },
  server: {
    port: 3001,
    open: true,
  },
});
