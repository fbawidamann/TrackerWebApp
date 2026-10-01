import { BEST_EFFORTS, paceOf, type Activity, type Run } from "@fitness/shared";

export interface RunView {
  activity: Activity;
  run: Run;
  start: Date;
  /** Seconds per km over the moving time, or null without distance. */
  pace: number | null;
}

/** Completed, alive runs joined with their totals, newest first. */
export function buildRuns(activities: Activity[], runs: Run[]): RunView[] {
  const byAct = new Map(runs.filter((r) => r.deletedAt === null).map((r) => [r.activityId, r]));
  return activities
    .filter((a) => a.type === "run" && a.deletedAt === null && a.status === "completed" && byAct.has(a.id))
    .map((a) => {
      const run = byAct.get(a.id)!;
      return { activity: a, run, start: new Date(a.startedAt), pace: paceOf(run.distanceM, run.movingTimeS) };
    })
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

export interface PeriodSummary {
  count: number;
  distanceM: number;
  timeS: number;
  elevationM: number;
  longestM: number;
  pace: number | null;
}

/** Totals of the runs that started in [from, to). */
export function summarize(runs: RunView[], from: Date | null, to: Date | null = null): PeriodSummary {
  const inRange = runs.filter((r) => (!from || r.start >= from) && (!to || r.start < to));
  const distanceM = inRange.reduce((s, r) => s + r.run.distanceM, 0);
  const timeS = inRange.reduce((s, r) => s + r.run.movingTimeS, 0);
  return {
    count: inRange.length, distanceM, timeS,
    elevationM: inRange.reduce((s, r) => s + (r.run.elevationGainM ?? 0), 0),
    longestM: inRange.reduce((m, r) => Math.max(m, r.run.distanceM), 0),
    pace: paceOf(distanceM, timeS),
  };
}

/** Distance per week for the last `weeks` weeks (oldest first), including empty weeks. */
export function weeklyDistance(runs: RunView[], weekStartOf: (d: Date) => Date, now: Date, weeks = 12): Array<{ start: Date; distanceM: number; count: number }> {
  const current = weekStartOf(now);
  const out = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7 * (weeks - 1 - i));
    return { start, distanceM: 0, count: 0 };
  });
  const first = out[0]!.start.getTime();
  for (const r of runs) {
    const t = weekStartOf(r.start).getTime();
    if (t < first) continue;
    const bucket = out.find((w) => w.start.getTime() === t);
    if (bucket) { bucket.distanceM += r.run.distanceM; bucket.count++; }
  }
  return out;
}

export interface PersonalBest {
  key: string;
  label: string;
  /** The exact distance in metres (1 mile = 1609.344). */
  m: number;
  timeS: number;
  activityId: string;
  date: Date;
}

/** The fastest effort for every standard distance over all runs (the earliest wins a tie). */
export function personalBests(runs: RunView[]): PersonalBest[] {
  const out: PersonalBest[] = [];
  for (const e of BEST_EFFORTS) {
    let best: PersonalBest | null = null;
    for (const r of runs) {
      const t = r.run.efforts[e.key];
      if (t === undefined) continue;
      if (!best || t < best.timeS || (t === best.timeS && r.start < best.date)) {
        best = { key: e.key, label: e.label, m: e.m, timeS: t, activityId: r.activity.id, date: r.start };
      }
    }
    if (best) out.push(best);
  }
  return out;
}

/** Best-effort keys where this run holds the all-time record. */
export function recordsSetBy(activityId: string, bests: PersonalBest[]): Set<string> {
  return new Set(bests.filter((b) => b.activityId === activityId).map((b) => b.key));
}
