import type { Exercise, MuscleGroup, WorkoutSet } from "@fitness/shared";
import { describe, expect, it } from "vitest";
import {
  consistency, dayGrid, delta, gymSummary, liftTrends, periodRange, prsInPeriod, setsPerGroup, topExercises, weeksCovered,
} from "./stats";
import type { ExerciseSession, PrEvent, WorkoutView } from "./training";

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
    expect(g.find((x) => x.group === "Chest")!.exercises).toEqual([{ exerciseId: "bench", sets: 3 }]);
    expect(g.find((x) => x.group === "Shoulders")!.exercises).toEqual([]);
    const all = setsPerGroup(W, catalog, groupOf, null);
    expect(all.find((x) => x.group === "Legs")!.exercises).toEqual([{ exerciseId: "squat", sets: 4 }]);
  });

  it("setsPerGroup: unknown exercises land in Other (shown only then), drill-down sorted by sets", () => {
    const w = [workout("2026-10-02", [["mystery", [set(10, 10)]], ["bench", [set(50, 5)]], ["fly", [set(10, 10), set(10, 10)]]])];
    const cat = new Map([...catalog, ["fly", ex("fly", "Chest")]]);
    const g = setsPerGroup(w, cat, groupOf, null);
    expect(g.at(-1)).toMatchObject({ group: "Other", sets: 1 });
    expect(g[0]!.exercises.map((x) => x.exerciseId)).toEqual(["fly", "bench"]);
  });

  it("topExercises: sorted by sessions, then sets", () => {
    expect(topExercises(W, null).map((t) => [t.exerciseId, t.sessions, t.sets])).toEqual([["squat", 2, 4], ["bench", 2, 3], ["row", 1, 1]]);
  });

  const monday = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const iso = (d: Date | null) => d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  it("periodRange: compares with the same stretch of the previous period", () => {
    const now = new Date("2026-10-04T15:00:00"); // Sunday
    const w = periodRange("week", now, monday);
    expect([iso(w.from), iso(w.prevFrom), iso(w.prevTo)]).toEqual(["2026-09-28", "2026-09-21", "2026-09-27"]);
    expect(w.prevTo!.getHours()).toBe(15);
    const m = periodRange("month", now, monday);
    expect([iso(m.from), iso(m.prevFrom), iso(m.prevTo)]).toEqual(["2026-10-01", "2026-09-01", "2026-09-04"]);
    const y = periodRange("year", now, monday);
    expect([iso(y.from), iso(y.prevFrom), iso(y.prevTo)]).toEqual(["2026-01-01", "2025-01-01", "2025-10-04"]);
    expect(periodRange("all", now, monday)).toEqual({ from: null, prevFrom: null, prevTo: null });
  });

  it("periodRange: clamps the day (31 March compares with 28 February), January compares with December", () => {
    expect(iso(periodRange("month", new Date("2026-03-31T12:00:00"), monday).prevTo)).toBe("2026-02-28");
    const jan = periodRange("month", new Date("2026-01-10T12:00:00"), monday);
    expect([iso(jan.prevFrom), iso(jan.prevTo)]).toEqual(["2025-12-01", "2025-12-10"]);
    expect(iso(periodRange("year", new Date("2028-02-29T12:00:00"), monday).prevTo)).toBe("2027-02-28");
  });

  it("delta: direction, difference, percent (none without a base), null when both are 0", () => {
    expect(delta(5, 4)).toEqual({ dir: 1, diff: 1, pct: 25 });
    expect(delta(3, 6)).toEqual({ dir: -1, diff: -3, pct: -50 });
    expect(delta(2, 2)).toEqual({ dir: 0, diff: 0, pct: 0 });
    expect(delta(4, 0)).toEqual({ dir: 1, diff: 4, pct: null });
    expect(delta(0, 0)).toBeNull();
  });

  it("consistency: streak, goal hit rate over finished weeks since the first workout, average per week", () => {
    const now = new Date("2026-10-04T12:00:00"); // week of Mon 28.09.
    const ws = [
      workout("2026-09-29", []), workout("2026-09-30", []), // this week: 2 (goal 2 reached → counts)
      workout("2026-09-22", []), workout("2026-09-24", []), // last week: 2
      workout("2026-09-15", []), // 1 → breaks the streak
      workout("2026-09-08", []), workout("2026-09-09", []), workout("2026-09-10", []),
    ];
    expect(consistency(ws, monday, now, 2)).toEqual({ streak: 2, hit: 2, counted: 3, avgPerWeek: 2 });
    // Running week below goal does not break the streak yet.
    expect(consistency(ws.slice(2), monday, now, 2).streak).toBe(1);
    expect(consistency([], monday, now, 3)).toEqual({ streak: 0, hit: 0, counted: 0, avgPerWeek: 0 });
  });

  it("weeksCovered: from the later of period start and first workout; null below two weeks", () => {
    const now = new Date("2026-10-29T12:00:00");
    expect(weeksCovered(new Date("2026-10-01T00:00:00"), new Date("2025-01-01T10:00:00"), now)).toBeCloseTo(28.5 / 7, 1);
    expect(weeksCovered(null, new Date("2026-10-15T18:00:00"), now)).toBeCloseTo(14.5 / 7, 1);
    expect(weeksCovered(new Date("2026-10-20T00:00:00"), new Date("2025-01-01T10:00:00"), now)).toBeNull();
    expect(weeksCovered(null, null, now)).toBeNull();
  });

  it("liftTrends: best e1RM in the period vs the comparison window, sparkline of the last sessions", () => {
    const sess = (day: string, sets: WorkoutSet[]) => ({ date: new Date(`${day}T10:00:00`), sets }) as ExerciseSession;
    const map = new Map([["bench", [
      sess("2026-08-20", [set(70, 10)]), // 93.3
      sess("2026-09-02", [set(75, 8)]), // 95
      sess("2026-09-20", [set(80, 6)]), // 96 (after the comparison window 1–4 Sep)
      sess("2026-10-02", [set(80, 8), set(100, 15)]), // 101.3 (15 reps don't count)
      sess("2026-10-10", [set(120, 1)]), // in the future: ignored
    ]], ["plank", [sess("2026-10-02", [set(null, 60)])]]]);
    const now = new Date("2026-10-04T12:00:00");
    const [b, p] = liftTrends(map, ["bench", "plank"], periodRange("month", now, monday), now);
    expect(b!.best).toBeCloseTo(101.33, 1);
    expect(b!.prev).toBeCloseTo(95, 1);
    expect(b!.series).toHaveLength(4);
    expect(p).toEqual({ exerciseId: "plank", best: null, prev: null, series: [] });
    expect(liftTrends(map, ["bench"], periodRange("all", now, monday), now)[0]!.prev).toBeNull();
  });

  it("prsInPeriod: only PRs from the period start until now, newest first", () => {
    const ev = (day: string, exerciseId: string) => ({ exerciseId, date: new Date(`${day}T10:00:00`), value: 100, previous: 95 }) as PrEvent;
    const out = prsInPeriod([ev("2026-09-30", "a"), ev("2026-10-03", "b"), ev("2026-10-01", "c"), ev("2026-10-09", "d")], new Date("2026-10-01T00:00:00"), new Date("2026-10-04T12:00:00"));
    expect(out.map((e) => e.exerciseId)).toEqual(["b", "c"]);
  });

  it("dayGrid: 12 weeks × 7 days, workouts per day, future days marked", () => {
    const g = dayGrid(W, monday, new Date("2026-10-04T12:00:00"));
    expect(g).toHaveLength(12);
    expect(g.every((w) => w.days.length === 7)).toBe(true);
    const last = g[11]!;
    expect(iso(last.start)).toBe("2026-09-28");
    expect(last.days.map((d) => d.count)).toEqual([1, 0, 0, 1, 0, 0, 0]);
    expect(last.count).toBe(2);
    expect(last.days.some((d) => d.future)).toBe(false); // Sunday is today
    const midweek = dayGrid(W, monday, new Date("2026-10-01T12:00:00"));
    expect(midweek[11]!.days.map((d) => d.future)).toEqual([false, false, false, false, true, true, true]); // Thu 1 Oct
  });
});
