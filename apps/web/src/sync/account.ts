import type { Account } from "@fitness/shared";
import { api } from "@/api/client";
import { db, LOCAL_USER, SYNCED_TABLES } from "@/db/db";
import { setOwner } from "@/db/owner";
import { ensureSettings } from "@/db/seed";
import { stopRest } from "@/db/actions";
import { pendingCount, syncNow } from "./engine";

/** The logged-in account on this device, or null. Stored in Dexie meta so the app opens offline. */
export async function getAccount(): Promise<Account | null> {
  return ((await db.meta.get("account"))?.value as Account | undefined) ?? null;
}

/** Number of completed workouts stored on this device (for "Uploading your data… 142 workouts"). */
export async function localWorkoutCount(): Promise<number> {
  return (await db.activities.toArray()).filter((a) => a.deletedAt === null && a.status === "completed").length;
}

/** Removes all user data from this device (keeps the exercise catalog and device settings). */
export async function wipeUserData(): Promise<void> {
  await db.transaction("rw", [...SYNCED_TABLES.map((t) => db.table(t)), db.outbox, db.meta], async () => {
    for (const t of SYNCED_TABLES) {
      if (t === "exercises") await db.exercises.filter((e) => e.isCustom).delete();
      else await db.table(t).clear();
    }
    await db.outbox.clear();
    for (const k of ["account", "sync", "syncCursor", "syncRejected", "sessionExpired", "rest"]) await db.meta.delete(k);
  });
  setOwner(null);
  await ensureSettings();
}

/**
 * Logs in. On a device that belonged to someone else before (expired session), that data is wiped first.
 * Local data from before the first login is re-owned by the account and uploaded (decided 2026-10-01).
 */
export async function login(username: string, password: string): Promise<Account> {
  const account = await api<Account>("POST", "/api/auth/login", { username, password });
  const previous = await getAccount();
  if (previous && previous.userId !== account.userId) await wipeUserData();

  await db.transaction("rw", [...SYNCED_TABLES.map((t) => db.table(t)), db.meta], async () => {
    for (const t of SYNCED_TABLES) {
      await db.table(t).toCollection().modify((r: { userId?: string | null }) => { if (r.userId === LOCAL_USER) r.userId = account.userId; });
    }
    await db.meta.put({ key: "account", value: account });
    await db.meta.delete("sessionExpired");
  });
  setOwner(account.userId);
  await syncNow({ initial: !previous || previous.userId !== account.userId });
  return account;
}

/** Result of trying to sync before logout: how many changes would be lost. */
export async function prepareLogout(): Promise<number> {
  await syncNow();
  return pendingCount();
}

/** Ends the session on the server (if reachable) and wipes this device. */
export async function logout(): Promise<void> {
  try { await api("POST", "/api/auth/logout", {}); } catch { /* offline: the cookie is dropped with the data anyway */ }
  await stopRest();
  await wipeUserData();
}
