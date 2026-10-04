import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Local development: the API runs on :3000 (npm run dev:api), the app on :5173.
  server: { proxy: { "/api": "http://localhost:3000" } },
  preview: { proxy: { "/api": "http://localhost:3000" } },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt", // new versions wait for a tap on the update banner (docs/architecture/pwa-updates.md)
      includeAssets: ["favicon.svg", "favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        name: "Fitness Tracker",
        short_name: "Fitness",
        description: "Log gym workouts, offline first.",
        theme_color: "#0a0c0f",
        background_color: "#0a0c0f",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // wasm = the barcode scanner (zxing, ~1 MB), precached so scanning starts fast; the lookup itself needs network.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,wasm}"],
        globIgnores: ["exercise-images/**"],
        navigateFallback: "/index.html",
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/exercise-images/"),
            handler: "CacheFirst",
            options: { cacheName: "exercise-images", expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          // No Google Fonts rule any more: the font is bundled and precached via globPatterns (woff2).
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
