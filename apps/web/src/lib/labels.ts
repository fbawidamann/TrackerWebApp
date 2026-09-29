import type { Equipment, Exercise, TrackingType } from "@fitness/shared";

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: "Barbell", dumbbell: "Dumbbell", machine: "Machine", cable: "Cable",
  bodyweight: "Bodyweight", kettlebell: "Kettlebell", band: "Band", other: "Other",
};

export const TRACKING_LABEL: Record<TrackingType, string> = {
  weight_reps: "Weight & reps", reps_only: "Reps only", duration: "Time", weight_duration: "Weight & time", distance_duration: "Distance & time",
};

export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

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

/** Normalises text for forgiving search: lower case, no hyphens/apostrophes. */
export const normalize = (s: string): string => s.toLowerCase().replace(/[-'’()]/g, " ").replace(/\s+/g, " ").trim();

/** Every query word must prefix a word (or appear in the joined text), e.g. "inc db" → Incline … Dumbbell. */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const h = normalize(haystack);
  const words = h.split(" ");
  const joined = words.join("");
  return q.split(" ").every((t) => words.some((w) => w.startsWith(t)) || joined.includes(t));
}

export function exerciseSearchText(e: Exercise): string {
  const alias = e.equipment === "dumbbell" ? " db" : e.equipment === "barbell" ? " bb" : "";
  return `${e.name} ${EQUIPMENT_LABEL[e.equipment]}${alias}`;
}
