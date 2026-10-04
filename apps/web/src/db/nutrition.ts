import { macrosFor, type BodyWeight, type Food, type FoodEntry, type OffProduct } from "@fitness/shared";
import { db } from "./db";
import { alive, baseRow, restore, softDelete, upsert, write } from "./mutate";

const iso = (d: Date) => d.toISOString();

/* Nutrition writes (docs/design/screens/nutrition.md). All through the single write path (mutate.ts). */

export interface FoodInput {
  name: string; brand: string | null; barcode: string | null; unit: "g" | "ml";
  kcal: number; protein: number; carbs: number; fat: number; portion: number | null;
}

const clean = (f: FoodInput): FoodInput => ({
  ...f, name: f.name.trim().slice(0, 80), brand: f.brand?.trim().slice(0, 60) || null, barcode: f.barcode?.trim() || null,
});

/** Creates (id null) or updates an own food. Past entries keep their snapshot. */
export async function saveFood(id: string | null, input: FoodInput, source: Food["source"] = "own"): Promise<string> {
  const prev = id ? await db.foods.get(id) : undefined;
  const row: Food = { ...(prev ?? baseRow()), ...clean(input), source: prev?.source ?? source };
  return (await upsert("foods", row)).id;
}

export async function deleteFood(id: string): Promise<() => Promise<void>> {
  await softDelete("foods", id);
  return () => restore("foods", [id]);
}

/** The local food for a barcode (own foods win over copied Open Food Facts products). */
export async function foodByBarcode(barcode: string): Promise<Food | undefined> {
  const list = (await db.foods.where("barcode").equals(barcode).toArray()).filter(alive);
  return list.find((f) => f.source === "own") ?? list[0];
}

/** Open Food Facts product → local food (copied on first use, so it works offline and can be corrected). */
export async function foodFromOff(p: OffProduct): Promise<Food> {
  const known = await foodByBarcode(p.barcode);
  if (known) return known;
  const id = await saveFood(null, {
    name: p.name, brand: p.brand, barcode: p.barcode, unit: p.unit,
    kcal: p.kcal ?? 0, protein: p.protein ?? 0, carbs: p.carbs ?? 0, fat: p.fat ?? 0, portion: p.portion,
  }, "off");
  return (await db.foods.get(id))!;
}

const snap = (food: Food, amount: number) => {
  const m = macrosFor(food, amount);
  const r = (n: number) => Math.round(n * 10) / 10;
  return { name: food.name, unit: food.unit, amount, kcal: Math.round(m.kcal), protein: r(m.protein), carbs: r(m.carbs), fat: r(m.fat) };
};

/** Logs `amount` g/ml of a food at `at`, with a snapshot of the values. */
export async function logFood(food: Food, amount: number, at: Date): Promise<string> {
  const row: FoodEntry = { ...baseRow(), foodId: food.id, eatenAt: iso(at), ...snap(food, amount) };
  return (await upsert("foodEntries", row)).id;
}

/** Changes amount and/or time. A new amount is recalculated from the snapshot (per-gram values stay as logged). */
export async function updateEntry(id: string, amount: number, at: Date): Promise<void> {
  const prev = await db.foodEntries.get(id);
  if (!prev) return;
  const k = amount / prev.amount;
  const r = (n: number) => Math.round(n * 10) / 10;
  await upsert("foodEntries", {
    ...prev, amount, eatenAt: iso(at),
    kcal: Math.round(prev.kcal * k), protein: r(prev.protein * k), carbs: r(prev.carbs * k), fat: r(prev.fat * k),
  });
}

export async function deleteEntry(id: string): Promise<() => Promise<void>> {
  await softDelete("foodEntries", id);
  return () => restore("foodEntries", [id]);
}

/** One weigh-in per day: a second one on the same day replaces the first. */
export async function saveWeight(kg: number, at: Date): Promise<void> {
  const day = at.toDateString();
  await write(async () => {
    const same = (await db.bodyWeights.toArray()).find((w) => alive(w) && new Date(w.measuredAt).toDateString() === day);
    const row: BodyWeight = { ...(same ?? baseRow()), measuredAt: iso(at), kg: Math.round(kg * 100) / 100 };
    await upsert("bodyWeights", row);
  });
}

export async function deleteWeight(id: string): Promise<() => Promise<void>> {
  await softDelete("bodyWeights", id);
  return () => restore("bodyWeights", [id]);
}
