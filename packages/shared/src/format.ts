import type { UserSettings } from "./schemas";

/** The settings that influence how numbers and dates are shown. */
export type FormatPrefs = Pick<UserSettings, "weightUnit" | "decimalSeparator" | "dateFormat" | "weightStepKg" | "weekStart">;

export const DEFAULT_FORMAT_PREFS: FormatPrefs = {
  weightUnit: "kg",
  decimalSeparator: "point",
  dateFormat: "long",
  weightStepKg: 2.5,
  weekStart: "monday",
};

export const KG_PER_LB = 0.45359237;
const NARROW_NBSP = " ";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/* ---------- Numbers and weights ---------- */

/** Formats a number with narrow no-break thousands separators and the chosen decimal separator. */
export function formatNumber(n: number, prefs: Pick<FormatPrefs, "decimalSeparator">, maxDecimals = 2): string {
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(n * factor) / factor;
  const negative = rounded < 0;
  const [int = "0", dec] = String(Math.abs(rounded)).split(".");
  const grouped = int.length > 3 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NBSP) : int;
  const sep = prefs.decimalSeparator === "comma" ? "," : ".";
  return (negative ? "-" : "") + grouped + (dec ? sep + dec : "");
}

export function unitLabel(prefs: Pick<FormatPrefs, "weightUnit">): string {
  return prefs.weightUnit;
}

/** kg (storage) → number in the user's unit. */
export function toDisplayWeight(kg: number, prefs: Pick<FormatPrefs, "weightUnit">): number {
  if (prefs.weightUnit === "lb") return Math.round((kg / KG_PER_LB) * 10) / 10;
  return Math.round(kg * 100) / 100;
}

/** Number in the user's unit → kg (storage). */
export function fromDisplayWeight(value: number, prefs: Pick<FormatPrefs, "weightUnit">): number {
  return prefs.weightUnit === "lb" ? value * KG_PER_LB : value;
}

/** Weight value without unit, e.g. "82.5" or "182,0". */
export function formatWeightValue(kg: number, prefs: FormatPrefs): string {
  return formatNumber(toDisplayWeight(kg, prefs), prefs, prefs.weightUnit === "lb" ? 1 : 2);
}

/** Weight with unit, e.g. "82.5 kg". */
export function formatWeight(kg: number, prefs: FormatPrefs): string {
  return formatWeightValue(kg, prefs) + " " + prefs.weightUnit;
}

const LB_STEPS: Record<number, number> = { 2.5: 5, 1.25: 2.5, 1: 2, 0.5: 1 };

/** The weight step in the user's unit (used for ± buttons and display rounding). */
export function weightStepInUnit(prefs: Pick<FormatPrefs, "weightUnit" | "weightStepKg">): number {
  return prefs.weightUnit === "lb" ? LB_STEPS[prefs.weightStepKg] ?? 5 : prefs.weightStepKg;
}

export type ParseResult = { ok: true; value: number | null } | { ok: false };

/**
 * Parses a weight typed by the user (in their unit) into kg.
 * Accepts "," and "." as decimal separator. Any multiple of 0.25 kg / 0.5 lb is valid,
 * so odd dumbbell weights like 22 kg work regardless of the weight-step setting.
 */
export function parseWeightInput(input: string, prefs: Pick<FormatPrefs, "weightUnit">): ParseResult {
  const s = input.trim().replace(",", ".");
  if (s === "") return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false };
  const n = Number(s);
  const fine = prefs.weightUnit === "lb" ? 0.5 : 0.25;
  const max = prefs.weightUnit === "lb" ? 2200 : 999.75;
  if (!Number.isFinite(n) || n < 0 || n > max) return { ok: false };
  if (Math.abs(n / fine - Math.round(n / fine)) > 1e-9) return { ok: false };
  return { ok: true, value: fromDisplayWeight(n, prefs) };
}

/** Parses reps: whole number 1–999. */
export function parseRepsInput(input: string): ParseResult {
  const s = input.trim();
  if (s === "") return { ok: true, value: null };
  if (!/^\d+$/.test(s)) return { ok: false };
  const n = Number(s);
  return n >= 1 && n <= 999 ? { ok: true, value: n } : { ok: false };
}

/* ---------- Durations and clocks ---------- */

/** "58 min", "1 h 04 min". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h} h ${String(r).padStart(2, "0")} min` : `${Math.max(r, 1)} min`;
}

/** "0:56", "34:12", "1:02:03". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/* ---------- Dates ---------- */

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000);
}

/** "Tuesday, 29 September" (year added when not the current year) or "29.09.2026". */
export function formatDate(d: Date, prefs: Pick<FormatPrefs, "dateFormat">, now = new Date()): string {
  if (prefs.dateFormat === "numeric") {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }
  const year = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
}

/** "22 Sep" or "22.09." — compact date without weekday. */
export function formatShortDate(d: Date, prefs: Pick<FormatPrefs, "dateFormat">, now = new Date()): string {
  if (prefs.dateFormat === "numeric") {
    const y = d.getFullYear() !== now.getFullYear() ? String(d.getFullYear()) : "";
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${y}`;
  }
  const y = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}${y}`;
}

/** "Today", "Yesterday", "Tue" (within a week), otherwise the short date. */
export function formatRelativeDay(d: Date, prefs: Pick<FormatPrefs, "dateFormat">, now = new Date()): string {
  const diff = dayDiff(now, d);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return WEEKDAYS[d.getDay()]!.slice(0, 3);
  return formatShortDate(d, prefs, now);
}

export function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** First day of the week containing `d`. */
export function startOfWeek(d: Date, weekStart: FormatPrefs["weekStart"]): Date {
  const day = startOfDay(d);
  const offset = weekStart === "monday" ? (day.getDay() + 6) % 7 : day.getDay();
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset);
}

/** "This week", "Last week", "14–20 September", "31 August – 6 September", with year when not current. */
export function formatWeekLabel(weekStartDate: Date, prefs: Pick<FormatPrefs, "weekStart">, now = new Date()): string {
  const thisWeek = startOfWeek(now, prefs.weekStart).getTime();
  const t = startOfDay(weekStartDate).getTime();
  if (t === thisWeek) return "This week";
  if (dayDiff(new Date(thisWeek), weekStartDate) === 7) return "Last week";
  const end = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate() + 6);
  const y = end.getFullYear() !== now.getFullYear() ? ` ${end.getFullYear()}` : "";
  if (end.getMonth() === weekStartDate.getMonth()) {
    return `${weekStartDate.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]}${y}`;
  }
  return `${weekStartDate.getDate()} ${MONTHS[weekStartDate.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}${y}`;
}

/** Name for an empty workout, from the time of day it starts. */
export function workoutNameForTime(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Morning workout";
  if (h < 17) return "Afternoon workout";
  return "Evening workout";
}
