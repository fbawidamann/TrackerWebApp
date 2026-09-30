import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import type { Db } from "../db/client";
import { sessions, users } from "../db/schema";

export const SESSION_COOKIE = "fitness_session";
export const SESSION_DAYS = 365;
const DAY = 86_400_000;

export interface SessionUser {
  id: string;
  username: string;
  role: "admin" | "user";
  sessionId: string;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a session and returns the raw token for the cookie (only its hash is stored). */
export async function createSession(db: Db, userId: string, userAgent: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_DAYS * DAY), userAgent: userAgent?.slice(0, 200) ?? null });
  return token;
}

/** Validates a cookie token. Sliding expiry: extended at most once per day. Disabled users have no valid session. */
export async function validateSession(db: Db, token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const id = hashToken(token);
  const now = new Date();
  const [row] = await db.select({
    sessionId: sessions.id, lastUsedAt: sessions.lastUsedAt, id: users.id, username: users.username, role: users.role,
  }).from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now), isNull(users.disabledAt)))
    .limit(1);
  if (!row) return null;
  if (now.getTime() - row.lastUsedAt.getTime() > DAY) {
    await db.update(sessions).set({ lastUsedAt: now, expiresAt: new Date(now.getTime() + SESSION_DAYS * DAY) }).where(eq(sessions.id, id));
  }
  return { id: row.id, username: row.username, role: row.role, sessionId: row.sessionId };
}

export async function deleteSession(db: Db, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Ends all sessions of a user, optionally keeping one (e.g. after changing your own password). */
export async function revokeUserSessions(db: Db, userId: string, keepSessionId?: string): Promise<void> {
  await db.delete(sessions).where(keepSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)) : eq(sessions.userId, userId));
}
