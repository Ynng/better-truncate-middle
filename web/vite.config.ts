import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        stress: 'stress.html',
      },
    },
  },
  server: {
    allowedHosts: true,
  },
});
