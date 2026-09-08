import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // @monsport/shared build ra CommonJS (de apps/api require() duoc truc tiep).
  // Vite mac dinh khong pre-bundle package workspace lien ket qua filesystem,
  // nen phai ep vao optimizeDeps de esbuild phan tich dung cac export CJS
  // (schema Zod) thay vi import ESM tho roi bao "does not provide an export".
  optimizeDeps: {
    include: ['@monsport/shared'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
