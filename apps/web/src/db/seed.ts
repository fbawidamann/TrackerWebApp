import { DEFAULT_USER_SETTINGS, type Exercise, type UserSettings } from "@fitness/shared";
import versionFile from "@fitness/shared/catalog-version";
import { db, LOCAL_USER } from "./db";
import { upsert } from "./mutate";

interface CatalogFile {
  catalogVersion: string;
  exercises: Array<Omit<Exercise, "userId" | "createdAt" | "updatedAt" | "deletedAt" | "isCustom">>;
}

/** Loads the bundled exercise catalog into Dexie when its version changed. Built-ins bypass the outbox (never synced). */
export async function seedCatalog(): Promise<void> {
  const current = await db.meta.get("catalogVersion");
  if (current?.value === versionFile.catalogVersion) return;
  const file = (await import("@fitness/shared/catalog")).default as CatalogFile;
  const at = new Date().toISOString();
  const rows: Exercise[] = file.exercises.map((e) => ({ ...e, userId: null, createdAt: at, updatedAt: at, deletedAt: null, isCustom: false }));
  await db.transaction("rw", db.exercises, db.meta, async () => {
    await db.exercises.bulkPut(rows);
    await db.meta.put({ key: "catalogVersion", value: file.catalogVersion });
  });
}

/** Makes sure the user settings row exists. */
export async function ensureSettings(): Promise<void> {
  if (await db.settings.get("user")) return;
  const row: UserSettings = { ...DEFAULT_USER_SETTINGS, userId: LOCAL_USER, updatedAt: new Date().toISOString() };
  await upsert("settings", row);
}

export async function initDb(): Promise<void> {
  await Promise.all([seedCatalog(), ensureSettings()]);
}
