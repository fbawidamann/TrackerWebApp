import { z } from "zod";
import { FOOD_UNITS, type Food } from "./schemas";

/* Nutrition (docs/design/screens/nutrition.md, docs/adr/0010-nutrition.md). Separate domain, not part of activities.
   Values are stored per 100 g (or 100 ml); entries keep a snapshot of what was eaten. */

/* ---------- Calculations (pure) ---------- */

export interface Macros { kcal: number; protein: number; carbs: number; fat: number }

/** Values for `amount` g/ml of a food (per-100 values × amount / 100). */
export function macrosFor(food: Pick<Food, "kcal" | "protein" | "carbs" | "fat">, amount: number): Macros {
  const f = amount / 100;
  return { kcal: food.kcal * f, protein: food.protein * f, carbs: food.carbs * f, fat: food.fat * f };
}

export function sumMacros(list: readonly Macros[]): Macros {
  return list.reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

export type ProteinStatus = "none" | "low" | "meh" | "ok" | "great";

/**
 * Protein colour of a day (Florian 2026-10-04): red = very little, yellow = so-so, green = fits, dark green = very good.
 * Thresholds in % of the target: < 50 red, < 80 yellow, < 100 green, ≥ 100 dark green. Nothing eaten = none (grey).
 */
export function proteinStatus(protein: number, target: number): ProteinStatus {
  if (protein <= 0 || target <= 0) return "none";
  const r = protein / target;
  if (r < 0.5) return "low";
  if (r < 0.8) return "meh";
  if (r < 1) return "ok";
  return "great";
}

export const SEXES = ["male", "female"] as const;
export type Sex = (typeof SEXES)[number];
/** Activity factors for TDEE, step 1 (desk, little movement) … 5 (very active job + training). */
export const ACTIVITY_FACTORS = [1.2, 1.375, 1.55, 1.725, 1.9] as const;

export interface BodyData { sex: Sex | null; birthYear: number | null; heightCm: number | null; activity: number; weightKg: number | null }

/** Resting energy (Mifflin-St Jeor), null when data is missing. */
export function bmr(b: BodyData, now = new Date()): number | null {
  if (!b.sex || !b.birthYear || !b.heightCm || !b.weightKg) return null;
  const age = now.getFullYear() - b.birthYear;
  return 10 * b.weightKg + 6.25 * b.heightCm - 5 * age + (b.sex === "male" ? 5 : -161);
}

export interface NutritionTargets { kcal: number; protein: number; carbs: number; fat: number; suggested: boolean }

export interface TargetSettings {
  kcalTarget: number | null;
  kcalSurplus: number;
  proteinPerKg: number;
  proteinTargetG: number | null;
}

const round = (n: number, step: number) => Math.round(n / step) * step;

/**
 * Daily targets. kcal: own value, else suggestion = BMR × activity + surplus (rounded to 50), else null.
 * Protein: own grams, else weight × g/kg (default 1.8, range 1.5–2.2), else null. Fat: 25 % of kcal (at least
 * 0.8 g/kg). Carbs: the rest. Returns null when there is not even a protein target (no weight yet).
 */
export function nutritionTargets(s: TargetSettings, b: BodyData, now = new Date()): NutritionTargets | null {
  const base = bmr(b, now);
  const suggestedKcal = base === null ? null : round(base * (ACTIVITY_FACTORS[b.activity - 1] ?? 1.55) + s.kcalSurplus, 50);
  const kcal = s.kcalTarget ?? suggestedKcal;
  const protein = s.proteinTargetG ?? (b.weightKg ? round(b.weightKg * s.proteinPerKg, 5) : null);
  if (protein === null && kcal === null) return null;
  const k = kcal ?? 0;
  const fat = k ? Math.max(round((k * 0.25) / 9, 5), b.weightKg ? round(b.weightKg * 0.8, 5) : 0) : 0;
  const carbs = k ? Math.max(0, round((k - (protein ?? 0) * 4 - fat * 9) / 4, 5)) : 0;
  return { kcal: k, protein: protein ?? 0, carbs, fat, suggested: s.kcalTarget === null };
}

/** 7-day moving average of the weigh-ins (oldest first), one point per weigh-in. */
export function weightTrend(list: readonly { date: Date; kg: number }[]): Array<{ date: Date; kg: number; avg: number }> {
  const sorted = [...list].sort((a, b) => a.date.getTime() - b.date.getTime());
  return sorted.map((p) => {
    const from = p.date.getTime() - 6.5 * 86_400_000;
    const win = sorted.filter((q) => q.date.getTime() >= from && q.date.getTime() <= p.date.getTime());
    return { ...p, avg: win.reduce((s, q) => s + q.kg, 0) / win.length };
  });
}

/**
 * Change per week of the trend over the last `days` (from the 7-day averages), null with less than 2 weeks of data.
 * Used for the calm hint when the gain is clearly off the target.
 */
export function weeklyChange(trend: readonly { date: Date; avg: number }[], days = 28): number | null {
  if (trend.length < 2) return null;
  const last = trend[trend.length - 1]!;
  const from = last.date.getTime() - days * 86_400_000;
  const first = trend.find((p) => p.date.getTime() >= from) ?? trend[0]!;
  const span = (last.date.getTime() - first.date.getTime()) / 86_400_000;
  if (span < 14) return null;
  return ((last.avg - first.avg) / span) * 7;
}

export type GainHint = "slow" | "fast" | null;

/** "slower/faster than your target": only when clearly off (more than 0.15 kg/week and half the target). */
export function gainHint(change: number | null, target: number): GainHint {
  if (change === null) return null;
  const tol = Math.max(0.15, Math.abs(target) / 2);
  if (change < target - tol) return "slow";
  if (change > target + tol) return "fast";
  return null;
}

/* ---------- Open Food Facts ---------- */

/** What the API returns for a product (server converts OFF data into this). Values per 100 g/ml. */
export const offProductSchema = z.object({
  barcode: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  unit: z.enum(FOOD_UNITS),
  kcal: z.number().nullable(),
  protein: z.number().nullable(),
  carbs: z.number().nullable(),
  fat: z.number().nullable(),
  portion: z.number().nullable(),
});
export type OffProduct = z.infer<typeof offProductSchema>;

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
};

/** Converts a raw Open Food Facts product (v2 product API or search-a-licious hit). Null without name or code. */
export function fromOff(p: Record<string, unknown>, lang: "de" | "en" = "de"): OffProduct | null {
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const name = String(p[`product_name_${lang}`] || p.product_name || p.product_name_en || "").trim();
  const code = String(p.code ?? "").trim();
  if (!name || !/^\d{6,14}$/.test(code)) return null;
  const brands = Array.isArray(p.brands) ? p.brands.join(", ") : String(p.brands ?? "");
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal === null && num(n["energy_100g"]) !== null) kcal = Math.round(num(n["energy_100g"])! / 4.184);
  const unit = String(p.product_quantity_unit ?? "").toLowerCase() === "ml" ? "ml" : "g";
  return {
    barcode: code, name: name.slice(0, 80), brand: brands.split(",")[0]?.trim().slice(0, 60) || null, unit,
    kcal, protein: num(n["proteins_100g"]), carbs: num(n["carbohydrates_100g"]), fat: num(n["fat_100g"]),
    portion: num(p.serving_quantity),
  };
}

/** A product can be logged directly when kcal and protein are known (carbs/fat default to 0). */
export const offComplete = (p: OffProduct): boolean => p.kcal !== null && p.protein !== null;
