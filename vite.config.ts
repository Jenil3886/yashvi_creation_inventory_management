import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(() => {
  const isRender = !!process.env.RENDER;

  return {
    plugins: [
      react(),
      // Only use SSL in local development (SSL is handled by Render's proxy in deployment)
      ...(isRender ? [] : [basicSsl()]),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        devOptions: {
          enabled: false,
        },
        manifest: {
          name: 'Yashvi Creation Purchases',
          short_name: 'YC Purchases',
          description: 'Garment Wholesale Purchase & Inventory Management PWA',
          theme_color: '#090d16',
          background_color: '#090d16',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
      }),
    ],
    server: {
      // Use Render's assigned port when deployed, fallback to 5173 locally
      port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
      host: true, // Listen on all local interfaces so Android phones can test local Vite instance on WiFi
      allowedHosts: true as const, // Allow accessing the dev server from any proxy or tunnel domain
    },
  };
});
