import { builtinExerciseId } from "@fitness/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { db, FitnessDb, setDb } from "./db";
import { ensureSettings, seedCatalog } from "./seed";

const BENCH = builtinExerciseId("Barbell_Bench_Press_-_Medium_Grip");
let n = 0;

beforeEach(async () => {
  setDb(new FitnessDb(`seed-${++n}`));
  await ensureSettings();
});

describe("catalog seeding", () => {
  it("stores the built-ins in the chosen language and switches back", async () => {
    await seedCatalog("de");
    const de = await db.exercises.get(BENCH);
    expect(de?.name).toBe("Bankdrücken, mittlerer Griff");
    expect(de?.instructions[0]).toMatch(/Flachbank/);
    expect(await db.exercises.count()).toBeGreaterThan(800);

    await seedCatalog("en");
    expect((await db.exercises.get(BENCH))?.name).toBe("Bench Press - Medium Grip");
  });

  it("does not touch custom exercises or the outbox", async () => {
    const before = await db.outbox.count();
    await seedCatalog("de");
    expect(await db.outbox.count()).toBe(before);
    expect((await db.exercises.toArray()).every((e) => !e.isCustom)).toBe(true);
  });
});
