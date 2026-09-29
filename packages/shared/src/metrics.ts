import type { SetType } from "./schemas";

/** Minimal set shape the metrics need. */
export interface MetricSet {
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  completedAt: string | null;
}

/** Estimated 1RM (Epley). Only meaningful for 1–12 reps; returns null otherwise. */
export function epley1rm(weightKg: number, reps: number): number | null {
  if (reps < 1 || reps > 12 || weightKg <= 0) return null;
  return weightKg * (1 + reps / 30);
}

/** Sets that count for metrics: completed, and normal (plus warm-ups if the setting allows). */
export function countingSets<T extends MetricSet>(sets: readonly T[], includeWarmups = false): T[] {
  return sets.filter((s) => s.completedAt !== null && (s.setType !== "warmup" || includeWarmups));
}

/** Heaviest weight among counting sets, or null. */
export function heaviestWeight(sets: readonly MetricSet[], includeWarmups = false): number | null {
  let best: number | null = null;
  for (const s of countingSets(sets, includeWarmups)) {
    if (s.weightKg !== null && (best === null || s.weightKg > best)) best = s.weightKg;
  }
  return best;
}

/** Most reps in one counting set, or null. */
export function bestReps(sets: readonly MetricSet[], includeWarmups = false): number | null {
  let best: number | null = null;
  for (const s of countingSets(sets, includeWarmups)) {
    if (s.reps !== null && (best === null || s.reps > best)) best = s.reps;
  }
  return best;
}

/** Best estimated 1RM over counting sets, or null. */
export function bestE1rm(sets: readonly MetricSet[]): number | null {
  let best: number | null = null;
  for (const s of countingSets(sets)) {
    if (s.weightKg === null || s.reps === null) continue;
    const e = epley1rm(s.weightKg, s.reps);
    if (e !== null && (best === null || e > best)) best = e;
  }
  return best;
}

export interface SessionValue {
  key: string;
  value: number | null;
}

/**
 * Given sessions in chronological order, returns the keys of sessions that set a PR
 * (value higher than every earlier session). The first session is a baseline, not a PR.
 */
export function prSessions(sessions: readonly SessionValue[]): Map<string, { value: number; previous: number }> {
  const out = new Map<string, { value: number; previous: number }>();
  let best: number | null = null;
  for (const s of sessions) {
    if (s.value === null) continue;
    if (best !== null && s.value > best) out.set(s.key, { value: s.value, previous: best });
    if (best === null || s.value > best) best = s.value;
  }
  return out;
}
