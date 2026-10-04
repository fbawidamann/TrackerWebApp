import type { StravaRunsResponse, StravaStatus, TrackSummary } from "@fitness/shared";
import { useSyncExternalStore } from "react";
import { api } from "@/api/client";
import { importRun } from "@/db/actions";

/**
 * Strava on the client (docs/adr/0009-strava.md). The server holds the tokens and talks to Strava;
 * the client asks it for new runs and saves them with the same importRun as GPX/FIT files,
 * so they sync to the other devices like any other run.
 */

let status: StravaStatus | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Last known connection state (null until loaded once). */
export function useStravaStatus(): StravaStatus | null {
  return useSyncExternalStore(subscribe, () => status, () => status);
}

export async function loadStravaStatus(): Promise<StravaStatus> {
  status = await api<StravaStatus>("GET", "/api/strava/status");
  emit();
  return status;
}

/** Opens Strava's consent page. Strava sends the browser back to /api/strava/callback, which shows a "done" page. */
export async function connectStrava(): Promise<void> {
  const { url } = await api<{ url: string }>("POST", "/api/strava/connect", {});
  window.location.assign(url);
}

export async function disconnectStrava(): Promise<void> {
  await api("POST", "/api/strava/disconnect", {});
  await loadStravaStatus();
}

/**
 * Totals from Strava win over the ones computed from the downsampled streams (like FIT session totals).
 * Zero distance/time means "unknown" (e.g. manual entries) and is left to the track; missing values are dropped.
 */
export function stravaTotals(t: StravaRunsResponse["runs"][number]["totals"]): Partial<TrackSummary> {
  const out: Partial<TrackSummary> = {};
  if (t.distanceM > 0) out.distanceM = t.distanceM;
  if (t.movingTimeS > 0) out.movingTimeS = t.movingTimeS;
  if (t.elapsedS > 0) out.elapsedS = t.elapsedS;
  if (t.elevationGainM !== null) out.elevationGainM = t.elevationGainM;
  if (t.avgHr !== null) out.avgHr = t.avgHr;
  if (t.maxHr !== null) out.maxHr = t.maxHr;
  return out;
}

let running: Promise<{ added: number; skipped: number }> | null = null;

/**
 * Imports new Strava runs: asks the server batch by batch (10 runs), saves them, then confirms the batch so the
 * server moves its cursor on. Already known runs (same Strava id, or a GPX/FIT of the same run) are skipped.
 * Concurrent calls share one run.
 */
export function importStravaRuns(maxBatches = 5): Promise<{ added: number; skipped: number }> {
  running ??= (async () => {
    let added = 0, skipped = 0;
    try {
      for (let i = 0; i < maxBatches; i++) {
        const res = await api<StravaRunsResponse>("GET", "/api/strava/runs");
        for (const r of res.runs) {
          const out = await importRun({
            source: "strava", name: r.name || null, startedAt: new Date(r.startedAt), points: r.points, stravaId: r.stravaId,
            totals: stravaTotals(r.totals),
          });
          if (out.duplicate) skipped++; else added++;
        }
        await api("POST", "/api/strava/ack", { next: res.next });
        if (!res.hasMore) break;
      }
    } finally {
      running = null;
      void loadStravaStatus().catch(() => {});
    }
    return { added, skipped };
  })();
  return running;
}

const AUTO_KEY = "strava.lastAuto";
const AUTO_EVERY_MS = 15 * 60_000;

/** On app start / return to the app: import new runs, at most every 15 min, only when connected and online. */
export async function autoImportStrava(): Promise<number> {
  if (!navigator.onLine) return 0;
  const last = Number(localStorage.getItem(AUTO_KEY) ?? 0);
  if (Date.now() - last < AUTO_EVERY_MS) return 0;
  localStorage.setItem(AUTO_KEY, String(Date.now()));
  const s = await loadStravaStatus();
  if (!s.available || !s.connected) return 0;
  return (await importStravaRuns(2)).added;
}

/** For tests. */
export function resetStravaState(): void {
  status = null;
  running = null;
  emit();
}
