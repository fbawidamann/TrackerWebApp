import { builtinExerciseId } from "@fitness/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { buildTraining } from "@/lib/training";
import {
  addStarter, deleteWorkout, exportBackup, finishWorkout, getActiveWorkout, importBackup, parseBackup,
  routineChanges, saveRoutine, startWorkout, updateSet,
} from "./actions";
import { db, FitnessDb, setDb } from "./db";
import { softDelete, upsert } from "./mutate";
import { ensureSettings } from "./seed";

const BENCH = builtinExerciseId("Barbell_Bench_Press_-_Medium_Grip");
const SQUAT = builtinExerciseId("Barbell_Squat");
let n = 0;

beforeEach(async () => {
  setDb(new FitnessDb(`test-${++n}`));
  await ensureSettings();
});

async function training() {
  return buildTraining(await db.activities.toArray(), await db.activityExercises.toArray(), await db.sets.toArray(), false);
}

/** Starts a workout from the routine and completes the given (weight, reps) per set, in order. */
async function logRoutine(routineId: string, values: Array<[number, number]>) {
  const id = await startWorkout({ routineId });
  const sets = (await db.sets.where("activityId").equals(id).toArray()).sort((a, b) => a.position - b.position);
  for (const [i, [w, r]] of values.entries()) {
    await updateSet(sets[i]!.id, { weightKg: w, reps: r, completedAt: new Date(Date.now() + i).toISOString() });
  }
  await finishWorkout(id);
  return id;
}

describe("write path", () => {
  it("records every write in the outbox", async () => {
    const before = await db.outbox.count();
    await upsert("routines", { id: "r1", userId: "local", createdAt: "", updatedAt: "", deletedAt: null, name: "A", position: 0 });
    await softDelete("routines", "r1");
    expect(await db.outbox.count()).toBe(before + 2);
    expect((await db.routines.get("r1"))?.deletedAt).not.toBeNull();
  });
});

describe("workouts", () => {
  it("starts from a routine with warm-up and working sets", async () => {
    const routineId = await saveRoutine(null, "Push", [{ exerciseId: BENCH, warmupSets: 1, workingSets: 3, note: "Grip wide" }]);
    const id = await startWorkout({ routineId });
    const active = await getActiveWorkout();
    expect(active?.id).toBe(id);
    expect(active?.name).toBe("Push");
    const sets = await db.sets.where("activityId").equals(id).toArray();
    expect(sets.map((s) => s.setType).sort()).toEqual(["normal", "normal", "normal", "warmup"]);
    const ae = (await db.activityExercises.where("activityId").equals(id).toArray())[0];
    expect(ae?.note).toBe("Grip wide");
  });

  it("finishing drops unfinished sets and empty exercises", async () => {
    const routineId = await saveRoutine(null, "Legs", [
      { exerciseId: SQUAT, warmupSets: 0, workingSets: 3, note: "" },
      { exerciseId: BENCH, warmupSets: 0, workingSets: 2, note: "" },
    ]);
    const id = await logRoutine(routineId, [[100, 5]]);
    const t = await training();
    const w = t.byId.get(id)!;
    expect(w.activity.status).toBe("completed");
    expect(w.exercises).toHaveLength(1);
    expect(w.setCount).toBe(1);
    expect(await routineChanges(routineId, id)).toBe("1 exercise removed · number of sets changed");
  });

  it("detects heaviest-weight PRs from the second session on", async () => {
    const routineId = await saveRoutine(null, "Push", [{ exerciseId: BENCH, warmupSets: 0, workingSets: 2, note: "" }]);
    const first = await logRoutine(routineId, [[80, 8], [80, 8]]);
    const second = await logRoutine(routineId, [[82.5, 6], [80, 8]]);
    const t = await training();
    expect(t.byId.get(first)!.prCount).toBe(0);
    expect(t.byId.get(second)!.prCount).toBe(1);
    expect(t.prEvents[0]).toMatchObject({ value: 82.5, previous: 80 });
  });

  it("deleting a workout can be undone", async () => {
    const routineId = await saveRoutine(null, "Push", [{ exerciseId: BENCH, warmupSets: 0, workingSets: 1, note: "" }]);
    const id = await logRoutine(routineId, [[80, 8]]);
    const undo = await deleteWorkout(id);
    expect((await training()).byId.has(id)).toBe(false);
    await undo();
    expect((await training()).byId.has(id)).toBe(true);
  });
});

describe("routines and backup", () => {
  it("adds starter routines", async () => {
    await addStarter("ppl");
    const names = (await db.routines.toArray()).map((r) => r.name);
    expect(names).toEqual(["Push", "Pull", "Legs"]);
  });

  it("round-trips a backup", async () => {
    const routineId = await saveRoutine(null, "Push", [{ exerciseId: BENCH, warmupSets: 0, workingSets: 1, note: "" }]);
    await logRoutine(routineId, [[80, 8]]);
    const json = await exportBackup();
    const parsed = parseBackup(json);
    expect(parsed.ok && parsed.workouts).toBe(1);

    setDb(new FitnessDb(`test-${++n}`));
    await ensureSettings();
    if (!parsed.ok) throw new Error("backup invalid");
    await importBackup(parsed.backup);
    expect((await training()).workouts).toHaveLength(1);
    expect(parseBackup("{\"nope\":1}").ok).toBe(false);
  });
});
