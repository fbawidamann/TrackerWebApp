import type { Exercise, MuscleGroup, WorkoutSet } from "@fitness/shared";
import { describe, expect, it } from "vitest";
import { gymSummary, setsPerGroup, topExercises, weeklyWorkouts } from "./stats";
import type { WorkoutView } from "./training";

const done = "2026-10-01T10:00:00.000Z";
const set = (weightKg: number | null, reps: number | null, setType = "normal", completedAt: string | null = done) =>
  ({ weightKg, reps, setType, completedAt }) as unknown as WorkoutSet;

function workout(day: string, exercises: Array<[string, WorkoutSet[]]>, durationMin = 60, prCount = 0): WorkoutView {
  const start = new Date(`${day}T10:00:00`);
  return {
    activity: { id: day } as WorkoutView["activity"], start, end: start, durationMin, prCount,
    exercises: exercises.map(([exerciseId, sets]) => ({ ae: { exerciseId } as WorkoutView["exercises"][number]["ae"], sets, pr: null })),
    setCount: exercises.reduce((n, [, s]) => n + s.length, 0),
  };
}

const ex = (id: string, group: MuscleGroup) => ({ id, group }) as unknown as Exercise;
const groupOf = (e: Exercise) => (e as unknown as { group: MuscleGroup }).group;
const catalog = new Map([["bench", ex("bench", "Chest")], ["squat", ex("squat", "Legs")], ["row", ex("row", "Back")]]);

const W = [
  workout("2026-10-01", [["bench", [set(20, 10, "warmup"), set(80, 8), set(80, 7), set(85, 5, "normal", null)]], ["row", [set(60, 10)]]], 70, 1),
  workout("2026-09-28", [["squat", [set(100, 5), set(100, 5), set(100, 5)]], ["bench", [set(80, 8)]]], 50),
  workout("2026-08-15", [["squat", [set(90, 5)]]], 40),
];

describe("stats", () => {
  it("gymSummary: counts only completed work sets, volume = kg × reps, filters by period", () => {
    const all = gymSummary(W, null);
    expect(all).toMatchObject({ workouts: 3, sets: 8, minutes: 160, prs: 1, avgMinutes: 53 });
    expect(all.volumeKg).toBe(80 * 8 + 80 * 7 + 60 * 10 + 3 * 500 + 640 + 450);
    expect(gymSummary(W, new Date("2026-09-01T00:00:00"))).toMatchObject({ workouts: 2, sets: 7 });
    expect(gymSummary([], null)).toMatchObject({ workouts: 0, avgMinutes: 0 });
  });

  it("setsPerGroup: all groups in fixed order (0 included), warm-ups and unfinished sets left out", () => {
    const g = setsPerGroup(W, catalog, groupOf, new Date("2026-09-01T00:00:00"));
    expect(g.map((x) => x.group)).toEqual(["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"]);
    expect(Object.fromEntries(g.map((x) => [x.group, x.sets]))).toMatchObject({ Chest: 3, Back: 1, Legs: 3, Shoulders: 0 });
  });

  it("topExercises: sorted by sessions, then sets", () => {
    expect(topExercises(W, null).map((t) => [t.exerciseId, t.sessions, t.sets])).toEqual([["squat", 2, 4], ["bench", 2, 3], ["row", 1, 1]]);
  });

  it("weeklyWorkouts: 12 slots, oldest first, workouts counted in their week", () => {
    const monday = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
    const weeks = weeklyWorkouts(W, monday, new Date("2026-10-04T12:00:00"));
    expect(weeks).toHaveLength(12);
    expect(weeks[11]!.count).toBe(2); // 28.09. + 01.10. are the same week (Mon 28.09.)
    expect(weeks.reduce((n, w) => n + w.count, 0)).toBe(3);
  });
});
