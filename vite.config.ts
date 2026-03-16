import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/rubakas-org/',
  build: {
    rollupOptions: {
      input: {
        // Główna strona
        main: resolve(__dirname, 'index.html'),
        
        login: resolve(__dirname, 'pages/login.html'),
        profile: resolve(__dirname, 'pages/profile.html'),
        dmca: resolve(__dirname, 'pages/dmca.html'),
        privacy: resolve(__dirname, 'pages/privacy.html'),
        terms: resolve(__dirname, 'pages/terms.html'),
      },
    },
  },
});