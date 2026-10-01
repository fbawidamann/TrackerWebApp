import type { Exercise } from "@fitness/shared";
import { de } from "@/i18n/de";
import { en } from "@/i18n/en";

/** Which inputs a set row shows for an exercise. */
export function columnsFor(e: Pick<Exercise, "trackingType"> | undefined): { weight: boolean; reps: boolean; time: boolean } {
  switch (e?.trackingType) {
    case "reps_only": return { weight: false, reps: true, time: false };
    case "duration": return { weight: false, reps: false, time: true };
    case "weight_duration": return { weight: true, reps: false, time: true };
    case "distance_duration": return { weight: false, reps: false, time: true };
    default: return { weight: true, reps: true, time: false };
  }
}

/** Normalises text for forgiving search: lower case, no hyphens/apostrophes/quotes, umlauts folded (ü → u, ß → ss). */
export const normalize = (s: string): string => s.toLowerCase()
  .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
  .replace(/[-'’()„“"/]/g, " ").replace(/\s+/g, " ").trim();

/** Every query word must prefix a word (or appear in the joined text), e.g. "inc db" → Incline … Dumbbell. */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const h = normalize(haystack);
  const words = h.split(" ");
  const joined = words.join("");
  return q.split(" ").every((t) => words.some((w) => w.startsWith(t)) || joined.includes(t));
}

/**
 * Everything an exercise can be found by, in both languages: its name, the English catalog name (from the slug,
 * e.g. "Barbell_Bench_Press_-_Medium_Grip") and the equipment, so "bench press" still finds "Bankdrücken".
 */
export function exerciseSearchText(e: Exercise): string {
  const alias = e.equipment === "dumbbell" ? " db" : e.equipment === "barbell" ? " bb" : "";
  const english = e.slug ? " " + e.slug.replace(/_/g, " ") : "";
  return `${e.name}${english} ${en.equipment[e.equipment]} ${de.equipment[e.equipment]}${alias}`;
}
