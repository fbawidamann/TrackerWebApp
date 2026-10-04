import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from "@fitness/shared";
import type { WorkoutView } from "./training";

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

export interface GroupCount { group: MuscleGroup; sets: number }

/**
 * Completed work sets per muscle group in the range, by the exercise's primary muscle. All groups are returned
 * (also 0) in a fixed order, so a group you skipped shows up as an empty bar instead of disappearing.
 */
export function setsPerGroup(
  workouts: WorkoutView[], exercises: Map<string, Exercise>, groupOf: (e: Exercise) => MuscleGroup,
  from: Date | null, to: Date | null = null,
): GroupCount[] {
  const counts = new Map<MuscleGroup, number>(MUSCLE_GROUPS.map((g) => [g, 0]));
  for (const w of workouts) {
    if (!inRange(w.start, from, to)) continue;
    for (const e of w.exercises) {
      const ex = exercises.get(e.ae.exerciseId);
      const g = ex ? groupOf(ex) : "Other";
      const n = e.sets.filter((s) => s.completedAt !== null && s.setType !== "warmup").length;
      counts.set(g, (counts.get(g) ?? 0) + n);
    }
  }
  return MUSCLE_GROUPS.map((group) => ({ group, sets: counts.get(group) ?? 0 }))
    .filter((g) => g.group !== "Other" || g.sets > 0);
}

/** Workouts per week for the last `weeks` weeks (oldest first), for the bar chart. */
export function weeklyWorkouts(workouts: WorkoutView[], weekStartOf: (d: Date) => Date, now: Date, weeks = 12): Array<{ start: Date; count: number }> {
  const current = weekStartOf(now);
  const out = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7 * (weeks - 1 - i));
    return { start, count: 0 };
  });
  for (const w of workouts) {
    const ws = weekStartOf(w.start).getTime();
    const slot = out.find((o) => o.start.getTime() === ws);
    if (slot) slot.count++;
  }
  return out;
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
