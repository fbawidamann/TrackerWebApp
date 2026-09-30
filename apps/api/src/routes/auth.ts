import { changePasswordRequestSchema, loginRequestSchema, type Account } from "@fitness/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { dummyHash, verifyPassword } from "../auth/password";
import { createSession, deleteSession, SESSION_COOKIE, SESSION_DAYS } from "../auth/session";
import { users } from "../db/schema";
import type { AppEnv } from "../env";
import { findUserByName, setPassword, UserError } from "../users";

const WRONG = "Username or password is wrong";
const BLOCKED = "Too many attempts. Try again in 15 min.";

export function authRoutes() {
  const r = new Hono<AppEnv>();

  r.post("/login", async (c) => {
    const { db, limiter, secureCookies } = c.var.ctx;
    const body = loginRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: WRONG }, 400);
    const { username, password } = body.data;
    const ip = c.var.clientIp;
    if (limiter.isBlocked(ip, username)) return c.json({ error: BLOCKED }, 429);

    const user = await findUserByName(db, username);
    // Always run one scrypt check, so a missing username takes as long as a wrong password.
    const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
    if (!user || !ok || user.disabledAt) {
      limiter.fail(ip, username);
      return c.json({ error: limiter.isBlocked(ip, username) ? BLOCKED : WRONG }, limiter.isBlocked(ip, username) ? 429 : 401);
    }
    limiter.success(ip, username);
    const token = await createSession(db, user.id, c.req.header("user-agent") ?? null);
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: secureCookies, sameSite: "Lax", path: "/", maxAge: SESSION_DAYS * 86_400 });
    return c.json({ userId: user.id, username: user.username, role: user.role } satisfies Account);
  });

  r.post("/logout", async (c) => {
    const u = c.var.user;
    if (u) await deleteSession(c.var.ctx.db, u.sessionId);
    deleteCookie(c, SESSION_COOKIE, { path: "/", secure: c.var.ctx.secureCookies });
    return c.json({ ok: true });
  });

  r.get("/me", (c) => {
    const u = c.var.user;
    if (!u) return c.json({ error: "Not logged in" }, 401);
    return c.json({ userId: u.id, username: u.username, role: u.role } satisfies Account);
  });

  r.post("/password", async (c) => {
    const u = c.var.user;
    if (!u) return c.json({ error: "Not logged in" }, 401);
    const body = changePasswordRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Invalid password" }, 400);
    const { db } = c.var.ctx;
    const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, u.id)).limit(1);
    if (!row || !(await verifyPassword(body.data.currentPassword, row.hash))) return c.json({ error: "Current password is wrong" }, 400);
    try {
      await setPassword(db, u.id, body.data.newPassword, u.sessionId);
    } catch (e) {
      if (e instanceof UserError) return c.json({ error: e.message }, e.status);
      throw e;
    }
    return c.json({ ok: true });
  });

  return r;
}
