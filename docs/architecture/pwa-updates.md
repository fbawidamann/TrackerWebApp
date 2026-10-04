# App updates (PWA, iPhone)

Status: **decided** (2026-10-04, requested by Florian). Code: `apps/web/src/app/updates.ts`, `UpdateBanner.tsx`, `main.tsx`.

## Problem
The app is installed on the iPhone home screen. iOS keeps such a PWA alive in the background for days and does not
look for a new service worker when it is resumed. With the old `registerType: "autoUpdate"` a deploy only reached the
phone after the app was fully closed (swiped away) and reopened.

## Decision
- `vite-plugin-pwa` uses `registerType: "prompt"`: a new service worker is installed in the background and then **waits**.
- The app checks for a new version itself (`registration.update()`):
  - whenever it returns to the foreground (`visibilitychange`, `focus`, `pageshow`), at most once a minute;
  - every 30 minutes while it stays open;
  - never while offline or hidden. A failed check is silently retried next time.
- When a new version is waiting, a banner appears **at the top** (below the status bar):
  `New version available · Reload` / `Neue Version verfügbar · Neu laden`.
  At the top, so it never covers the rest timer, mini bar or nav at the bottom.
- **Reload only on tap, never automatically**: a running workout or a half-typed value is never interrupted. Reloading
  is safe at any time anyway, because all data lives in IndexedDB (local-first) and the active workout resumes.
- If the user ignores the banner, the new version is used on the next full app start (normal service worker behaviour).

## Server side
`/sw.js`, `/workbox-*`, the manifest and the HTML are served with `Cache-Control: no-cache` (apps/api/src/app.ts),
so `registration.update()` always sees the newest service worker.
