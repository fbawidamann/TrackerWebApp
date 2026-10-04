# App updates (PWA, iPhone)

Status: **decided** (2026-10-04, requested by Florian). Code: `apps/web/src/app/updates.ts`, `UpdateBanner.tsx`, `main.tsx`.

## Problem
The app is installed on the iPhone home screen. iOS keeps such a PWA alive in the background for days and does not
look for a new service worker when it is resumed. With the old `registerType: "autoUpdate"` a deploy only reached the
phone after the app was fully closed (swiped away) and reopened.

## Decision
- `vite-plugin-pwa` uses `registerType: "prompt"`: a new service worker is installed in the background and then **waits**.
- The app checks for a new version itself (`registration.update()`):
  - whenever it returns to the foreground (`visibilitychange`, `focus`, `pageshow`), at most every 10 s;
  - every 30 minutes while it stays open;
  - never while offline or hidden. A failed check is silently retried next time.
- When a new version is waiting, a banner appears **at the top** (below the status bar):
  `New version available · Reload` / `Neue Version verfügbar · Neu laden`.
  At the top, so it never covers the rest timer, mini bar or nav at the bottom.
- **Reload only on tap, never automatically**: a running workout or a half-typed value is never interrupted. Reloading
  is safe at any time anyway, because all data lives in IndexedDB (local-first) and the active workout resumes.
- If the user ignores the banner, the new version is used on the next full app start (normal service worker behaviour).

## Fix 2026-10-04: banner only appeared after a restart
Florian saw the banner only after fully restarting the app, not when resuming it from the background. Two causes:
1. When the new version finishes installing while iOS has the app **suspended**, the page never receives the
   `updatefound`/`statechange` events, so nothing reported "waiting".
2. `workbox-window` (used by `registerSW`) treats an update found more than 60 s after page load as "external"
   and stops listening for further updates, which is exactly the situation of an app that stays open for days.

So detection no longer relies on `registerSW`'s `onNeedRefresh`. `app/updates.ts` works on the raw
`ServiceWorkerRegistration`: on every return to the foreground it **re-reads `registration.waiting`** (catches an
update installed while suspended), then calls `update()` and checks again; it also listens to `updatefound` and
`statechange`. "Reload" posts `SKIP_WAITING` to the waiting worker and reloads on `controllerchange` (fallback
after 4 s). Only counts as an update when a service worker already controls the page (not the first install).
Tests cover each case, including the suspended-install one (`updates.test.tsx`).

## Server side
`/sw.js`, `/workbox-*`, the manifest and the HTML are served with `Cache-Control: no-cache` (apps/api/src/app.ts),
so `registration.update()` always sees the newest service worker.
