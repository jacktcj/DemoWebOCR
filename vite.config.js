import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Use relative asset paths so the app works on GitHub Pages project URLs.
  base: './',
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        brandKit: fileURLToPath(new URL('./brand-kit.html', import.meta.url)),
      },
    },
  },
});
