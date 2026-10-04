# ADR 0008: Self-hosted font instead of Google Fonts

Status: **accepted** (2026-10-04, requested by Florian)

## Context
IBM Plex Sans was loaded from `fonts.googleapis.com` / `fonts.gstatic.com`. Every app start therefore sent the
user's IP address to Google. The Munich regional court (LG München I, 20 Jan 2022, 3 O 17493/20) ruled that
embedding Google Fonts this way without consent violates the GDPR. It also meant the very first offline start
had no font, because the service worker only cached it after a successful online load.

## Decision
- The font is bundled with the app from the npm package **`@fontsource/ibm-plex-sans`** (licence SIL OFL 1.1,
  which allows bundling and redistribution).
- Only what the UI uses is imported in `apps/web/src/main.tsx`: weights **400, 500, 600**, subsets **Latin** and
  **Latin Extended** (covers German umlauts and ß). `font-display: swap` comes from the package.
- Vite puts the `.woff2` files into `dist/assets/` with hashed names; the service worker precaches them
  (`globPatterns` includes `woff2`), so the font works offline from the first start.
- The Google preconnect/stylesheet links in `index.html` and the Google Fonts runtime-cache rule in
  `vite.config.ts` are removed. The app makes **no requests to third-party servers** anymore.

## Consequences
- No IP address goes to Google; no consent banner needed for fonts.
- About 6 small woff2 files (~20–30 kB each) are part of the app bundle.
- Font updates come with `npm update`, not automatically.
