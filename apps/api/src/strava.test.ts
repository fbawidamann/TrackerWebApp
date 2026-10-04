import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createApp } from "./app";
import { LoginLimiter } from "./auth/rateLimit";
import { openDatabase, type Database } from "./db/client";
import { stravaConnections } from "./db/schema";
import { checkState, createState, decrypt, encrypt, toRun, type StravaConfig } from "./strava";
import { createUser } from "./users";

/* ---------- a fake Strava (OAuth + API) ---------- */
interface Fake {
  calls: Array<{ url: string; body: string; auth: string | null }>;
  activities: Array<Record<string, unknown>>;
  refreshFails: boolean;
  tokenN: number;
}
const fake: Fake = { calls: [], activities: [], refreshFails: false, tokenN: 0 };
let clock = Date.parse("2026-10-04T12:00:00Z");

const fakeFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  const body = init?.body ? String(init.body) : "";
  const auth = new Headers(init?.headers).get("authorization");
  fake.calls.push({ url, body, auth });
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  if (url.endsWith("/oauth/token")) {
    const p = new URLSearchParams(body);
    if (p.get("grant_type") === "refresh_token" && fake.refreshFails) return json({ message: "Bad Request" }, 400);
    fake.tokenN++;
    return json({
      access_token: `access-${fake.tokenN}`, refresh_token: `refresh-${fake.tokenN}`, expires_at: Math.floor(clock / 1000) + 6 * 3600,
      scope: "read,activity:read_all", ...(p.get("grant_type") === "authorization_code" ? { athlete: { id: 4242, firstname: "Flo", lastname: "B" } } : {}),
    });
  }
  if (url.endsWith("/oauth/deauthorize")) return json({ access_token: "x" });
  if (url.includes("/athlete/activities")) {
    const after = Number(new URL(url).searchParams.get("after"));
    return json(fake.activities.filter((a) => Date.parse(String(a.start_date)) / 1000 > after));
  }
  const m = url.match(/\/activities\/(\d+)\/streams/);
  if (m) {
    return json({
      latlng: { data: [[49.0, 12.1], [49.001, 12.1], [49.002, 12.1]] },
      time: { data: [0, 30, 60] }, altitude: { data: [330, 331, 333] }, heartrate: { data: [140, 150, 155] },
    });
  }
  return json({ message: "Not Found" }, 404);
};

const cfg: StravaConfig = {
  clientId: "12345", clientSecret: "shh", key: Buffer.alloc(32, 7), redirectUri: "https://t.example/api/strava/callback",
  fetch: fakeFetch, now: () => clock,
};

let database: Database;
let app: ReturnType<typeof createApp>;
let flo = "", anna = "", floId = "";

async function call(method: string, path: string, cookie = "", body?: unknown) {
  const res = await app.request(path, {
    method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text) as Record<string, unknown>; } catch { /* html */ }
  return { status: res.status, json, text };
}
async function login(username: string, password: string) {
  const res = await app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
  return res.headers.get("set-cookie")!.split(";")[0]!;
}
async function connect(cookie: string) {
  const { json } = await call("POST", "/api/strava/connect", cookie, {});
  const state = new URL(String(json.url)).searchParams.get("state")!;
  return call("GET", `/api/strava/callback?state=${encodeURIComponent(state)}&code=abc&scope=read,activity:read_all`);
}

beforeAll(async () => {
  database = await openDatabase();
  floId = (await createUser(database.db, "LegendFLOO", "Admin123!", "admin")).id;
  await createUser(database.db, "Anna", "Anna2026!", "user");
});
afterAll(async () => { await database.close(); });
beforeEach(async () => {
  app = createApp({ db: database.db, limiter: new LoginLimiter(), secureCookies: false, allowedOrigins: [], strava: cfg }, undefined);
  flo = await login("LegendFLOO", "Admin123!");
  anna = await login("Anna", "Anna2026!");
  fake.calls = []; fake.activities = []; fake.refreshFails = false;
  await database.db.delete(stravaConnections);
});

describe("strava crypto + state", () => {
  it("encrypts tokens (random IV, tamper-proof)", () => {
    const a = encrypt(cfg, "secret-token"), b = encrypt(cfg, "secret-token");
    expect(a).not.toBe(b);
    expect(a).not.toContain("secret");
    expect(decrypt(cfg, a)).toBe("secret-token");
    const parts = a.split(".");
    parts[3] = parts[3]!.slice(0, -2) + (parts[3]!.endsWith("A") ? "B" : "A") + parts[3]!.slice(-1);
    expect(() => decrypt(cfg, parts.join("."))).toThrow();
    expect(() => decrypt({ key: Buffer.alloc(32, 8) }, a)).toThrow();
  });

  it("state: signed, single use, expires after 10 min", () => {
    const s = createState(cfg, "user-1");
    expect(checkState(cfg, s)).toBe("user-1");
    expect(checkState(cfg, s)).toBeNull(); // replay
    const forged = Buffer.from("user-2.9999999999999.nonce").toString("base64url") + "." + s.split(".")[1];
    expect(checkState(cfg, forged)).toBeNull();
    const old = createState(cfg, "user-1");
    clock += 11 * 60_000;
    expect(checkState(cfg, old)).toBeNull();
    expect(checkState(cfg, undefined)).toBeNull();
  });

  it("toRun converts summary + streams (seconds since start, totals, bad HR dropped)", () => {
    const r = toRun({ id: 7, name: " Morning Run ", start_date: "2026-10-01T06:00:00Z", distance: 5012.3, moving_time: 1500, elapsed_time: 1600, total_elevation_gain: 12, average_heartrate: 151.6, max_heartrate: 300 },
      { latlng: { data: [[1, 2], [1.001, 2]] }, time: { data: [5, 35] }, altitude: { data: [10, 11] }, heartrate: { data: [140, 150] } });
    expect(r).toMatchObject({ stravaId: "7", name: "Morning Run", startedAt: "2026-10-01T06:00:00.000Z" });
    expect(r.points).toEqual([{ lat: 1, lon: 2, t: 0, ele: 10, hr: 140 }, { lat: 1.001, lon: 2, t: 30, ele: 11, hr: 150 }]);
    expect(r.totals).toEqual({ distanceM: 5012.3, movingTimeS: 1500, elapsedS: 1600, elevationGainM: 12, avgHr: 152, maxHr: null });
    expect(toRun({ id: 8, start_date: "2026-10-01T06:00:00Z" }, null).points).toEqual([]);
  });
});

describe("strava routes", () => {
  it("needs a login (except the callback)", async () => {
    expect((await call("GET", "/api/strava/status")).status).toBe(401);
    expect((await call("POST", "/api/strava/connect", "", {})).status).toBe(401);
    expect((await call("GET", "/api/strava/callback?state=x&code=y")).status).toBe(400);
  });

  it("status says 'not available' when the server has no Strava keys", async () => {
    app = createApp({ db: database.db, limiter: new LoginLimiter(), secureCookies: false, allowedOrigins: [], strava: null }, undefined);
    const s = await call("GET", "/api/strava/status", flo);
    expect(s.json).toMatchObject({ available: false, connected: false });
    expect((await call("POST", "/api/strava/connect", flo, {})).status).toBe(503);
  });

  it("connect → consent URL → callback stores encrypted tokens for the right user", async () => {
    const { json } = await call("POST", "/api/strava/connect", flo, {});
    const url = new URL(String(json.url));
    expect(url.origin + url.pathname).toBe("https://www.strava.com/oauth/authorize");
    expect(url.searchParams.get("scope")).toBe("activity:read_all");
    expect(url.searchParams.get("redirect_uri")).toBe(cfg.redirectUri);

    const cb = await call("GET", `/api/strava/callback?state=${encodeURIComponent(url.searchParams.get("state")!)}&code=abc&scope=read,activity:read_all`);
    expect(cb.status).toBe(200);
    expect(cb.text).toContain("/profile?strava=connected");
    const [row] = await database.db.select().from(stravaConnections).where(eq(stravaConnections.userId, floId));
    expect(row).toMatchObject({ athleteId: "4242", athleteName: "Flo B" });
    expect(row!.accessToken).not.toContain("access-");
    expect(decrypt(cfg, row!.refreshToken)).toMatch(/^refresh-/);
    expect(fake.calls.find((c) => c.url.endsWith("/oauth/token"))!.body).toContain("client_secret=shh");

    expect((await call("GET", "/api/strava/status", flo)).json).toMatchObject({ available: true, connected: true, athleteName: "Flo B" });
    expect((await call("GET", "/api/strava/status", anna)).json).toMatchObject({ connected: false });
  });

  it("callback: denied, missing activity scope and replayed state store nothing", async () => {
    const st = async () => new URL(String((await call("POST", "/api/strava/connect", flo, {})).json.url)).searchParams.get("state")!;
    expect((await call("GET", `/api/strava/callback?state=${encodeURIComponent(await st())}&error=access_denied`)).text).toContain("strava=denied");
    expect((await call("GET", `/api/strava/callback?state=${encodeURIComponent(await st())}&code=abc&scope=read`)).text).toContain("strava=scope");
    const s = await st();
    await call("GET", `/api/strava/callback?state=${encodeURIComponent(s)}&error=access_denied`);
    expect((await call("GET", `/api/strava/callback?state=${encodeURIComponent(s)}&code=abc&scope=activity:read_all`)).status).toBe(400);
    expect(await database.db.select().from(stravaConnections)).toHaveLength(0);
  });

  it("runs: only runs, oldest first, with streams; ack moves the cursor so nothing comes twice", async () => {
    await connect(flo);
    const day = (d: number, h = 7) => new Date(Date.UTC(2026, 9, d, h)).toISOString();
    clock = Date.parse("2026-10-04T12:00:00Z");
    fake.activities = [
      { id: 3, name: "Evening Run", sport_type: "Run", start_date: day(3, 18), distance: 8000, moving_time: 2600, elapsed_time: 2700 },
      { id: 1, name: "Ride", sport_type: "Ride", start_date: day(1), distance: 30000, moving_time: 3600 },
      { id: 2, name: "Trail", sport_type: "TrailRun", start_date: day(2), distance: 10000, moving_time: 3900 },
    ];
    const first = await call("GET", "/api/strava/runs", flo);
    expect(first.status).toBe(200);
    const runs = first.json.runs as Array<{ stravaId: string; points: unknown[] }>;
    expect(runs.map((r) => r.stravaId)).toEqual(["2", "3"]);
    expect(runs[0]!.points).toHaveLength(3);
    expect(fake.calls.filter((c) => c.url.includes("/streams"))).toHaveLength(2); // none for the ride
    expect(fake.calls.find((c) => c.url.includes("/athlete/activities"))!.auth).toBe("Bearer access-" + fake.tokenN);

    expect((await call("POST", "/api/strava/ack", flo, { next: first.json.next })).status).toBe(200);
    const again = await call("GET", "/api/strava/runs", flo);
    expect(again.json.runs).toEqual([]);
    expect((await call("GET", "/api/strava/status", flo)).json.lastSyncAt).not.toBeNull();
  });

  it("ack never moves the cursor back or into the future", async () => {
    await connect(flo);
    const [before] = await database.db.select().from(stravaConnections);
    await call("POST", "/api/strava/ack", flo, { next: 5 });
    expect((await database.db.select().from(stravaConnections))[0]!.cursor).toBe(before!.cursor);
    await call("POST", "/api/strava/ack", flo, { next: 4_000_000_000 });
    expect((await database.db.select().from(stravaConnections))[0]!.cursor).toBe(Math.floor(clock / 1000));
  });

  it("refreshes an expired token and saves the new one; a revoked app disconnects", async () => {
    await connect(flo);
    clock += 7 * 3600_000; // token expired
    expect((await call("GET", "/api/strava/runs", flo)).status).toBe(200);
    const [row] = await database.db.select().from(stravaConnections);
    expect(decrypt(cfg, row!.accessToken)).toBe(`access-${fake.tokenN}`);
    expect(fake.calls.some((c) => c.body.includes("grant_type=refresh_token"))).toBe(true);

    clock += 7 * 3600_000;
    fake.refreshFails = true;
    const r = await call("GET", "/api/strava/runs", flo);
    expect(r.status).toBe(409);
    await new Promise((res) => setTimeout(res, 20));
    expect(await database.db.select().from(stravaConnections)).toHaveLength(0);
  });

  it("limits imports per user (6 per 15 min)", async () => {
    await connect(anna);
    for (let i = 0; i < 6; i++) expect((await call("GET", "/api/strava/runs", anna)).status).toBe(200);
    expect((await call("GET", "/api/strava/runs", anna)).status).toBe(429);
  });

  it("disconnect revokes at Strava and deletes the tokens", async () => {
    await connect(flo);
    expect((await call("POST", "/api/strava/disconnect", flo, {})).status).toBe(200);
    expect(fake.calls.some((c) => c.url.endsWith("/oauth/deauthorize"))).toBe(true);
    expect(await database.db.select().from(stravaConnections)).toHaveLength(0);
    expect((await call("GET", "/api/strava/runs", flo)).status).toBe(409);
  });
});
