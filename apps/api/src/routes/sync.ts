import { pushRequestSchema, SYNC_PULL_MAX, SYNCED_TABLE_SCHEMAS, type PullResponse, type PushResponse, type SyncTable } from "@fitness/shared";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { records, users } from "../db/schema";
import type { AppEnv } from "../env";

/** Offline-first sync (docs/architecture/sync.md): push = last-write-wins upserts, pull = rows since a cursor. */
export function syncRoutes() {
  const r = new Hono<AppEnv>();

  r.use("*", async (c, next) => {
    if (!c.var.user) return c.json({ error: "Not logged in" }, 401);
    await next();
  });

  r.post("/push", async (c) => {
    const body = pushRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Invalid request" }, 400);
    const { db } = c.var.ctx;
    const userId = c.var.user!.id;
    const res: PushResponse = { accepted: [], rejected: [] };

    await db.transaction(async (tx) => {
      for (const { table, row } of body.data.changes) {
        const parsed = SYNCED_TABLE_SCHEMAS[table].safeParse(row);
        if (!parsed.success) {
          res.rejected.push({ table, id: row.id, reason: parsed.error.issues[0]?.message ?? "Invalid row" });
          continue;
        }
        if (table === "exercises" && (row as { isCustom?: unknown }).isCustom !== true) {
          res.rejected.push({ table, id: row.id, reason: "Built-in exercises don't sync" });
          continue;
        }
        // The owner always comes from the session, never from the client.
        const data = { ...row, userId };
        const rawDeleted = (row as Record<string, unknown>).deletedAt;
        const deletedAt = typeof rawDeleted === "string" ? rawDeleted : null;
        await tx.insert(records)
          .values({ userId, tableName: table, id: row.id, updatedAt: row.updatedAt, deletedAt, data, serverVersion: sql`nextval('sync_version')` })
          .onConflictDoUpdate({
            target: [records.userId, records.tableName, records.id],
            set: { updatedAt: sql`excluded.updated_at`, deletedAt: sql`excluded.deleted_at`, data: sql`excluded.data`, serverVersion: sql`nextval('sync_version')` },
            // Last write wins: an older change never overwrites a newer one. The client still gets it "accepted",
            // because the newer version will reach it with the next pull.
            setWhere: sql`${records.updatedAt} <= excluded.updated_at`,
          });
        res.accepted.push({ table, id: row.id });
      }
      await tx.update(users).set({ lastSyncAt: new Date() }).where(eq(users.id, userId));
    });
    return c.json(res);
  });

  r.get("/pull", async (c) => {
    const since = Number.parseInt(c.req.query("since") ?? "0", 10);
    const limit = Math.min(SYNC_PULL_MAX, Math.max(1, Number.parseInt(c.req.query("limit") ?? String(SYNC_PULL_MAX), 10) || SYNC_PULL_MAX));
    if (!Number.isFinite(since) || since < 0) return c.json({ error: "Invalid cursor" }, 400);
    const { db } = c.var.ctx;
    const userId = c.var.user!.id;
    const rows = await db.select({ tableName: records.tableName, data: records.data, serverVersion: records.serverVersion })
      .from(records)
      .where(and(eq(records.userId, userId), gt(records.serverVersion, since)))
      .orderBy(asc(records.serverVersion))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    await db.update(users).set({ lastSyncAt: new Date() }).where(eq(users.id, userId));
    const out: PullResponse = {
      rows: page.map((r) => ({ table: r.tableName as SyncTable, row: r.data as Record<string, unknown> })),
      cursor: String(page.length ? page[page.length - 1]!.serverVersion : since),
      hasMore,
    };
    return c.json(out);
  });

  return r;
}
