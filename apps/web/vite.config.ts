import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Artifact export service (services/artifacts). 127.0.0.1 avoids the
      // IPv6/Docker :8000 clash on macOS.
      '/api': {
        target: 'http://127.0.0.1:8742',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      // BFF (services/bff) — model-backed generation.
      '/bff': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/bff/, ''),
      },
    },
  },
});
