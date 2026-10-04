import { fromOff, type OffProduct } from "@fitness/shared";
import { Hono } from "hono";
import type { AppEnv } from "../env";

/**
 * Open Food Facts proxy (docs/adr/0010-nutrition.md):
 *   GET /product/:barcode   → { product: OffProduct | null }
 *   GET /search?q=…&lang=de → { products: OffProduct[] }
 * Why a proxy: OFF asks for an identifying User-Agent (browsers can't set one), we cache answers (OFF rate limits:
 * ~100 product / ~10 search requests per minute) and the client gets small, already converted objects.
 * The data is ODbL; attribution in Profile → About.
 */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const UA = "FitnessTracker/1.0 (self-hosted personal app; contact: hermes@fbawidamannserver.cloud)";
const PRODUCT_FIELDS = "code,product_name,product_name_de,product_name_en,brands,nutriments,serving_quantity,product_quantity_unit";
const TTL_MS = 24 * 3600_000;
const MAX_CACHE = 2000;
/** Per user: at most this many OFF calls per minute (cache hits are free). */
const PER_MINUTE = 30;

export function foodRoutes(fetchFn: FetchFn = fetch) {
  const r = new Hono<AppEnv>();
  const cache = new Map<string, { at: number; value: unknown }>();
  const calls = new Map<string, number[]>();

  r.use("*", async (c, next) => {
    if (!c.var.user) return c.json({ error: "Not logged in" }, 401);
    await next();
  });

  const cached = <T>(key: string): T | undefined => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
    return undefined;
  };
  const remember = (key: string, value: unknown) => {
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), value });
  };
  const allowed = (userId: string) => {
    const now = Date.now();
    const list = (calls.get(userId) ?? []).filter((t) => now - t < 60_000);
    if (list.length >= PER_MINUTE) return false;
    list.push(now);
    calls.set(userId, list);
    return true;
  };
  const get = async (url: string): Promise<Record<string, unknown> | null> => {
    const res = await fetchFn(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Open Food Facts ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  };

  r.get("/product/:barcode", async (c) => {
    const code = c.req.param("barcode");
    if (!/^\d{6,14}$/.test(code)) return c.json({ error: "Invalid barcode" }, 400);
    const key = `p:${code}`;
    const hit = cached<OffProduct | null>(key);
    if (hit !== undefined) return c.json({ product: hit });
    if (!allowed(c.var.user!.id)) return c.json({ error: "Too many requests, try again in a minute" }, 429);
    try {
      const data = await get(`https://world.openfoodfacts.org/api/v2/product/${code}?fields=${PRODUCT_FIELDS}`);
      const raw = data && data.status !== 0 ? (data.product as Record<string, unknown> | undefined) : undefined;
      const product = raw ? fromOff({ ...raw, code: raw.code ?? code }) : null;
      remember(key, product);
      return c.json({ product });
    } catch (e) {
      console.warn(`food: ${(e as Error).message}`);
      return c.json({ error: "Open Food Facts is not reachable right now" }, 502);
    }
  });

  r.get("/search", async (c) => {
    const q = (c.req.query("q") ?? "").trim().slice(0, 80);
    const lang = c.req.query("lang") === "en" ? "en" : "de";
    if (q.length < 2) return c.json({ products: [] });
    const key = `s:${lang}:${q.toLowerCase()}`;
    const hit = cached<OffProduct[]>(key);
    if (hit) return c.json({ products: hit });
    if (!allowed(c.var.user!.id)) return c.json({ error: "Too many requests, try again in a minute" }, 429);
    try {
      const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=25&langs=${lang}&fields=${PRODUCT_FIELDS}`;
      const data = await get(url);
      const hits = (data?.hits as Array<Record<string, unknown>> | undefined) ?? [];
      const products = hits.map((h) => fromOff(h, lang)).filter((p): p is OffProduct => p !== null && p.kcal !== null).slice(0, 20);
      remember(key, products);
      return c.json({ products });
    } catch (e) {
      console.warn(`food: ${(e as Error).message}`);
      return c.json({ error: "Open Food Facts is not reachable right now" }, 502);
    }
  });

  return r;
}
