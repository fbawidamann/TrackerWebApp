import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export interface Database {
  db: Db;
  close: () => Promise<void>;
}

/** Folder with the SQL migrations (apps/api/drizzle, copied next to dist/ in the Docker image). */
export function migrationsFolder(): string {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  // src/db/client.ts → ../../drizzle; bundled dist/index.js → ../drizzle
  for (const rel of ["../../drizzle", "../drizzle"]) {
    const dir = fileURLToPath(new URL(rel, import.meta.url));
    if (existsSync(join(dir, "meta", "_journal.json"))) return dir;
  }
  throw new Error("SQL migrations not found (set MIGRATIONS_DIR)");
}

/**
 * Production: Postgres via DATABASE_URL. Development and tests: in-process PGlite
 * (a file in `dataDir`, or in memory), so no Docker is needed on the PC.
 * Migrations run on every start (they're idempotent).
 */
export async function openDatabase(opts: { url?: string; dataDir?: string; migrations?: string } = {}): Promise<Database> {
  const folder = opts.migrations ?? migrationsFolder();
  if (opts.url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(opts.url, { max: 10, onnotice: () => {} });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: folder });
    return { db: db as unknown as Db, close: () => client.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (opts.dataDir) mkdirSync(opts.dataDir, { recursive: true });
  const client = new PGlite(opts.dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: folder });
  return { db: db as unknown as Db, close: () => client.close() };
}
