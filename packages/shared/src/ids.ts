import { v5 as uuidv5, v7 as uuidv7 } from "uuid";

/** Fixed namespace for deterministic built-in exercise IDs. Never change it: IDs must match on every device. */
const CATALOG_NAMESPACE = "6f1c2b8e-4f7a-4e0f-9c43-5d2a1b7e8c90";

/** New time-ordered ID for user data (UUIDv7). */
export function newId(): string {
  return uuidv7();
}

/** Deterministic ID for a built-in catalog exercise, derived from its free-exercise-db id. */
export function builtinExerciseId(slug: string): string {
  return uuidv5(slug, CATALOG_NAMESPACE);
}
