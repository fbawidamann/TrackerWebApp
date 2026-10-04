import { bestE1rm, MUSCLE_GROUPS, type Exercise, type MuscleGroup } from "@fitness/shared";
import type { ExerciseSession, PrEvent, WorkoutView } from "./training";

/** Training statistics for the Stats screen (docs/design/screens/stats.md). Pure functions, no I/O. */

export interface GymSummary {
  workouts: number;
  /** Completed work sets (warm-ups excluded). */
  sets: number;
  minutes: number;
  /** Total volume in kg: weight × reps over completed work sets. */
  volumeKg: number;
  prs: number;
  avgMinutes: number;
}

const workSets = (w: WorkoutView) =>
  w.exercises.flatMap((e) => e.sets).filter((s) => s.completedAt !== null && s.setType !== "warmup");

export function inRange(d: Date, from: Date | null, to: Date | null = null): boolean {
  return (from === null || d >= from) && (to === null || d < to);
}

export function gymSummary(workouts: WorkoutView[], from: Date | null, to: Date | null = null): GymSummary {
  const list = workouts.filter((w) => inRange(w.start, from, to));
  let sets = 0, minutes = 0, volumeKg = 0, prs = 0;
  for (const w of list) {
    const ws = workSets(w);
    sets += ws.length;
    minutes += w.durationMin;
    prs += w.prCount;
    for (const s of ws) if (s.weightKg !== null && s.reps !== null) volumeKg += s.weightKg * s.reps;
  }
  return { workouts: list.length, sets, minutes, volumeKg, prs, avgMinutes: list.length ? Math.round(minutes / list.length) : 0 };
}

export interface GroupCount {
  group: MuscleGroup;
  sets: number;
  /** The exercises behind the bar (drill-down), most sets first. */
  exercises: Array<{ exerciseId: string; sets: number }>;
}

/**
 * Completed work sets per muscle group in the range, by the exercise's primary muscle. All groups are returned
 * (also 0) in a fixed order, so a group you skipped shows up as an empty bar instead of disappearing.
 */
export function setsPerGroup(
  workouts: WorkoutView[], exercises: Map<string, Exercise>, groupOf: (e: Exercise) => MuscleGroup,
  from: Date | null, to: Date | null = null,
): GroupCount[] {
  const counts = new Map<MuscleGroup, Map<string, number>>(MUSCLE_GROUPS.map((g) => [g, new Map()]));
  for (const w of workouts) {
    if (!inRange(w.start, from, to)) continue;
    for (const e of w.exercises) {
      const ex = exercises.get(e.ae.exerciseId);
      const g = ex ? groupOf(ex) : "Other";
      const n = e.sets.filter((s) => s.completedAt !== null && s.setType !== "warmup").length;
      if (!n) continue;
      const m = counts.get(g)!;
      m.set(e.ae.exerciseId, (m.get(e.ae.exerciseId) ?? 0) + n);
    }
  }
  return MUSCLE_GROUPS.map((group) => {
    const list = [...counts.get(group)!].map(([exerciseId, sets]) => ({ exerciseId, sets })).sort((a, b) => b.sets - a.sets);
    return { group, sets: list.reduce((n, x) => n + x.sets, 0), exercises: list };
  }).filter((g) => g.group !== "Other" || g.sets > 0);
}

export interface TopExercise { exerciseId: string; sessions: number; sets: number }

/** Most trained exercises in the range, by number of sessions, then sets. */
export function topExercises(workouts: WorkoutView[], from: Date | null, to: Date | null = null, limit = 5): TopExercise[] {
  const map = new Map<string, TopExercise>();
  for (const w of workouts) {
    if (!inRange(w.start, from, to)) continue;
    for (const e of w.exercises) {
      const n = e.sets.filter((s) => s.completedAt !== null && s.setType !== "warmup").length;
      if (!n) continue;
      const cur = map.get(e.ae.exerciseId) ?? { exerciseId: e.ae.exerciseId, sessions: 0, sets: 0 };
      cur.sessions++;
      cur.sets += n;
      map.set(e.ae.exerciseId, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions || b.sets - a.sets).slice(0, limit);
}

/* ---------- Periods and comparison ---------- */

export type Period = "week" | "month" | "year" | "all";

export interface PeriodRange {
  /** Start of the period (null = all time). */
  from: Date | null;
  /** Comparison window: the same stretch of the previous period, up to the same point (e.g. 1–4 Sep for 1–4 Oct). */
  prevFrom: Date | null;
  prevTo: Date | null;
}

/**
 * The selected period and its "so far" comparison window. Comparing a running month with the *same days* of the
 * previous month keeps the arrows fair: on the 4th you are not measured against a whole finished month.
 * Day-of-month is clamped (31 Mar compares with 28/29 Feb).
 */
export function periodRange(period: Period, now: Date, weekStartOf: (d: Date) => Date): PeriodRange {
  if (period === "all") return { from: null, prevFrom: null, prevTo: null };
  const y = now.getFullYear(), m = now.getMonth();
  if (period === "week") {
    const from = weekStartOf(now);
    const prevFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 7);
    return { from, prevFrom, prevTo: new Date(y, m, now.getDate() - 7, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()) };
  }
  const shift = (yy: number, mm: number) => {
    const last = new Date(yy, mm + 1, 0).getDate();
    return new Date(yy, mm, Math.min(now.getDate(), last), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  };
  if (period === "month") return { from: new Date(y, m, 1), prevFrom: new Date(y, m - 1, 1), prevTo: shift(m === 0 ? y - 1 : y, (m + 11) % 12) };
  return { from: new Date(y, 0, 1), prevFrom: new Date(y - 1, 0, 1), prevTo: shift(y - 1, m) };
}

export interface Delta {
  /** 1 = up, -1 = down, 0 = unchanged. */
  dir: 1 | 0 | -1;
  /** Absolute difference (cur − prev). */
  diff: number;
  /** Relative change in percent, rounded; null when there is nothing to compare with (prev = 0). */
  pct: number | null;
}

/** Change from `prev` to `cur`. Null when neither has a value (nothing to say). */
export function delta(cur: number, prev: number): Delta | null {
  if (cur === 0 && prev === 0) return null;
  const diff = cur - prev;
  return { dir: diff > 0 ? 1 : diff < 0 ? -1 : 0, diff, pct: prev > 0 ? Math.round((diff / prev) * 100) : null };
}

/* ---------- Consistency (weekly goal) ---------- */

export interface Consistency {
  /** Weeks in a row (ending now) that reached the goal. The running week counts once it is reached. */
  streak: number;
  /** Finished weeks (of the last `weeks`) that reached the goal / that were counted (since the first workout). */
  hit: number;
  counted: number;
  /** Average workouts per counted finished week. */
  avgPerWeek: number;
}

export function consistency(workouts: WorkoutView[], weekStartOf: (d: Date) => Date, now: Date, goal: number, weeks = 12): Consistency {
  const perWeek = new Map<number, number>();
  let first: number | null = null;
  for (const w of workouts) {
    const k = weekStartOf(w.start).getTime();
    perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
    if (first === null || k < first) first = k;
  }
  const count = (d: Date) => perWeek.get(d.getTime()) ?? 0;
  const back = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7 * n);
  const current = weekStartOf(now);

  let streak = 0;
  let wk = count(current) >= goal ? current : back(current, 1);
  while (count(wk) >= goal && goal > 0) { streak++; wk = back(wk, 1); }

  let hit = 0, counted = 0, total = 0;
  for (let i = 1; i <= weeks; i++) {
    const d = back(current, i);
    if (first === null || d.getTime() < first) break;
    counted++;
    total += count(d);
    if (count(d) >= goal) hit++;
  }
  return { streak, hit, counted, avgPerWeek: counted ? total / counted : 0 };
}

/* ---------- Muscle-group volume per week ---------- */

/** Below this many sets per week a main muscle group gets a "low" hint (well under the common ~10 sets guideline). */
export const LOW_SETS_PER_WEEK = 5;
/** The common guideline drawn as a marker on the bars. */
export const GUIDE_SETS_PER_WEEK = 10;
/** Groups that get the "low" hint. Core is trained a lot indirectly, "Other" is no muscle. */
export const FLAGGED_GROUPS: readonly MuscleGroup[] = ["Chest", "Back", "Shoulders", "Arms", "Legs"];

/**
 * How many weeks the period really covers, for "sets per week": from the later of period start and first workout,
 * until now. Null when it is shorter than two weeks: a per-week figure from a few days would be noise.
 */
export function weeksCovered(from: Date | null, firstWorkout: Date | null, now: Date): number | null {
  if (!firstWorkout) return null;
  const start = from && from > firstWorkout ? from : new Date(firstWorkout.getFullYear(), firstWorkout.getMonth(), firstWorkout.getDate());
  const days = (now.getTime() - start.getTime()) / 86_400_000;
  return days >= 14 ? days / 7 : null;
}

/* ---------- Strength: estimated 1RM per exercise ---------- */

export interface LiftTrend {
  exerciseId: string;
  /** Best estimated 1RM (Epley, 1–12 reps) in the period, or null (no weighted sets). */
  best: number | null;
  /** Best estimated 1RM in the comparison window, or null. */
  prev: number | null;
  /** Best e1RM of the last sessions up to now (oldest first), for the sparkline. */
  series: number[];
}

/** e1RM trend for the given exercises (e.g. the top exercises of the period). */
export function liftTrends(
  sessionsByExercise: Map<string, ExerciseSession[]>, exerciseIds: string[], range: PeriodRange, now: Date, points = 8,
): LiftTrend[] {
  return exerciseIds.map((exerciseId) => {
    const sessions = (sessionsByExercise.get(exerciseId) ?? []).filter((s) => s.date <= now);
    let best: number | null = null, prev: number | null = null;
    const series: number[] = [];
    for (const s of sessions) {
      const e = bestE1rm(s.sets);
      if (e === null) continue;
      series.push(e);
      if (inRange(s.date, range.from, null) && (best === null || e > best)) best = e;
      if (range.prevFrom && inRange(s.date, range.prevFrom, range.prevTo) && (prev === null || e > prev)) prev = e;
    }
    return { exerciseId, best, prev, series: series.slice(-points) };
  });
}

/** PRs (heaviest weight) set in the period, newest first. */
export function prsInPeriod(events: PrEvent[], from: Date | null, now: Date): PrEvent[] {
  return events.filter((e) => inRange(e.date, from, null) && e.date <= now).sort((a, b) => b.date.getTime() - a.date.getTime());
}

/* ---------- Consistency heatmap ---------- */

export interface HeatDay { date: Date; count: number; future: boolean }
export interface HeatWeek { start: Date; count: number; days: HeatDay[] }

/** The last `weeks` weeks (oldest first) as 7 days each, with workouts per day, for the consistency grid. */
export function dayGrid(workouts: WorkoutView[], weekStartOf: (d: Date) => Date, now: Date, weeks = 12): HeatWeek[] {
  const perDay = new Map<string, number>();
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  for (const w of workouts) perDay.set(key(w.start), (perDay.get(key(w.start)) ?? 0) + 1);
  const current = weekStartOf(now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7 * (weeks - 1 - i));
    const days = Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d);
      return { date, count: perDay.get(key(date)) ?? 0, future: date.getTime() > today };
    });
    return { start, count: days.reduce((n, d) => n + d.count, 0), days };
  });
}
