import { DEFAULT_USER_SETTINGS, type Exercise, type Language, type UserSettings } from "@fitness/shared";
import versionFile from "@fitness/shared/catalog-version";
import { initialLanguage } from "@/i18n/device";
import { db, LOCAL_USER } from "./db";
import { upsert } from "./mutate";

interface CatalogFile {
  catalogVersion: string;
  exercises: Array<Omit<Exercise, "userId" | "createdAt" | "updatedAt" | "deletedAt" | "isCustom">>;
}

/** Translations of the catalog, keyed by the free-exercise-db id (= `slug`). */
interface TranslationFile {
  exercises: Record<string, { name: string; instructions: string[] }>;
}

let queue: Promise<void> = Promise.resolve();

/**
 * Loads the bundled exercise catalog into Dexie when its version or the language changed. Built-ins bypass the
 * outbox (never synced), so each device stores them in its own language (docs/adr/0007-german-language.md).
 * Calls run one after another, so switching the language quickly can't leave a mix.
 */
export function seedCatalog(language?: Language): Promise<void> {
  const run = queue.then(() => seed(language));
  queue = run.catch(() => {});
  return run;
}

async function seed(language?: Language): Promise<void> {
  const lang = language ?? (await db.settings.get("user"))?.language ?? "en";
  // A changed translation re-seeds too, not just a new catalog.
  const version = `${versionFile.catalogVersion}:${lang}:${versionFile.translations?.[lang] ?? ""}`;
  if ((await db.meta.get("catalogVersion"))?.value === version) return;
  const file = (await import("@fitness/shared/catalog")).default as CatalogFile;
  const translation = lang === "de" ? ((await import("@fitness/shared/catalog-de")).default as TranslationFile).exercises : {};
  const at = new Date().toISOString();
  const rows: Exercise[] = file.exercises.map((e) => {
    const t = e.slug ? translation[e.slug] : undefined;
    return {
      ...e, name: t?.name ?? e.name, instructions: t?.instructions ?? e.instructions,
      userId: null, createdAt: at, updatedAt: at, deletedAt: null, isCustom: false,
    };
  });
  await db.transaction("rw", db.exercises, db.meta, async () => {
    await db.exercises.bulkPut(rows);
    await db.meta.put({ key: "catalogVersion", value: version });
  });
}

/** Makes sure the user settings row exists. A new device starts in its browser's (or last used) language. */
export async function ensureSettings(): Promise<void> {
  if (await db.settings.get("user")) return;
  const row: UserSettings = { ...DEFAULT_USER_SETTINGS, language: initialLanguage(), userId: LOCAL_USER, updatedAt: new Date().toISOString() };
  await upsert("settings", row);
}

export async function initDb(): Promise<void> {
  await ensureSettings();
  await seedCatalog();
}
