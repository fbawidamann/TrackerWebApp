import type { Exercise, MuscleGroup, WorkoutSet } from "@fitness/shared";
import { describe, expect, it } from "vitest";
import { daysSince, goalStreak, nextRoutine, recentFeed, routineGroups, weekDays, workSetCount } from "./home";
import type { RunView } from "./runStats";
import type { WorkoutView } from "./training";

const monday = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const at = (s: string) => new Date(s);
const w = (s: string) => ({ start: at(s) });

describe("home: daysSince", () => {
  it("counts calendar days, not 24 h blocks", () => {
    const now = at("2026-10-04T08:00:00");
    expect(daysSince(at("2026-10-04T07:00:00"), now)).toBe(0);
    expect(daysSince(at("2026-10-03T23:30:00"), now)).toBe(1);
    expect(daysSince(at("2026-09-27T12:00:00"), now)).toBe(7);
    // Over the end of daylight saving time (25 October 2026 in Europe) it is still one day per date.
    expect(daysSince(at("2026-10-24T12:00:00"), at("2026-10-26T09:00:00"))).toBe(2);
  });
});

describe("home: weekDays", () => {
  it("returns Mon–Sun with gym and run counts per day, today and future flags", () => {
    const now = at("2026-09-30T12:00:00"); // Wednesday
    const days = weekDays(monday(now), [w("2026-09-28T18:00:00"), w("2026-09-30T07:00:00"), w("2026-09-21T10:00:00")],
      [w("2026-09-29T06:30:00"), w("2026-09-30T19:00:00")], now);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.date.getDate())).toEqual([28, 29, 30, 1, 2, 3, 4]);
    expect(days.map((d) => d.gym)).toEqual([1, 0, 1, 0, 0, 0, 0]); // last week's workout is not counted
    expect(days.map((d) => d.runs)).toEqual([0, 1, 1, 0, 0, 0, 0]);
    expect(days.map((d) => d.today)).toEqual([false, false, true, false, false, false, false]);
    expect(days.map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
  });
});

describe("home: goalStreak", () => {
  const now = at("2026-10-01T12:00:00"); // Thursday, week of Mon 28.09.
  const W = [
    // last week (21.09.): 3, the week before (14.09.): 3, 07.09.: 1
    w("2026-09-21T10:00:00"), w("2026-09-23T10:00:00"), w("2026-09-25T10:00:00"),
    w("2026-09-14T10:00:00"), w("2026-09-16T10:00:00"), w("2026-09-18T10:00:00"),
    w("2026-09-08T10:00:00"),
  ];
  it("counts finished weeks with the goal reached; an open current week keeps the streak alive", () => {
    expect(goalStreak(W, monday, now, 3)).toBe(2);
    expect(goalStreak(W, monday, now, 1)).toBe(3);
  });
  it("the current week counts once its goal is reached", () => {
    const more = [...W, w("2026-09-28T10:00:00"), w("2026-09-30T10:00:00"), w("2026-10-01T08:00:00")];
    expect(goalStreak(more, monday, now, 3)).toBe(3);
  });
  it("a missed week breaks it", () => {
    expect(goalStreak(W, monday, at("2026-10-08T12:00:00"), 3)).toBe(0);
    expect(goalStreak([], monday, now, 3)).toBe(0);
  });
});

describe("home: nextRoutine", () => {
  const r = (id: string, position: number) => ({ routine: { id, position } });
  const R = [r("push", 0), r("pull", 1), r("legs", 2), r("starter", 3)];
  it("picks the routine done longest ago (rotation), ignoring never-done ones", () => {
    const last = new Map([["push", at("2026-09-30T10:00:00")], ["pull", at("2026-09-28T10:00:00")], ["legs", at("2026-09-26T10:00:00")]]);
    expect(nextRoutine(R, last)?.routine.id).toBe("legs");
    last.set("legs", at("2026-10-02T10:00:00"));
    expect(nextRoutine(R, last)?.routine.id).toBe("pull");
  });
  it("first by position when nothing was done yet; null without routines", () => {
    expect(nextRoutine(R, new Map())?.routine.id).toBe("push");
    expect(nextRoutine([], new Map())).toBeNull();
  });
});

describe("home: routineGroups", () => {
  const ex = (id: string, group: MuscleGroup) => ({ id, group }) as unknown as Exercise;
  const groupOf = (e: Exercise) => (e as unknown as { group: MuscleGroup }).group;
  const cat = new Map([["bench", ex("bench", "Chest")], ["fly", ex("fly", "Chest")], ["ohp", ex("ohp", "Shoulders")], ["dip", ex("dip", "Arms")],
    ["x", ex("x", "Other")], ["ext", ex("ext", "Arms")], ["abs", ex("abs", "Core")]]);
  it("most exercises first, ties in routine order, Other and unknown exercises left out, limited", () => {
    const items = ["ohp", "bench", "x", "fly", "dip", "ext", "abs", "gone"].map((exerciseId) => ({ exerciseId }));
    expect(routineGroups(items, cat, groupOf)).toEqual(["Chest", "Arms", "Shoulders"]);
    expect(routineGroups([], cat, groupOf)).toEqual([]);
  });
});

describe("home: recentFeed and workSetCount", () => {
  const set = (setType: string, completedAt: string | null) => ({ setType, completedAt }) as unknown as WorkoutSet;
  const gym = (id: string, s: string, sets: WorkoutSet[] = []) =>
    ({ activity: { id }, start: at(s), exercises: [{ sets }] }) as unknown as WorkoutView;
  const run = (id: string, s: string) => ({ activity: { id }, start: at(s) }) as unknown as RunView;
  it("mixes gym workouts and runs, newest first, limited", () => {
    const feed = recentFeed([gym("g2", "2026-10-02T18:00:00"), gym("g1", "2026-09-30T18:00:00")],
      [run("r2", "2026-10-04T08:00:00"), run("r1", "2026-09-29T08:00:00")]);
    expect(feed.map((f) => (f.kind === "gym" ? f.w.activity.id : f.r.activity.id))).toEqual(["r2", "g2", "g1"]);
    expect(recentFeed([], [])).toEqual([]);
  });
  it("counts only completed work sets", () => {
    expect(workSetCount(gym("g", "2026-10-01T10:00:00", [set("warmup", "x"), set("normal", "x"), set("normal", null), set("drop", "x")]))).toBe(2);
  });
});
