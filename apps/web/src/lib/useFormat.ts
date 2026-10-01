import {
  formatDate, formatDayMonth, formatDistanceValue, formatDuration, formatNumber, formatPace, formatRelativeDay, formatRunTime,
  formatShortDate, formatTime, formatWeight, formatWeightValue, formatWeekLabel, monthAxisLabel, monthName, parseWeightInput,
  startOfWeek, toDisplayWeight, weekdayName, type FormatPrefs,
} from "@fitness/shared";
import { useMemo } from "react";
import { useSettings } from "@/data/hooks";

/** Formatting helpers bound to the user's unit / decimal / date / language settings. Components never format inline. */
export function useFormat() {
  const s = useSettings();
  return useMemo(() => {
    const prefs: FormatPrefs = {
      weightUnit: s.weightUnit, decimalSeparator: s.decimalSeparator, dateFormat: s.dateFormat, weightStepKg: s.weightStepKg,
      weekStart: s.weekStart, language: s.language,
    };
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
      /** "29 September" / "29. September". */
      dayMonth: (d: Date) => formatDayMonth(d, prefs),
      month: (m: number) => monthName(m, prefs),
      monthAxis: (m: number) => monthAxisLabel(m, prefs),
      weekday: (d: Date) => weekdayName(d.getDay(), prefs),
      weekStart: (d: Date) => startOfWeek(d, prefs.weekStart),
      weekLabel: (d: Date) => formatWeekLabel(d, prefs),
      time: (d: Date) => formatTime(d),
      duration: (minutes: number) => formatDuration(minutes),
      /** Running: "10.02" (km, without unit), "5:12" (per km, without unit), "52:14". */
      dist: (m: number) => formatDistanceValue(m, prefs),
      pace: (secPerKm: number | null) => (secPerKm === null ? "–" : formatPace(secPerKm)),
      runTime: (s: number) => formatRunTime(s),
    };
  }, [s.weightUnit, s.decimalSeparator, s.dateFormat, s.weightStepKg, s.weekStart, s.language]);
}
export type Fmt = ReturnType<typeof useFormat>;
