import { SYNC_PUSH_MAX, type PullResponse, type PushResponse, type SyncTable } from "@fitness/shared";
import { api, ApiError, NetworkError } from "@/api/client";
import { db, SYNCED_TABLES } from "@/db/db";

/**
 * Offline-first sync (docs/architecture/sync.md).
 * Push: send the current version of every row in the outbox, then drop the entries the server took.
 * Pull: fetch everything newer than the cursor and apply it, unless the row has local changes waiting.
 */

export interface SyncStatus {
  state: "idle" | "syncing";
  lastSyncAt: string | null;
  error: "offline" | "failed" | null;
}

const key = (table: string, id: string) => `${table}|${id}`;

async function setStatus(patch: Partial<SyncStatus>): Promise<void> {
  const cur = ((await db.meta.get("sync"))?.value as SyncStatus | undefined) ?? { state: "idle", lastSyncAt: null, error: null };
  await db.meta.put({ key: "sync", value: { ...cur, ...patch } });
}

/** Number of rows with changes that haven't reached the server yet. */
export async function pendingCount(): Promise<number> {
  const entries = await db.outbox.toArray();
  return new Set(entries.map((e) => key(e.table, e.rowId))).size;
}

/** Rough upper bound for one push request: GPS tracks are tens of kB each, so many of them are split up. */
const PUSH_MAX_BYTES = 1_000_000;

/** Splits changes into requests of at most SYNC_PUSH_MAX rows and about PUSH_MAX_BYTES. */
export function batches<T>(changes: T[]): T[][] {
  const out: T[][] = [];
  let cur: T[] = [], bytes = 0;
  for (const c of changes) {
    const size = JSON.stringify(c).length;
    if (cur.length && (cur.length >= SYNC_PUSH_MAX || bytes + size > PUSH_MAX_BYTES)) { out.push(cur); cur = []; bytes = 0; }
    cur.push(c);
    bytes += size;
  }
  if (cur.length) out.push(cur);
  return out;
}

async function push(): Promise<void> {
  const entries = await db.outbox.toArray();
  if (!entries.length) return;
  const maxSeq = Math.max(...entries.map((e) => e.seq ?? 0));
  const unique = new Map<string, { table: SyncTable; rowId: string }>();
  for (const e of entries) unique.set(key(e.table, e.rowId), { table: e.table as SyncTable, rowId: e.rowId });

  const changes: Array<{ table: SyncTable; row: Record<string, unknown> & { id: string; updatedAt: string } }> = [];
  const done = new Set<string>();
  for (const { table, rowId } of unique.values()) {
    const row = (await db.table(table).get(rowId)) as (Record<string, unknown> & { id: string; updatedAt: string; userId?: string | null }) | undefined;
    // Missing rows and built-in exercises (userId null) are never sent.
    if (!row || (table === "exercises" && row.userId === null)) { done.add(key(table, rowId)); continue; }
    changes.push({ table, row });
  }

  for (const batch of batches(changes)) {
    const res = await api<PushResponse>("POST", "/api/sync/push", { changes: batch });
    for (const a of res.accepted) done.add(key(a.table, a.id));
    if (res.rejected.length) {
      // Keep rejected rows aside so they don't block the queue forever.
      const prev = ((await db.meta.get("syncRejected"))?.value as unknown[] | undefined) ?? [];
      await db.meta.put({ key: "syncRejected", value: [...prev, ...res.rejected].slice(-100) });
      for (const r of res.rejected) done.add(key(r.table, r.id));
    }
  }
  // Only entries up to maxSeq: changes made while pushing stay queued for the next round.
  await db.outbox.where("seq").belowOrEqual(maxSeq).filter((e) => done.has(key(e.table, e.rowId))).delete();
}

async function pull(serverWinsSettings: boolean): Promise<number> {
  let cursor = ((await db.meta.get("syncCursor"))?.value as string | undefined) ?? "0";
  let applied = 0;
  for (;;) {
    const res = await api<PullResponse>("GET", `/api/sync/pull?since=${encodeURIComponent(cursor)}`);
    await db.transaction("rw", [...SYNCED_TABLES.map((t) => db.table(t)), db.outbox, db.meta], async () => {
      const pending = new Set((await db.outbox.toArray()).map((e) => key(e.table, e.rowId)));
      for (const { table, row } of res.rows) {
        const id = String(row.id);
        if (!(SYNCED_TABLES as readonly string[]).includes(table)) continue;
        if (table === "settings" && serverWinsSettings) {
          // First sync on a device: the account's settings replace this device's defaults, even if those are newer.
          await db.outbox.where("table").equals("settings").delete();
          await db.table(table).put(row);
          applied++;
          continue;
        }
        if (pending.has(key(table, id))) continue; // local change waiting: it will be pushed and win if newer
        const local = (await db.table(table).get(id)) as { updatedAt?: string } | undefined;
        if (!local || String(row.updatedAt) >= String(local.updatedAt ?? "")) {
          await db.table(table).put(row);
          applied++;
        }
      }
      await db.meta.put({ key: "syncCursor", value: res.cursor });
    });
    cursor = res.cursor;
    if (!res.hasMore) break;
  }
  return applied;
}

let running: Promise<void> | null = null;
let again = false;

/**
 * Runs one sync (push, then pull). Concurrent calls join the running one and trigger one more round.
 * `initial`: first sync after a login: pull first so the account's settings win, then push.
 */
export function syncNow(opts: { initial?: boolean } = {}): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    await setStatus({ state: "syncing" });
    try {
      if (opts.initial) await pull(true);
      await push();
      await pull(false);
      await setStatus({ state: "idle", lastSyncAt: new Date().toISOString(), error: null });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await db.meta.put({ key: "sessionExpired", value: true });
        await setStatus({ state: "idle", error: "failed" });
      } else {
        await setStatus({ state: "idle", error: e instanceof NetworkError ? "offline" : "failed" });
      }
      if (!(e instanceof NetworkError) && !(e instanceof ApiError && e.status === 401)) console.error("Sync failed", e);
    } finally {
      running = null;
    }
    if (again) { again = false; await syncNow(); }
  })();
  return running;
}

let started = false;
/** Background triggers: now, when coming back online, every 60 s while visible, and when the app is reopened. */
export function startSyncLoop(isLoggedIn: () => Promise<boolean>): void {
  if (started) return;
  started = true;
  const tick = async () => { if (document.visibilityState === "visible" && (await isLoggedIn())) void syncNow(); };
  window.addEventListener("online", () => void tick());
  document.addEventListener("visibilitychange", () => void tick());
  window.setInterval(() => void tick(), 60_000);
  void tick();
}
