import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { LoginLimiter } from "./auth/rateLimit";
import { openDatabase, type Database } from "./db/client";
import { createUser } from "./users";

/* Open Food Facts proxy (routes/food.ts) against a fake OFF. */
const calls: Array<{ url: string; ua: string | null }> = [];
let down = false;
const fakeFetch = async (url: string, init?: RequestInit) => {
  calls.push({ url, ua: new Headers(init?.headers).get("user-agent") });
  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json" } });
  if (down) return json({}, 503);
  if (url.includes("/api/v2/product/4000417025005")) {
    return json({ status: 1, product: { code: "4000417025005", product_name: "Skyr", brands: "Milsani", nutriments: { "energy-kcal_100g": 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 }, serving_quantity: 150 } });
  }
  if (url.includes("/api/v2/product/")) return json({ status: 0 }, 404);
  if (url.includes("search.openfoodfacts.org")) {
    return json({ hits: [
      { code: "11111111", product_name: "Skyr Natur", brands: ["Arla"], nutriments: { "energy-kcal_100g": 60, proteins_100g: 10.6 } },
      { code: "22222222", product_name: "Skyr ohne Werte", nutriments: {} },
      { code: "bad", product_name: "kaputt" },
    ] });
  }
  return json({}, 404);
};

let database: Database;
let app: ReturnType<typeof createApp>;
let cookie = "";
const get = async (path: string, withCookie = true) => {
  const res = await app.request(path, { headers: withCookie ? { cookie } : {} });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
};

beforeAll(async () => {
  database = await openDatabase();
  await createUser(database.db, "LegendFLOO", "Admin123!", "admin");
});
afterAll(async () => { await database.close(); });
beforeEach(async () => {
  app = createApp({ db: database.db, limiter: new LoginLimiter(), secureCookies: false, allowedOrigins: [], foodFetch: fakeFetch });
  const res = await app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "LegendFLOO", password: "Admin123!" }) });
  cookie = res.headers.get("set-cookie")!.split(";")[0]!;
  calls.length = 0; down = false;
});

describe("food proxy", () => {
  it("needs a login and a valid barcode", async () => {
    expect((await get("/api/food/product/4000417025005", false)).status).toBe(401);
    expect((await get("/api/food/product/12ab")).status).toBe(400);
  });

  it("product: converts, sends our User-Agent, caches", async () => {
    const a = await get("/api/food/product/4000417025005");
    expect(a.status).toBe(200);
    expect(a.json.product).toEqual({ barcode: "4000417025005", name: "Skyr", brand: "Milsani", unit: "g", kcal: 63, protein: 11, carbs: 4, fat: 0.2, portion: 150 });
    expect(calls[0]!.ua).toContain("FitnessTracker");
    await get("/api/food/product/4000417025005");
    expect(calls).toHaveLength(1);
  });

  it("unknown product → null; OFF down → 502", async () => {
    expect((await get("/api/food/product/99999999")).json.product).toBeNull();
    down = true;
    expect((await get("/api/food/product/88888888")).status).toBe(502);
  });

  it("search drops products without kcal or barcode; short queries don't call OFF", async () => {
    const r = await get("/api/food/search?q=skyr&lang=de");
    expect((r.json.products as Array<{ name: string }>).map((p) => p.name)).toEqual(["Skyr Natur"]);
    expect(calls[0]!.url).toContain("langs=de");
    expect((await get("/api/food/search?q=s")).json.products).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("limits OFF calls per user and minute", async () => {
    const codes = Array.from({ length: 31 }, (_, i) => String(10_000_000 + i));
    const statuses: number[] = [];
    for (const c of codes) statuses.push((await get(`/api/food/product/${c}`)).status);
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});
