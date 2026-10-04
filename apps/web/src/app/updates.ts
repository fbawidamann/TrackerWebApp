import { useSyncExternalStore } from "react";

/**
 * App updates on the iPhone (docs/architecture/pwa-updates.md).
 * iOS keeps a home-screen PWA alive in the background for days and does not look for a new service worker
 * when it is resumed. So the app checks itself whenever it comes back to the foreground (and every 30 min while
 * open). A found update waits until the user taps "Reload" in the banner: never an automatic reload, so a
 * running workout or a half-typed value is never interrupted.
 */

let ready = false;
let apply: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Called by the service worker registration when a new version is installed and waiting. */
export function setUpdateReady(applyFn: () => Promise<void>): void {
  apply = applyFn;
  ready = true;
  emit();
}

export function useUpdateReady(): boolean {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => ready,
    () => false,
  );
}

/** Activates the waiting service worker and reloads the page. */
export async function applyUpdate(): Promise<void> {
  if (apply) await apply();
}

export const FOREGROUND_MIN_GAP_MS = 60_000;
export const INTERVAL_MS = 30 * 60_000;

/** Looks for a new version when the app returns to the foreground (at most once a minute) and every 30 min. */
export function watchForUpdates(reg: { update(): Promise<unknown> }, now: () => number = Date.now): () => void {
  let last = now();
  const check = () => {
    if (document.visibilityState !== "visible" || !navigator.onLine) return;
    if (now() - last < FOREGROUND_MIN_GAP_MS) return;
    last = now();
    reg.update().catch(() => { /* offline or server hiccup: try again next time */ });
  };
  const onVis = () => check();
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("focus", onVis);
  window.addEventListener("pageshow", onVis);
  const id = window.setInterval(check, INTERVAL_MS);
  return () => {
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("focus", onVis);
    window.removeEventListener("pageshow", onVis);
    window.clearInterval(id);
  };
}

/** Test helper. */
export function resetUpdateState(): void {
  ready = false;
  apply = null;
  emit();
}
