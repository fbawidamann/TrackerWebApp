import type { Food, FoodEntry } from "@fitness/shared";
import { describe, expect, it } from "vitest";
import { entriesOfDay, parseAmount, proteinDays, proteinStreak, quickFoods, searchFoods, totalsOf } from "./nutrition";

const base = { userId: "u", createdAt: "x", updatedAt: "x", deletedAt: null as string | null };
const food = (id: string, name: string, extra: Partial<Food> = {}): Food => ({
  ...base, id, name, brand: null, barcode: null, source: "own", unit: "g", kcal: 100, protein: 10, carbs: 5, fat: 2, portion: null, ...extra,
});
let k = 0;
const entry = (at: Date, protein: number, foodId: string | null = null, amount = 100, extra: Partial<FoodEntry> = {}): FoodEntry => ({
  ...base, id: `e${++k}`, foodId, eatenAt: at.toISOString(), amount, unit: "g", name: "x", kcal: protein * 5, protein, carbs: 0, fat: 0, ...extra,
});
const d = (day: number, h = 12) => new Date(2026, 9, day, h);
const NOW = d(4, 18);

describe("day entries", () => {
  it("local day bounds, sorted, deleted dropped", () => {
    const list = [entry(d(4, 20), 30), entry(d(4, 0), 10), entry(d(3, 23), 99), entry(d(5, 0), 99), entry(d(4, 9), 50, null, 100, { deletedAt: "y" })];
    const day = entriesOfDay(list, d(4));
    expect(day.map((e) => e.protein)).toEqual([10, 30]);
    expect(totalsOf(day).protein).toBe(40);
  });
});

describe("protein days + streak", () => {
  const list = [entry(d(1), 150), entry(d(2), 130), entry(d(3), 60), entry(d(3, 19), 60), entry(d(4), 40)];
  it("7 dots ending today with the colour of each day", () => {
    const days = proteinDays(list, d(4, 0), 150, NOW);
    expect(days).toHaveLength(7);
    expect(days.map((x) => x.status)).toEqual(["none", "none", "none", "great", "ok", "ok", "low"]);
    expect(days[6]!.isToday).toBe(true);
  });
  it("streak counts days ≥ 80 % ending yesterday while today is open", () => {
    expect(proteinStreak(list, 150, NOW)).toBe(3);
    expect(proteinStreak([...list, entry(d(4, 19), 100)], 150, NOW)).toBe(4);
    expect(proteinStreak(list, 0, NOW)).toBe(0);
  });
});

describe("quick foods + search", () => {
  const skyr = food("f1", "Skyr Natur", { brand: "Arla" });
  const oats = food("f2", "Haferflocken");
  const gone = food("f3", "Alt", { deletedAt: "y" });
  const list = [entry(d(1), 10, "f2", 80), entry(d(2), 10, "f2", 90), entry(d(3), 10, "f1", 250), entry(d(4, 8), 10, "f3", 50), entry(d(4, 9), 10, "f2", 70)];
  it("recent = last used first, with last amount; deleted foods ignored", () => {
    const q = quickFoods(list, [skyr, oats, gone], NOW, 1);
    expect(q.recent.map((x) => [x.food.id, x.lastAmount])).toEqual([["f2", 70]]);
    const all = quickFoods(list, [skyr, oats, gone], NOW);
    expect(all.recent.map((x) => x.food.id)).toEqual(["f2", "f1"]);
    expect(all.frequent).toEqual([]);
  });
  it("search matches every word in name or brand, accent-insensitive, own first", () => {
    const off = food("f4", "Skyr Vanille", { source: "off" });
    expect(searchFoods([off, skyr, oats], "skyr").map((f) => f.id)).toEqual(["f1", "f4"]);
    expect(searchFoods([skyr], "arla sky").map((f) => f.id)).toEqual(["f1"]);
    expect(searchFoods([food("f5", "Crème fraîche")], "creme").length).toBe(1);
    expect(searchFoods([skyr], "  ")).toEqual([]);
  });
  it("parses amounts with comma or point", () => {
    expect([parseAmount("250"), parseAmount("12,5"), parseAmount("1.5"), parseAmount("0"), parseAmount("abc"), parseAmount("")]).toEqual([250, 12.5, 1.5, null, null, null]);
  });
});
