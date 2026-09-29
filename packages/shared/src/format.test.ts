import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORMAT_PREFS as P, formatClock, formatDate, formatDuration, formatNumber, formatRelativeDay,
  formatWeekLabel, formatWeight, parseRepsInput, parseWeightInput, startOfWeek, toDisplayWeight, workoutNameForTime,
} from "./format";

const NOW = new Date(2026, 8, 30, 12); // Wednesday, 30 September 2026

describe("numbers and weights", () => {
  it("groups thousands with a narrow no-break space", () => {
    expect(formatNumber(9840, P)).toBe("9 840");
    expect(formatNumber(840, P)).toBe("840");
  });
  it("uses the chosen decimal separator", () => {
    expect(formatNumber(82.5, P)).toBe("82.5");
    expect(formatNumber(82.5, { decimalSeparator: "comma" })).toBe("82,5");
  });
  it("formats weights in kg and lb", () => {
    expect(formatWeight(82.5, P)).toBe("82.5 kg");
    expect(formatWeight(100, { ...P, weightUnit: "lb" })).toBe("220.5 lb");
    expect(toDisplayWeight(100, { weightUnit: "lb" })).toBe(220.5);
  });
  it("parses weights with comma or point and rejects nonsense", () => {
    expect(parseWeightInput("82,5", P)).toEqual({ ok: true, value: 82.5 });
    expect(parseWeightInput("22", P)).toEqual({ ok: true, value: 22 });
    expect(parseWeightInput("", P)).toEqual({ ok: true, value: null });
    expect(parseWeightInput("82.3", P).ok).toBe(false);
    expect(parseWeightInput("abc", P).ok).toBe(false);
    expect(parseWeightInput("1200", P).ok).toBe(false);
  });
  it("converts lb input to kg", () => {
    const r = parseWeightInput("225", { weightUnit: "lb" });
    expect(r.ok && r.value !== null && Math.abs(r.value - 102.058) < 0.01).toBe(true);
  });
  it("parses reps as whole numbers 1–999", () => {
    expect(parseRepsInput("8")).toEqual({ ok: true, value: 8 });
    expect(parseRepsInput("0").ok).toBe(false);
    expect(parseRepsInput("8.5").ok).toBe(false);
  });
});

describe("durations", () => {
  it("formats minutes", () => {
    expect(formatDuration(58)).toBe("58 min");
    expect(formatDuration(64)).toBe("1 h 04 min");
  });
  it("formats clocks", () => {
    expect(formatClock(56)).toBe("0:56");
    expect(formatClock(34 * 60 + 12)).toBe("34:12");
    expect(formatClock(3723)).toBe("1:02:03");
  });
});

describe("dates", () => {
  it("formats long and numeric dates", () => {
    const d = new Date(2026, 8, 29);
    expect(formatDate(d, P, NOW)).toBe("Tuesday, 29 September");
    expect(formatDate(d, { dateFormat: "numeric" }, NOW)).toBe("29.09.2026");
    expect(formatDate(new Date(2025, 0, 3), P, NOW)).toBe("Friday, 3 January 2025");
  });
  it("formats relative days", () => {
    expect(formatRelativeDay(new Date(2026, 8, 30, 8), P, NOW)).toBe("Today");
    expect(formatRelativeDay(new Date(2026, 8, 29), P, NOW)).toBe("Yesterday");
    expect(formatRelativeDay(new Date(2026, 8, 26), P, NOW)).toBe("Sat");
    expect(formatRelativeDay(new Date(2026, 8, 20), P, NOW)).toBe("20 Sep");
  });
  it("finds the week start", () => {
    expect(startOfWeek(NOW, "monday").getDate()).toBe(28);
    expect(startOfWeek(NOW, "sunday").getDate()).toBe(27);
  });
  it("labels weeks", () => {
    expect(formatWeekLabel(new Date(2026, 8, 28), P, NOW)).toBe("This week");
    expect(formatWeekLabel(new Date(2026, 8, 21), P, NOW)).toBe("Last week");
    expect(formatWeekLabel(new Date(2026, 8, 14), P, NOW)).toBe("14–20 September");
    expect(formatWeekLabel(new Date(2026, 7, 31), P, NOW)).toBe("31 August – 6 September");
  });
  it("names workouts by time of day", () => {
    expect(workoutNameForTime(new Date(2026, 8, 30, 9))).toBe("Morning workout");
    expect(workoutNameForTime(new Date(2026, 8, 30, 14))).toBe("Afternoon workout");
    expect(workoutNameForTime(new Date(2026, 8, 30, 19))).toBe("Evening workout");
  });
});
