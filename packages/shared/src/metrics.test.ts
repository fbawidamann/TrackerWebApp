import { describe, expect, it } from "vitest";
import { builtinExerciseId, newId } from "./ids";
import { bestE1rm, bestReps, epley1rm, heaviestWeight, prSessions, type MetricSet } from "./metrics";

const done = "2026-09-29T17:40:00.000Z";
const set = (weightKg: number | null, reps: number | null, setType: MetricSet["setType"] = "normal", completedAt: string | null = done): MetricSet =>
  ({ weightKg, reps, setType, completedAt });

describe("metrics", () => {
  it("computes Epley e1RM only for 1–12 reps", () => {
    expect(epley1rm(100, 5)).toBeCloseTo(116.67, 1);
    expect(epley1rm(100, 15)).toBeNull();
  });
  it("ignores warm-ups and unfinished sets", () => {
    const sets = [set(120, 3, "warmup"), set(80, 8), set(85, 6, "normal", null)];
    expect(heaviestWeight(sets)).toBe(80);
    expect(heaviestWeight(sets, true)).toBe(120);
    expect(bestReps(sets)).toBe(8);
  });
  it("computes the best e1RM", () => {
    // 80 × 8 → 101.3 beats 82.5 × 6 → 99
    expect(bestE1rm([set(80, 8), set(82.5, 6)])).toBeCloseTo(101.33, 1);
  });
  it("detects PR sessions after the first one", () => {
    const prs = prSessions([
      { key: "a", value: 80 },
      { key: "b", value: 80 },
      { key: "c", value: 82.5 },
      { key: "d", value: null },
      { key: "e", value: 85 },
    ]);
    expect([...prs.keys()]).toEqual(["c", "e"]);
    expect(prs.get("c")).toEqual({ value: 82.5, previous: 80 });
  });
});

describe("ids", () => {
  it("creates unique v7 ids", () => {
    expect(newId()).not.toBe(newId());
    expect(newId()).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("derives stable built-in ids", () => {
    expect(builtinExerciseId("Barbell_Squat")).toBe(builtinExerciseId("Barbell_Squat"));
    expect(builtinExerciseId("Barbell_Squat")).not.toBe(builtinExerciseId("Front_Squat"));
  });
});
