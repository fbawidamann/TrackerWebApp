import type { Language } from "@fitness/shared";
import { useSettings } from "@/data/hooks";
import { de } from "./de";
import { en, type Dict } from "./en";

/**
 * UI texts in English and German (docs/adr/0007-german-language.md). Components read the dictionary with
 * `useT()`; code outside React (actions, file import, sync errors) uses `tr()`, which follows the
 * language the Layout last applied.
 */
const DICTS: Record<Language, Dict> = { en, de };

let current: Language = "en";

export function setLanguage(language: Language): void {
  current = language;
}

export const currentLanguage = (): Language => current;

/** The dictionary of the current language, for code outside React. */
export const tr = (): Dict => DICTS[current];

/** The dictionary of the user's language. */
export function useT(): Dict {
  return DICTS[useSettings().language];
}

export { initialLanguage, rememberLanguage } from "./device";
export type { Dict };
