import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/algebra-api': {
        target: 'http://localhost/Algebra_Assess_Ai',
        changeOrigin: true,
      },
    },
  },
});
