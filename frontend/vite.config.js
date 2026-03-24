/**
 * @file        vite.config.js
 * @description Vite build config for parent/child frontend — dev proxy and VITE_API_URL injection
 * @module      Build
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    resolve: { alias: { '@': resolve(__dirname, 'src') } },
    define: { '__API_URL__': JSON.stringify(env.VITE_API_URL || '/api') },
    server: {
      port: 5173,
      proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: { output: { manualChunks: { vendor: ['react','react-dom','react-router-dom','axios'] } } },
    },
  };
});
