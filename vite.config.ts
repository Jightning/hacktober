import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  // Preserve the browser-facing host so the API can validate same-origin requests on any dev port.
  server: { proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } } },
});
