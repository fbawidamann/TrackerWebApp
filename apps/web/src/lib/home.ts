import type { Exercise, MuscleGroup, RoutineExercise } from "@fitness/shared";
import type { RunView } from "./runStats";
import type { WorkoutView } from "./training";

/** Calculations for the Home screen (docs/design/screens/home.md). Pure functions, no I/O. */

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Whole calendar days from `d` to `now` (0 = same day). DST-safe: counts dates, not 24 h blocks. */
export function daysSince(d: Date, now: Date): number {
  return Math.round((midnight(now).getTime() - midnight(d).getTime()) / 86_400_000);
}

export interface WeekDay {
  date: Date;
  gym: number;
  runs: number;
  today: boolean;
  future: boolean;
}

/** The 7 days of the week that starts at `weekStart`, with completed workouts and runs per day. */
export function weekDays(weekStart: Date, workouts: readonly { start: Date }[], runs: readonly { start: Date }[], now: Date): WeekDay[] {
  const gym = new Map<string, number>();
  const run = new Map<string, number>();
  for (const w of workouts) gym.set(dayKey(w.start), (gym.get(dayKey(w.start)) ?? 0) + 1);
  for (const r of runs) run.set(dayKey(r.start), (run.get(dayKey(r.start)) ?? 0) + 1);
  const todayKey = dayKey(now);
  const today = midnight(now).getTime();
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    const k = dayKey(date);
    return { date, gym: gym.get(k) ?? 0, runs: run.get(k) ?? 0, today: k === todayKey, future: date.getTime() > today };
  });
}

/**
 * Weeks in a row in which the weekly goal (completed gym workouts) was reached. The current week only counts once
 * its goal is reached; while it is still open, the streak from the weeks before stays alive.
 */
export function goalStreak(workouts: readonly { start: Date }[], weekStartOf: (d: Date) => Date, now: Date, goal: number): number {
  if (goal < 1) return 0;
  const perWeek = new Map<number, number>();
  for (const w of workouts) {
    const k = weekStartOf(w.start).getTime();
    perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
  }
  const current = weekStartOf(now);
  const weekAt = (i: number) => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7 * i).getTime();
  let streak = (perWeek.get(weekAt(0)) ?? 0) >= goal ? 1 : 0;
  for (let i = 1; (perWeek.get(weekAt(i)) ?? 0) >= goal; i++) streak++;
  return streak;
}

/**
 * The routine that is due next: the one done longest ago, so a rotation (Push → Pull → Legs) comes round by
 * itself. Routines never done only count when none has been done yet (then the first by position), because
 * unused starter routines would otherwise always win. Null without routines.
 */
export function nextRoutine<R extends { routine: { id: string; position: number } }>(routines: readonly R[], lastDone: Map<string, Date>): R | null {
  if (!routines.length) return null;
  const done = routines.filter((r) => lastDone.has(r.routine.id));
  const pool = done.length ? done : routines;
  return [...pool].sort((a, b) =>
    (lastDone.get(a.routine.id)?.getTime() ?? 0) - (lastDone.get(b.routine.id)?.getTime() ?? 0) || a.routine.position - b.routine.position)[0]!;
}

/** Main muscle groups of a routine, most exercises first (ties keep the routine order), "Other" left out. */
export function routineGroups(
  items: readonly Pick<RoutineExercise, "exerciseId">[], exercises: Map<string, Exercise>, groupOf: (e: Exercise) => MuscleGroup, limit = 3,
): MuscleGroup[] {
  const counts = new Map<MuscleGroup, number>();
  for (const i of items) {
    const ex = exercises.get(i.exerciseId);
    if (!ex) continue;
    const g = groupOf(ex);
    if (g !== "Other") counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([g]) => g);
}

export type FeedItem = { kind: "gym"; start: Date; w: WorkoutView } | { kind: "run"; start: Date; r: RunView };

/** Latest completed gym workouts and runs together, newest first. */
export function recentFeed(workouts: readonly WorkoutView[], runs: readonly RunView[], limit = 3): FeedItem[] {
  const items: FeedItem[] = [
    ...workouts.slice(0, limit).map((w) => ({ kind: "gym" as const, start: w.start, w })),
    ...runs.slice(0, limit).map((r) => ({ kind: "run" as const, start: r.start, r })),
  ];
  return items.sort((a, b) => b.start.getTime() - a.start.getTime()).slice(0, limit);
}

/** Completed work sets (warm-ups excluded) of a workout, for the Recent row. */
export function workSetCount(w: WorkoutView): number {
  return w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completedAt !== null && s.setType !== "warmup").length, 0);
}
