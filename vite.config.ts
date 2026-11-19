import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The bank version is a short hash of everything in content/, so it changes exactly when the
// questions change. It shows in the home footer next to the count.
const contentDir = new URL('./content/', import.meta.url);
const hash = createHash('sha1');
for (const f of readdirSync(contentDir).sort()) hash.update(f).update(readFileSync(new URL(f, contentDir)));
const bankVersion = hash.digest('hex').slice(0, 7);
const buildTime = new Date().toLocaleString('en-US', {
  timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

export default defineConfig({
  define: {
    __BANK_VERSION__: JSON.stringify(bankVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Prompt mode: the app shows "New questions available, tap to update" (src/ui/updates.ts, shown on Home).
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ops School Study',
        short_name: 'Ops School',
        description: 'Private study app for the Operations School final.',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        background_color: '#090C5D',
        theme_color: '#090C5D',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
