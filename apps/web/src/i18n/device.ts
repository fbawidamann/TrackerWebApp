import type { Language } from "@fitness/shared";

/** The language to start with on a new device: the last one used here, else the browser's. */
export function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem("language");
    if (saved === "en" || saved === "de") return saved;
  } catch { /* storage blocked: fall back to the browser language */ }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("de") ? "de" : "en";
}

/** Remembers the language on this device, so the login screen keeps it after a logout wiped the settings. */
export function rememberLanguage(language: Language): void {
  try { localStorage.setItem("language", language); } catch { /* not important */ }
}
