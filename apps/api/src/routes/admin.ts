import { createUserRequestSchema, updateUserRequestSchema } from "@fitness/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { users } from "../db/schema";
import type { AppEnv } from "../env";
import { createUser, deleteUser, listUsers, setDisabled, setPassword, UserError } from "../users";

/** User management for role "admin" only (docs/design/screens/admin-users.md). */
export function adminRoutes() {
  const r = new Hono<AppEnv>();

  r.use("*", async (c, next) => {
    const u = c.var.user;
    if (!u) return c.json({ error: "Not logged in" }, 401);
    if (u.role !== "admin") return c.json({ error: "Admins only" }, 403);
    await next();
  });

  r.onError((e, c) => {
    if (e instanceof UserError) return c.json({ error: e.message }, e.status);
    throw e;
  });

  r.get("/users", async (c) => c.json(await listUsers(c.var.ctx.db)));

  r.post("/users", async (c) => {
    const body = createUserRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Invalid input" }, 400);
    const u = await createUser(c.var.ctx.db, body.data.username, body.data.password, "user");
    return c.json({ id: u.id, username: u.username }, 201);
  });

  r.patch("/users/:id", async (c) => {
    const id = c.req.param("id");
    const body = updateUserRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Invalid input" }, 400);
    const { db } = c.var.ctx;
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1).catch(() => []);
    if (!target) return c.json({ error: "User not found" }, 404);
    if (body.data.disabled !== undefined) {
      if (id === c.var.user!.id) return c.json({ error: "You can't disable yourself" }, 403);
      await setDisabled(db, id, body.data.disabled);
    }
    if (body.data.password !== undefined) await setPassword(db, id, body.data.password);
    return c.json({ ok: true });
  });

  r.delete("/users/:id", async (c) => {
    const id = c.req.param("id");
    if (id === c.var.user!.id) return c.json({ error: "You can't delete yourself" }, 403);
    const { db } = c.var.ctx;
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1).catch(() => []);
    if (!target) return c.json({ error: "User not found" }, 404);
    await deleteUser(db, id);
    return c.json({ ok: true });
  });

  return r;
}
