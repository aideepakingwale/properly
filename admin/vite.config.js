/**
 * @file        vite.config.js
 * @description Vite build config for admin console — dev proxy to backend, __API_URL__ define injection
 * @module      Build
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || ''),
  },
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
