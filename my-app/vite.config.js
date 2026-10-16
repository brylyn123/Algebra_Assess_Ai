import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    exclude: ['node_modules', 'dist'],
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('mathlive')) return 'vendor-mathlive';
          if (id.includes('katex')) return 'vendor-katex';
          if (
            id.includes('@tiptap') ||
            id.includes('prosemirror') ||
            id.includes('@lezer') ||
            id.includes('crelt') ||
            id.includes('w3c-keyname') ||
            id.includes('markdown-it')
          ) {
            return 'vendor-editor';
          }
          if (
            id.includes('framer-motion') ||
            id.includes('@dnd-kit') ||
            id.includes('motion-dom') ||
            id.includes('motion-utils')
          ) {
            return 'vendor-ui';
          }
          if (
            id.includes('react') ||
            id.includes('scheduler') ||
            id.includes('axios') ||
            id.includes('object-assign')
          ) {
            return 'vendor-react';
          }
          return 'vendor';
        },
      },
    },
  },
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
