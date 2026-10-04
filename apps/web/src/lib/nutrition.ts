import {
  nutritionTargets, proteinStatus, sumMacros, weeklyChange, weightTrend,
  type BodyWeight, type Food, type FoodEntry, type Macros, type NutritionTargets, type ProteinStatus, type UserSettings,
} from "@fitness/shared";

/* Pure helpers for the Nutrition tab and the Home card (docs/design/screens/nutrition.md). */

const alive = <T extends { deletedAt: string | null }>(r: T) => r.deletedAt === null;

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const sameDay = (a: Date, b: Date): boolean => startOfDay(a).getTime() === startOfDay(b).getTime();

/** Entries of one local day, by time. */
export function entriesOfDay(entries: readonly FoodEntry[], day: Date): FoodEntry[] {
  const from = startOfDay(day).getTime(), to = addDays(day, 1).getTime();
  return entries.filter((e) => alive(e) && Date.parse(e.eatenAt) >= from && Date.parse(e.eatenAt) < to)
    .sort((a, b) => a.eatenAt.localeCompare(b.eatenAt));
}

export const totalsOf = (entries: readonly FoodEntry[]): Macros => sumMacros(entries);

export interface DayDot { date: Date; protein: number; status: ProteinStatus; isToday: boolean; isFuture: boolean }

/** Protein colour per day for the 7 days ending at `end` (the strip under the ring). */
export function proteinDays(entries: readonly FoodEntry[], end: Date, target: number, now = new Date()): DayDot[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(end, i - 6);
    const protein = totalsOf(entriesOfDay(entries, date)).protein;
    return { date, protein, status: proteinStatus(protein, target), isToday: sameDay(date, now), isFuture: startOfDay(date) > startOfDay(now) };
  });
}

/** Days in a row (ending yesterday, or today once reached) with protein ≥ 80 % of the target (green or dark green). */
export function proteinStreak(entries: readonly FoodEntry[], target: number, now = new Date()): number {
  if (target <= 0) return 0;
  const ok = (d: Date) => totalsOf(entriesOfDay(entries, d)).protein >= target * 0.8;
  let n = ok(now) ? 1 : 0;
  for (let d = addDays(now, -1); n < 3650 && ok(d); d = addDays(d, -1)) n++;
  return n;
}

export interface QuickFood { food: Food; lastAmount: number; count: number; lastAt: string }

/**
 * "Recent" (last used first) and "Frequent" (most logged in the last 60 days) for the empty search.
 * Only foods that still exist; at most `limit` each, Frequent without the ones already in Recent.
 */
export function quickFoods(entries: readonly FoodEntry[], foods: readonly Food[], now = new Date(), limit = 8): { recent: QuickFood[]; frequent: QuickFood[] } {
  const byId = new Map(foods.filter(alive).map((f) => [f.id, f]));
  const since = addDays(now, -60).getTime();
  const map = new Map<string, QuickFood>();
  for (const e of [...entries].filter(alive).sort((a, b) => a.eatenAt.localeCompare(b.eatenAt))) {
    const food = e.foodId ? byId.get(e.foodId) : undefined;
    if (!food) continue;
    const q = map.get(food.id) ?? { food, lastAmount: e.amount, count: 0, lastAt: e.eatenAt };
    if (Date.parse(e.eatenAt) >= since) q.count++;
    q.lastAmount = e.amount; q.lastAt = e.eatenAt;
    map.set(food.id, q);
  }
  const all = [...map.values()];
  const recent = [...all].sort((a, b) => b.lastAt.localeCompare(a.lastAt)).slice(0, limit);
  const inRecent = new Set(recent.map((q) => q.food.id));
  const frequent = all.filter((q) => q.count >= 2 && !inRecent.has(q.food.id)).sort((a, b) => b.count - a.count).slice(0, limit);
  return { recent, frequent };
}

/** Own/local food search: every word must match name or brand (case and accent insensitive). */
export function searchFoods(foods: readonly Food[], q: string): Food[] {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return foods.filter((f) => alive(f) && words.every((w) => norm(`${f.name} ${f.brand ?? ""}`).includes(w)))
    .sort((a, b) => (a.source === b.source ? a.name.localeCompare(b.name) : a.source === "own" ? -1 : 1)).slice(0, 30);
}

export interface WeightInfo { latest: BodyWeight | null; trend: ReturnType<typeof weightTrend>; perWeek: number | null }

export function weightInfo(list: readonly BodyWeight[]): WeightInfo {
  const live = list.filter(alive).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const trend = weightTrend(live.map((w) => ({ date: new Date(w.measuredAt), kg: w.kg })));
  return { latest: live[live.length - 1] ?? null, trend, perWeek: weeklyChange(trend) };
}

/** Targets from settings + the current weight (7-day average when there is one). */
export function targetsFor(s: UserSettings, w: WeightInfo, now = new Date()): NutritionTargets | null {
  const weightKg = w.trend.length ? Math.round(w.trend[w.trend.length - 1]!.avg * 10) / 10 : null;
  return nutritionTargets(
    { kcalTarget: s.kcalTarget, kcalSurplus: s.kcalSurplus, proteinPerKg: s.proteinPerKg, proteinTargetG: s.proteinTargetG },
    { sex: s.sex, birthYear: s.birthYear, heightCm: s.heightCm, activity: s.activityLevel, weightKg }, now,
  );
}

/** Parses "250", "250,5", "1.5" → number > 0, else null. */
export function parseAmount(s: string): number | null {
  const n = Number(s.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
