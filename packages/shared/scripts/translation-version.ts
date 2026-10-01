import { createHash } from "node:crypto";

export interface TranslationFile {
  exercises: Record<string, { name: string; instructions: string[] }>;
}

/** Short hash of a catalog translation, so devices re-seed when only the translated text changed. */
export function translationVersion(t: TranslationFile): string {
  return createHash("sha1").update(JSON.stringify(t.exercises)).digest("hex").slice(0, 12);
}
