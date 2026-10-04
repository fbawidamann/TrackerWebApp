import { describe, expect, it } from "vitest";
import {
  bmr, fromOff, gainHint, macrosFor, nutritionTargets, offComplete, proteinStatus, sumMacros, weeklyChange, weightTrend,
  type BodyData, type TargetSettings,
} from "./nutrition";
import { DEFAULT_USER_SETTINGS, foodEntrySchema, userSettingsSchema } from "./schemas";

const body: BodyData = { sex: "male", birthYear: 1996, heightCm: 182, activity: 3, weightKg: 80 };
const s: TargetSettings = { kcalTarget: null, kcalSurplus: 250, proteinPerKg: 1.8, proteinTargetG: null };
const NOW = new Date(2026, 9, 4);

describe("nutrition: amounts", () => {
  it("scales per-100 values and sums", () => {
    const m = macrosFor({ kcal: 65, protein: 10.6, carbs: 4.4, fat: 0.2 }, 250);
    expect(m.kcal).toBeCloseTo(162.5);
    expect(m.protein).toBeCloseTo(26.5);
    expect(sumMacros([m, m]).protein).toBeCloseTo(53);
    expect(sumMacros([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe("nutrition: protein colour", () => {
  it("red < 50 %, yellow < 80 %, green < 100 %, dark green from 100 %, grey without food", () => {
    expect(proteinStatus(0, 150)).toBe("none");
    expect(proteinStatus(60, 150)).toBe("low");
    expect(proteinStatus(75, 150)).toBe("meh");
    expect(proteinStatus(119, 150)).toBe("meh");
    expect(proteinStatus(120, 150)).toBe("ok");
    expect(proteinStatus(150, 150)).toBe("great");
    expect(proteinStatus(200, 150)).toBe("great");
    expect(proteinStatus(50, 0)).toBe("none");
  });
});

describe("nutrition: targets", () => {
  it("Mifflin-St Jeor", () => {
    expect(bmr(body, NOW)).toBe(10 * 80 + 6.25 * 182 - 5 * 30 + 5);
    expect(bmr({ ...body, sex: "female" }, NOW)).toBe(10 * 80 + 6.25 * 182 - 5 * 30 - 161);
    expect(bmr({ ...body, heightCm: null }, NOW)).toBeNull();
  });
  it("suggests kcal = BMR × activity + surplus, protein = kg × g/kg, fat 25 %, carbs the rest", () => {
    const t = nutritionTargets(s, body, NOW)!;
    expect(t.kcal).toBe(Math.round(((800 + 1137.5 - 150 + 5) * 1.55 + 250) / 50) * 50); // 3 028.4 → 3 050
    expect(t.kcal).toBe(3050);
    expect(t.protein).toBe(145); // 80 × 1.8 = 144 → 145
    expect(t.fat).toBe(85); // 3050 × .25 / 9 = 84.7
    expect(t.carbs).toBe(Math.round((3050 - 145 * 4 - 85 * 9) / 4 / 5) * 5);
    expect(t.suggested).toBe(true);
  });
  it("own values win; protein works without body data; nothing without weight and kcal", () => {
    const t = nutritionTargets({ ...s, kcalTarget: 2800, proteinTargetG: 170 }, body, NOW)!;
    expect([t.kcal, t.protein, t.suggested]).toEqual([2800, 170, false]);
    const p = nutritionTargets({ ...s, proteinPerKg: 2 }, { ...body, sex: null }, NOW)!;
    expect([p.kcal, p.protein, p.carbs, p.fat]).toEqual([0, 160, 0, 0]);
    expect(nutritionTargets(s, { ...body, weightKg: null }, NOW)).toBeNull();
  });
});

describe("nutrition: bodyweight trend", () => {
  const day = (d: number) => new Date(2026, 8, d, 7);
  const pts = Array.from({ length: 22 }, (_, i) => ({ date: day(1 + i), kg: 80 + i * 0.04 + (i % 2 ? 0.3 : -0.3) }));
  it("7-day average smooths daily noise", () => {
    const tr = weightTrend(pts);
    expect(tr).toHaveLength(22);
    expect(tr[0]!.avg).toBeCloseTo(pts[0]!.kg);
    expect(Math.abs(tr[21]!.avg - (80 + 21 * 0.04))).toBeLessThan(0.2);
  });
  it("weekly change needs 2 weeks; hint only when clearly off", () => {
    const tr = weightTrend(pts);
    const c = weeklyChange(tr)!;
    expect(c).toBeGreaterThan(0.15);
    expect(c).toBeLessThan(0.45);
    expect(weeklyChange(tr.slice(0, 10))).toBeNull();
    expect(gainHint(c, 0.25)).toBeNull();
    expect(gainHint(-0.1, 0.25)).toBe("slow");
    expect(gainHint(0.8, 0.25)).toBe("fast");
    expect(gainHint(null, 0.25)).toBeNull();
  });
});

describe("nutrition: Open Food Facts", () => {
  it("maps a product, kcal from kJ when missing, picks the German name", () => {
    const p = fromOff({
      code: "4000417025005", product_name: "Chocolate", product_name_de: "Schokolade", brands: "Ritter Sport, X",
      nutriments: { "energy_100g": 2092, proteins_100g: 6.3, carbohydrates_100g: "52", fat_100g: 31.5 }, serving_quantity: "6.5",
    })!;
    expect(p).toEqual({ barcode: "4000417025005", name: "Schokolade", brand: "Ritter Sport", unit: "g", kcal: 500, protein: 6.3, carbs: 52, fat: 31.5, portion: 6.5 });
    expect(offComplete(p)).toBe(true);
    const drink = fromOff({ code: "12345678", product_name: "Milch", brands: ["Weihenstephan"], product_quantity_unit: "ml", nutriments: {} })!;
    expect([drink.unit, drink.brand, drink.kcal, offComplete(drink)]).toEqual(["ml", "Weihenstephan", null, false]);
    expect(fromOff({ code: "x", product_name: "A" })).toBeNull();
    expect(fromOff({ code: "12345678" })).toBeNull();
  });
});

describe("nutrition: schemas", () => {
  it("old settings rows get the nutrition defaults; entries validate", () => {
    const { homeShowNutrition: _a, kcalTarget: _b, proteinPerKg: _c, ...old } = { ...DEFAULT_USER_SETTINGS, userId: "u", updatedAt: "x" };
    const parsed = userSettingsSchema.parse(old);
    expect([parsed.proteinPerKg, parsed.kcalTarget, parsed.homeShowNutrition]).toEqual([1.8, null, true]);
    expect(foodEntrySchema.safeParse({
      id: "1", userId: "u", createdAt: "x", updatedAt: "x", deletedAt: null, foodId: null, eatenAt: "2026-10-04T08:00:00Z",
      amount: 250, unit: "g", name: "Skyr", kcal: 162, protein: 26, carbs: 11, fat: 0.5,
    }).success).toBe(true);
  });
});
