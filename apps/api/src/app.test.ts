import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { LoginLimiter } from "./auth/rateLimit";
import { openDatabase, type Database } from "./db/client";
import { createUser } from "./users";

let database: Database;
let app: ReturnType<typeof createApp>;
let staticRoot: string;

beforeAll(async () => {
  staticRoot = mkdtempSync(join(tmpdir(), "fitness-static-"));
  writeFileSync(join(staticRoot, "index.html"), "<!doctype html><title>Fitness</title>");
  writeFileSync(join(staticRoot, "sw.js"), "self.addEventListener('install',()=>{})");
  mkdirSync(join(staticRoot, "assets"));
  writeFileSync(join(staticRoot, "assets", "index-abc.js"), "console.log(1)");
  database = await openDatabase(); // in-memory PGlite
  await createUser(database.db, "LegendFLOO", "Admin123!", "admin");
  await createUser(database.db, "Anna", "Anna2026!", "user");
});
afterAll(async () => { await database.close(); });

beforeEach(() => {
  app = createApp({ db: database.db, limiter: new LoginLimiter(), secureCookies: false, allowedOrigins: [] }, staticRoot);
});

/* ---------- helpers ---------- */
type Json = Record<string, unknown>;
async function call(method: string, path: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}) {
  const res = await app.request(path, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: (text ? JSON.parse(text) : null) as Json & Json[], res };
}
async function login(username: string, password: string): Promise<string> {
  const r = await call("POST", "/api/auth/login", { username, password });
  expect(r.status).toBe(200);
  return r.res.headers.get("set-cookie")!.split(";")[0]!;
}
const row = (id: string, updatedAt: string, extra: Json = {}) => ({
  id, userId: "local", createdAt: updatedAt, updatedAt, deletedAt: null, name: "Push", position: 0, ...extra,
});

describe("static app", () => {
  it("answers the health check", async () => {
    expect((await call("GET", "/api/health")).json).toEqual({ ok: true });
  });
  it("serves hashed assets with a long cache and never caches the service worker", async () => {
    expect((await app.request("/assets/index-abc.js")).headers.get("cache-control")).toContain("immutable");
    expect((await app.request("/sw.js")).headers.get("cache-control")).toBe("no-cache");
  });
  it("serves the app shell for client-side routes", async () => {
    expect(await (await app.request("/history/calendar")).text()).toContain("<title>Fitness</title>");
  });
});

describe("auth", () => {
  it("logs in with username (any case) and password, then /me works", async () => {
    const cookie = await login("legendfloo", "Admin123!");
    expect(cookie).toMatch(/^fitness_session=/);
    const me = await call("GET", "/api/auth/me", undefined, cookie);
    expect(me.json).toMatchObject({ username: "LegendFLOO", role: "admin" });
  });

  it("gives the same error for a wrong password and an unknown user", async () => {
    const a = await call("POST", "/api/auth/login", { username: "Anna", password: "nope" });
    const b = await call("POST", "/api/auth/login", { username: "Ghost", password: "nope" });
    expect(a.status).toBe(401);
    expect(a.json.error).toBe("Username or password is wrong");
    expect(b.json.error).toBe(a.json.error);
  });

  it("blocks after 5 failed attempts", async () => {
    for (let i = 0; i < 4; i++) await call("POST", "/api/auth/login", { username: "Anna", password: "wrong" });
    const fifth = await call("POST", "/api/auth/login", { username: "Anna", password: "wrong" });
    expect(fifth.status).toBe(429);
    const right = await call("POST", "/api/auth/login", { username: "Anna", password: "Anna2026!" });
    expect(right.status).toBe(429);
  });

  it("logout ends the session", async () => {
    const cookie = await login("Anna", "Anna2026!");
    await call("POST", "/api/auth/logout", {}, cookie);
    expect((await call("GET", "/api/auth/me", undefined, cookie)).status).toBe(401);
  });

  it("changes the own password and checks the rules", async () => {
    const u = await createUser(database.db, "Tom", "Tom2026!!", "user");
    expect(u.username).toBe("Tom");
    const cookie = await login("Tom", "Tom2026!!");
    expect((await call("POST", "/api/auth/password", { currentPassword: "Tom2026!!", newPassword: "short" }, cookie)).status).toBe(400);
    expect((await call("POST", "/api/auth/password", { currentPassword: "wrong!!11", newPassword: "Better2026!" }, cookie)).json.error).toBe("Current password is wrong");
    expect((await call("POST", "/api/auth/password", { currentPassword: "Tom2026!!", newPassword: "Better2026!" }, cookie)).status).toBe(200);
    await login("Tom", "Better2026!");
  });

  it("rejects non-JSON and foreign-origin writes (CSRF guard)", async () => {
    const guarded = createApp({ db: database.db, limiter: new LoginLimiter(), secureCookies: true, allowedOrigins: ["https://tracker.example"] });
    const form = await guarded.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "a=b" });
    expect(form.status).toBe(415);
    const foreign = await guarded.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}" });
    expect(foreign.status).toBe(403);
  });
});

describe("admin", () => {
  it("only admins can manage users", async () => {
    const anna = await login("Anna", "Anna2026!");
    expect((await call("GET", "/api/admin/users", undefined, anna)).status).toBe(403);
  });

  it("creates, resets, disables and deletes users", async () => {
    const admin = await login("LegendFLOO", "Admin123!");
    expect((await call("POST", "/api/admin/users", { username: "Max", password: "weak" }, admin)).status).toBe(400);
    const created = await call("POST", "/api/admin/users", { username: "Max", password: "Max2026!!" }, admin);
    expect(created.status).toBe(201);
    expect((await call("POST", "/api/admin/users", { username: "max", password: "Max2026!!" }, admin)).json.error).toBe("This username is taken");

    const maxCookie = await login("Max", "Max2026!!");
    const id = created.json.id as string;
    await call("PATCH", `/api/admin/users/${id}`, { password: "Reset2026!" }, admin);
    expect((await call("GET", "/api/auth/me", undefined, maxCookie)).status).toBe(401); // sessions ended
    const maxCookie2 = await login("Max", "Reset2026!");

    await call("PATCH", `/api/admin/users/${id}`, { disabled: true }, admin);
    expect((await call("GET", "/api/auth/me", undefined, maxCookie2)).status).toBe(401);
    expect((await call("POST", "/api/auth/login", { username: "Max", password: "Reset2026!" })).status).toBe(401);

    const list = await call("GET", "/api/admin/users", undefined, admin);
    expect(list.json.find((u: Json) => u.username === "Max")).toMatchObject({ disabled: true });
    expect((list.json[0] as Json).role).toBe("admin");

    expect((await call("DELETE", `/api/admin/users/${id}`, {}, admin)).status).toBe(200);
    expect((await call("GET", "/api/admin/users", undefined, admin)).json.some((u: Json) => u.username === "Max")).toBe(false);
  });

  it("the admin can't disable or delete themself", async () => {
    const admin = await login("LegendFLOO", "Admin123!");
    const me = (await call("GET", "/api/auth/me", undefined, admin)).json.userId as string;
    expect((await call("PATCH", `/api/admin/users/${me}`, { disabled: true }, admin)).status).toBe(403);
    expect((await call("DELETE", `/api/admin/users/${me}`, {}, admin)).status).toBe(403);
  });
});

describe("sync", () => {
  it("requires login", async () => {
    expect((await call("GET", "/api/sync/pull?since=0")).status).toBe(401);
  });

  it("pushes, pulls, keeps the newest version and isolates users", async () => {
    const admin = await login("LegendFLOO", "Admin123!");
    const anna = await login("Anna", "Anna2026!");

    const push1 = await call("POST", "/api/sync/push", { changes: [{ table: "routines", row: row("r1", "2026-10-01T10:00:00.000Z") }] }, admin);
    expect(push1.json).toMatchObject({ accepted: [{ table: "routines", id: "r1" }], rejected: [] });

    // An older edit doesn't overwrite a newer one, but is still "accepted" (so the client clears its outbox).
    await call("POST", "/api/sync/push", { changes: [{ table: "routines", row: row("r1", "2026-10-01T12:00:00.000Z", { name: "Push B" }) }] }, admin);
    const stale = await call("POST", "/api/sync/push", { changes: [{ table: "routines", row: row("r1", "2026-10-01T11:00:00.000Z", { name: "Old" }) }] }, admin);
    expect(stale.json.accepted).toHaveLength(1);

    const pulled = await call("GET", "/api/sync/pull?since=0", undefined, admin);
    const routines = (pulled.json.rows as Array<{ table: string; row: Json }>).filter((r) => r.table === "routines");
    expect(routines).toHaveLength(1);
    expect(routines[0]!.row).toMatchObject({ id: "r1", name: "Push B" });
    expect(routines[0]!.row.userId).not.toBe("local"); // owner comes from the session

    // Another user sees nothing of it.
    expect((await call("GET", "/api/sync/pull?since=0", undefined, anna)).json.rows).toEqual([]);

    // The cursor only returns newer changes.
    const again = await call("GET", `/api/sync/pull?since=${pulled.json.cursor as string}`, undefined, admin);
    expect(again.json.rows).toEqual([]);
  });

  it("rejects invalid rows and built-in exercises", async () => {
    const admin = await login("LegendFLOO", "Admin123!");
    const res = await call("POST", "/api/sync/push", { changes: [
      { table: "routines", row: { id: "bad", updatedAt: "2026-10-01T10:00:00.000Z" } },
      { table: "exercises", row: { id: "b1", userId: null, slug: "Squat", name: "Squat", primaryMuscle: "quadriceps", secondaryMuscles: [], equipment: "barbell", trackingType: "weight_reps", level: null, instructions: [], images: [], isCustom: false, createdAt: "x", updatedAt: "2026-10-01T10:00:00.000Z", deletedAt: null } },
    ] }, admin);
    expect(res.json.accepted).toEqual([]);
    expect(res.json.rejected).toHaveLength(2);
  });

  it("pages large pulls", async () => {
    const tom = await login("Tom", "Better2026!");
    const changes = Array.from({ length: 5 }, (_, i) => ({ table: "routines", row: row(`p${i}`, "2026-10-01T10:00:00.000Z") }));
    await call("POST", "/api/sync/push", { changes }, tom);
    const page1 = await call("GET", "/api/sync/pull?since=0&limit=3", undefined, tom);
    expect(page1.json.rows).toHaveLength(3);
    expect(page1.json.hasMore).toBe(true);
    const page2 = await call("GET", `/api/sync/pull?since=${page1.json.cursor as string}&limit=3`, undefined, tom);
    expect(page2.json.rows).toHaveLength(2);
    expect(page2.json.hasMore).toBe(false);
  });
});
