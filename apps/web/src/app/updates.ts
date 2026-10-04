import { useSyncExternalStore } from "react";

/**
 * App updates on the iPhone (docs/architecture/pwa-updates.md).
 * iOS keeps a home-screen PWA alive in the background for days and does not look for a new service worker
 * when it is resumed. So the app checks itself whenever it comes back to the foreground (and every 30 min while
 * open). A found update waits until the user taps "Reload" in the banner: never an automatic reload, so a
 * running workout or a half-typed value is never interrupted.
 *
 * Detection works on the raw ServiceWorkerRegistration and re-reads `registration.waiting` on every return to
 * the foreground. Events alone are not enough on iOS: when the new version finishes installing while the app is
 * suspended, the `statechange`/`waiting` events are never seen by the page, so the banner only showed after a
 * restart (found 2026-10-04).
 */

let ready = false;
let apply: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Marks an update as ready (idempotent). */
export function setUpdateReady(applyFn: () => Promise<void>): void {
  apply = applyFn;
  if (ready) return;
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

export const FOREGROUND_MIN_GAP_MS = 10_000;
export const INTERVAL_MS = 30 * 60_000;
export const RELOAD_FALLBACK_MS = 4_000;

type Sw = EventTarget & { state: string; postMessage(msg: unknown): void };
/** The parts of ServiceWorkerRegistration used here (small, so tests can fake it). */
export interface RegLike extends EventTarget {
  waiting: Sw | null;
  installing: Sw | null;
  update(): Promise<unknown>;
}
export interface SwEnv {
  hasController: () => boolean;
  onControllerChange: (cb: () => void) => void;
  reload: () => void;
}

const browserEnv = (): SwEnv => ({
  hasController: () => !!navigator.serviceWorker?.controller,
  onControllerChange: (cb) => navigator.serviceWorker?.addEventListener("controllerchange", cb, { once: true }),
  reload: () => window.location.reload(),
});

/** Tells the waiting service worker to take over, then reloads once it controls the page (fallback after 4 s). */
export function makeApply(reg: RegLike, env: SwEnv): () => Promise<void> {
  return async () => {
    const waiting = reg.waiting;
    if (!waiting) { env.reload(); return; }
    let done = false;
    const go = () => { if (!done) { done = true; env.reload(); } };
    env.onControllerChange(go);
    window.setTimeout(go, RELOAD_FALLBACK_MS);
    waiting.postMessage({ type: "SKIP_WAITING" });
  };
}

/**
 * Watches the registration: shows the banner for a waiting update (also one that finished installing while the
 * app was suspended), and looks for new versions on every return to the foreground and every 30 minutes.
 */
export function watchForUpdates(reg: RegLike, env: SwEnv = browserEnv(), now: () => number = Date.now): () => void {
  // Only an update if a service worker already controls the page (the very first install is not an update).
  const report = () => { if (reg.waiting && env.hasController()) setUpdateReady(makeApply(reg, env)); };
  const tracked = new WeakSet<Sw>();
  const track = (sw: Sw | null) => {
    if (!sw || tracked.has(sw)) return;
    tracked.add(sw);
    sw.addEventListener("statechange", () => { if (sw.state === "installed") report(); });
  };
  const onFound = () => track(reg.installing);
  reg.addEventListener("updatefound", onFound);
  report();
  track(reg.installing);

  let last = now();
  const check = () => {
    if (document.visibilityState !== "visible") return;
    report(); // may have finished installing while we were suspended
    if (!navigator.onLine || now() - last < FOREGROUND_MIN_GAP_MS) return;
    last = now();
    reg.update().then(() => { track(reg.installing); report(); }, () => { /* offline or server hiccup: next time */ });
  };
  const onVis = () => check();
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("focus", onVis);
  window.addEventListener("pageshow", onVis);
  const id = window.setInterval(check, INTERVAL_MS);
  return () => {
    reg.removeEventListener("updatefound", onFound);
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
