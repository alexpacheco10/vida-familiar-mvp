import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/vida-familiar-mvp/',
  plugins: [react()]
});
