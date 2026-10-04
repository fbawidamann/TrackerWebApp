import { beforeEach, describe, expect, it } from "vitest";
import { exportBackup, importBackup, parseBackup } from "./actions";
import { db, FitnessDb, setDb } from "./db";
import { deleteEntry, foodByBarcode, foodFromOff, logFood, saveFood, saveWeight, updateEntry } from "./nutrition";
import { ensureSettings } from "./seed";

let n = 0;
beforeEach(async () => {
  setDb(new FitnessDb(`nutri-${++n}`));
  await ensureSettings();
});

const skyr = { name: " Skyr ", brand: "", barcode: null, unit: "g" as const, kcal: 63, protein: 11, carbs: 4, fat: 0.2, portion: 150 };

describe("nutrition writes", () => {
  it("logs with a snapshot: editing the food later doesn't change the entry", async () => {
    const id = await saveFood(null, skyr);
    const food = (await db.foods.get(id))!;
    expect([food.name, food.brand]).toEqual(["Skyr", null]);
    const eid = await logFood(food, 250, new Date(2026, 9, 4, 8));
    await saveFood(id, { ...skyr, protein: 20 });
    const e = (await db.foodEntries.get(eid))!;
    expect([e.name, e.amount, e.kcal, e.protein, e.carbs]).toEqual(["Skyr", 250, 158, 27.5, 10]);
    // every write goes to the outbox (sync)
    expect((await db.outbox.toArray()).filter((o) => o.table === "foodEntries")).toHaveLength(1);
  });

  it("update scales from the snapshot; delete is soft with undo", async () => {
    const food = (await db.foods.get(await saveFood(null, skyr)))!;
    const eid = await logFood(food, 100, new Date());
    await updateEntry(eid, 200, new Date(2026, 9, 4, 9));
    expect((await db.foodEntries.get(eid))!.protein).toBe(22);
    const undo = await deleteEntry(eid);
    expect((await db.foodEntries.get(eid))!.deletedAt).not.toBeNull();
    await undo();
    expect((await db.foodEntries.get(eid))!.deletedAt).toBeNull();
  });

  it("Open Food Facts products are copied once, found by barcode; own foods win", async () => {
    const p = { barcode: "4000417025005", name: "Skyr", brand: "Milsani", unit: "g" as const, kcal: 63, protein: 11, carbs: null, fat: null, portion: null };
    const a = await foodFromOff(p);
    const b = await foodFromOff(p);
    expect(a.id).toBe(b.id);
    expect([a.source, a.carbs]).toEqual(["off", 0]);
    const own = await saveFood(null, { ...skyr, barcode: "4000417025005" });
    expect((await foodByBarcode("4000417025005"))!.id).toBe(own);
  });

  it("one weigh-in per day; backup round trip keeps nutrition data", async () => {
    await saveWeight(80.2, new Date(2026, 9, 4, 7));
    await saveWeight(80.0, new Date(2026, 9, 4, 8));
    await saveWeight(80.4, new Date(2026, 9, 5, 7));
    expect((await db.bodyWeights.toArray()).map((w) => w.kg).sort()).toEqual([80, 80.4]);
    const food = (await db.foods.get(await saveFood(null, skyr)))!;
    await logFood(food, 100, new Date());
    const json = await exportBackup();
    setDb(new FitnessDb(`nutri-${++n}`));
    await ensureSettings();
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) await importBackup(parsed.backup);
    expect([await db.foods.count(), await db.foodEntries.count(), await db.bodyWeights.count()]).toEqual([1, 1, 2]);
  });
});
