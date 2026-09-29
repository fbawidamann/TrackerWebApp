import {
  formatDate, formatNumber, formatRelativeDay, formatShortDate, formatWeight, formatWeightValue, formatWeekLabel,
  parseWeightInput, startOfWeek, toDisplayWeight, type FormatPrefs,
} from "@fitness/shared";
import { useMemo } from "react";
import { useSettings } from "@/data/hooks";

/** Formatting helpers bound to the user's unit / decimal / date settings. Components never format inline. */
export function useFormat() {
  const s = useSettings();
  return useMemo(() => {
    const prefs: FormatPrefs = { weightUnit: s.weightUnit, decimalSeparator: s.decimalSeparator, dateFormat: s.dateFormat, weightStepKg: s.weightStepKg, weekStart: s.weekStart };
    return {
      prefs,
      unit: s.weightUnit,
      num: (n: number, d = 2) => formatNumber(n, prefs, d),
      weight: (kg: number) => formatWeight(kg, prefs),
      weightValue: (kg: number) => formatWeightValue(kg, prefs),
      /** Value for an input field (no thousands separator). */
      weightInput: (kg: number | null) => (kg === null ? "" : String(toDisplayWeight(kg, prefs)).replace(".", prefs.decimalSeparator === "comma" ? "," : ".")),
      parseWeight: (input: string) => parseWeightInput(input, prefs),
      date: (d: Date) => formatDate(d, prefs),
      shortDate: (d: Date) => formatShortDate(d, prefs),
      relDay: (d: Date) => formatRelativeDay(d, prefs),
      weekStart: (d: Date) => startOfWeek(d, prefs.weekStart),
      weekLabel: (d: Date) => formatWeekLabel(d, prefs),
    };
  }, [s.weightUnit, s.decimalSeparator, s.dateFormat, s.weightStepKg, s.weekStart]);
}
export type Fmt = ReturnType<typeof useFormat>;
