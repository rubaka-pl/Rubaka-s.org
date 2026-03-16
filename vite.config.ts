import { defineConfig } from 'vite';

export default defineConfig({
  base: '/rubakas-org/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        login: 'pages/login.html',
        profile: 'pages/profile.html',
        dmca: 'pages/dmca.html',
        privacy: 'pages/privacy.html',
        terms: 'pages/terms.html',
      },
    },
  },
});