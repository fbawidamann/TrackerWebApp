import { passwordSchema, usernameSchema, type AdminUser, type Role } from "@fitness/shared";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { hashPassword } from "./auth/password";
import { revokeUserSessions } from "./auth/session";
import type { Db } from "./db/client";
import { records, users } from "./db/schema";

export class UserError extends Error {
  constructor(message: string, public status: 400 | 403 | 404 | 409 = 400) { super(message); }
}

export async function findUserByName(db: Db, username: string) {
  const [u] = await db.select().from(users).where(eq(users.usernameLower, username.trim().toLowerCase())).limit(1);
  return u ?? null;
}

export async function createUser(db: Db, username: string, password: string, role: Role = "user") {
  const name = usernameSchema.safeParse(username);
  if (!name.success) throw new UserError(name.error.issues[0]?.message ?? "Invalid username");
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) throw new UserError(pw.error.issues[0]?.message ?? "Invalid password");
  if (await findUserByName(db, name.data)) throw new UserError("This username is taken", 409);
  const [u] = await db.insert(users).values({
    username: name.data, usernameLower: name.data.toLowerCase(), passwordHash: await hashPassword(pw.data), role,
  }).returning();
  return u!;
}

export async function setPassword(db: Db, userId: string, password: string, keepSessionId?: string): Promise<void> {
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) throw new UserError(pw.error.issues[0]?.message ?? "Invalid password");
  await db.update(users).set({ passwordHash: await hashPassword(pw.data) }).where(eq(users.id, userId));
  await revokeUserSessions(db, userId, keepSessionId);
}

export async function setDisabled(db: Db, userId: string, disabled: boolean): Promise<void> {
  await db.update(users).set({ disabledAt: disabled ? new Date() : null }).where(eq(users.id, userId));
  if (disabled) await revokeUserSessions(db, userId);
}

export async function deleteUser(db: Db, userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId)); // sessions and records cascade
}

/** Users for the admin screen, with their number of completed workouts. */
export async function listUsers(db: Db): Promise<AdminUser[]> {
  const rows = await db.select().from(users);
  const counts = await db.select({ userId: records.userId, n: count() }).from(records)
    .where(and(eq(records.tableName, "activities"), isNull(records.deletedAt), sql`${records.data}->>'status' = 'completed'`))
    .groupBy(records.userId);
  const byUser = new Map(counts.map((c) => [c.userId, Number(c.n)]));
  return rows
    .map((u) => ({
      id: u.id, username: u.username, role: u.role, disabled: u.disabledAt !== null,
      createdAt: u.createdAt.toISOString(), lastLoginAt: u.lastLoginAt?.toISOString() ?? null, lastSyncAt: u.lastSyncAt?.toISOString() ?? null,
      workouts: byUser.get(u.id) ?? 0,
    }))
    .sort((a, b) => (a.role === b.role ? a.username.localeCompare(b.username) : a.role === "admin" ? -1 : 1));
}
