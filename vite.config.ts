import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, type PluginOption } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// VITE_BASE lets the same build run under a sub-path (GitHub Pages: /<repo>/).
const base = process.env.VITE_BASE ?? '/';

export default defineConfig(({ mode }) => {
  const isE2E = mode === 'e2e';
  const plugins: PluginOption[] = [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'icon-maskable.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '기타 연습',
        short_name: '기타',
        description: '완전 초보를 위한 체계적 어쿠스틱 기타 연습',
        lang: 'ko',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,json}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ];
  if (mode === 'https') plugins.push(basicSsl());
  return {
    base,
    plugins,
    define: {
      // Build-time constant: only the e2e build keeps test hooks; production DCE removes them.
      __GH_E2E__: JSON.stringify(isE2E),
    },
    worker: { format: 'es' },
    build: {
      target: 'es2022',
      sourcemap: false,
      outDir: isE2E ? 'dist-e2e' : 'dist',
      chunkSizeWarningLimit: 1500,
    },
    server: { host: mode === 'https' ? true : 'localhost' },
  };
});
