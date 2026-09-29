import { newId } from "@fitness/shared";
import type { Table } from "dexie";
import { db, LOCAL_USER, SYNCED_TABLES, type SyncedTable } from "./db";

/**
 * The single write path. Every change to user data goes through these helpers:
 * they stamp updatedAt/userId and append the row to the outbox in the same transaction,
 * so the sync engine (M8) can push it later. Never write synced tables directly.
 */

type Row = { id: string; updatedAt?: string; createdAt?: string; userId?: string | null; deletedAt?: string | null };

const nowIso = () => new Date().toISOString();

function table(name: SyncedTable): Table<Row, string> {
  return db.table(name) as unknown as Table<Row, string>;
}

/** Runs `fn` in one read-write transaction over all synced tables + outbox + meta. */
export function write<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction("rw", [...SYNCED_TABLES.map((t) => db.table(t)), db.outbox, db.meta], fn);
}

/** Insert or replace a row (must include all fields). Returns the stored row. */
export async function upsert<T extends Row>(name: SyncedTable, row: T): Promise<T> {
  const at = nowIso();
  const stored = { ...row, userId: row.userId === null ? null : LOCAL_USER, createdAt: row.createdAt ?? at, updatedAt: at, deletedAt: row.deletedAt ?? null } as T;
  await write(async () => {
    await table(name).put(stored);
    await db.outbox.add({ table: name, rowId: stored.id, at });
  });
  return stored;
}

/** Partial update of an existing row. */
export async function patch(name: SyncedTable, id: string, changes: Record<string, unknown>): Promise<void> {
  const at = nowIso();
  await write(async () => {
    await table(name).update(id, { ...changes, updatedAt: at } as Partial<Row>);
    await db.outbox.add({ table: name, rowId: id, at });
  });
}

/** Soft delete: rows are never removed, so the delete can sync to other devices. */
export async function softDelete(name: SyncedTable, ids: string | string[]): Promise<void> {
  const list = Array.isArray(ids) ? ids : [ids];
  if (!list.length) return;
  const at = nowIso();
  await write(async () => {
    for (const id of list) {
      await table(name).update(id, { deletedAt: at, updatedAt: at });
      await db.outbox.add({ table: name, rowId: id, at });
    }
  });
}

/** Undo a soft delete. */
export async function restore(name: SyncedTable, ids: string[]): Promise<void> {
  const at = nowIso();
  await write(async () => {
    for (const id of ids) {
      await table(name).update(id, { deletedAt: null, updatedAt: at });
      await db.outbox.add({ table: name, rowId: id, at });
    }
  });
}

/** Fields every new synced row starts with. */
export function baseRow(): { id: string; userId: string; createdAt: string; updatedAt: string; deletedAt: null } {
  const at = nowIso();
  return { id: newId(), userId: LOCAL_USER, createdAt: at, updatedAt: at, deletedAt: null };
}

export const alive = <T extends { deletedAt: string | null }>(r: T): boolean => r.deletedAt === null;
