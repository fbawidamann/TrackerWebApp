import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { StravaRun } from "@fitness/shared";

/**
 * Strava API client for the server (docs/adr/0009-strava.md).
 * - OAuth 2 (web flow): authorize URL, code → tokens, refresh, deauthorize.
 * - Tokens are encrypted at rest with AES-256-GCM.
 * - The OAuth `state` is signed (HMAC) and carries the user id, so the callback does not need the session cookie:
 *   an iPhone home-screen app opens strava.com in an in-app browser that may not share the app's cookies.
 */

export interface StravaConfig {
  clientId: string;
  clientSecret: string;
  /** 32-byte key for token encryption and state signing (STRAVA_TOKEN_KEY, 64 hex chars). */
  key: Buffer;
  /** https://<domain>/api/strava/callback (must be inside the callback domain set in the Strava API app). */
  redirectUri: string;
  fetch: typeof fetch;
  now: () => number;
}

const API = "https://www.strava.com/api/v3";
const OAUTH = "https://www.strava.com/oauth";
/** Run-like sport types we import. Everything else (rides, walks, gym) is skipped. */
export const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
/** Max runs per GET /api/strava/runs: each run costs one streams request (Strava: 100 requests / 15 min). */
export const RUNS_PER_BATCH = 10;
/** First import after connecting reaches back this far. */
export const INITIAL_DAYS = 30;
const STATE_TTL_MS = 10 * 60_000;

export function configFromEnv(env: NodeJS.ProcessEnv, domain: string | undefined, fetchImpl: typeof fetch = fetch): StravaConfig | null {
  const { STRAVA_CLIENT_ID: id, STRAVA_CLIENT_SECRET: secret, STRAVA_TOKEN_KEY: key } = env;
  if (!id || !secret || !key) return null;
  if (!/^\d+$/.test(id)) throw new Error("STRAVA_CLIENT_ID must be numeric");
  if (!/^[0-9a-f]{64}$/i.test(key)) throw new Error("STRAVA_TOKEN_KEY must be 64 hex characters (openssl rand -hex 32)");
  const base = domain ? `https://${domain}` : `http://localhost:${env.PORT ?? 3000}`;
  return { clientId: id, clientSecret: secret, key: Buffer.from(key, "hex"), redirectUri: `${base}/api/strava/callback`, fetch: fetchImpl, now: Date.now };
}

/* ---------- token encryption ---------- */

export function encrypt(cfg: Pick<StravaConfig, "key">, plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cfg.key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(cfg: Pick<StravaConfig, "key">, box: string): string {
  const [v, iv, tag, ct] = box.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Bad token format");
  const d = createDecipheriv("aes-256-gcm", cfg.key, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

/* ---------- signed, single-use OAuth state ---------- */

const usedNonces = new Map<string, number>();

const sign = (cfg: Pick<StravaConfig, "key">, payload: string) => createHmac("sha256", cfg.key).update(`strava-state:${payload}`).digest("base64url");

export function createState(cfg: Pick<StravaConfig, "key" | "now">, userId: string): string {
  const payload = `${userId}.${cfg.now() + STATE_TTL_MS}.${randomBytes(12).toString("base64url")}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(cfg, payload)}`;
}

/** Returns the user id when the state is genuine, fresh and not used before; otherwise null. */
export function checkState(cfg: Pick<StravaConfig, "key" | "now">, state: string | undefined): string | null {
  if (!state || state.length > 300) return null;
  const [b64, mac] = state.split(".");
  if (!b64 || !mac) return null;
  const payload = Buffer.from(b64, "base64url").toString("utf8");
  const expected = Buffer.from(sign(cfg, payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const [userId, exp, nonce] = payload.split(".");
  const now = cfg.now();
  if (!userId || !nonce || !(Number(exp) > now)) return null;
  for (const [n, e] of usedNonces) if (e < now) usedNonces.delete(n);
  if (usedNonces.has(nonce)) return null;
  usedNonces.set(nonce, Number(exp));
  return userId;
}

/* ---------- OAuth ---------- */

export function authorizeUrl(cfg: StravaConfig, state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId, redirect_uri: cfg.redirectUri, response_type: "code", approval_prompt: "auto",
    // read_all: also runs set to "Only you" and the full track (privacy zones); it is the user's own data in their own app.
    scope: "activity:read_all", state,
  });
  return `${OAUTH}/authorize?${q}`;
}

export interface TokenSet { accessToken: string; refreshToken: string; expiresAt: Date }
export interface TokenGrant extends TokenSet { scope: string | null; athleteId: string; athleteName: string | null }

export class StravaError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function postForm(cfg: StravaConfig, url: string, form: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await cfg.fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new StravaError(res.status, `Strava ${res.status}`);
  return data;
}

const tokens = (d: Record<string, unknown>): TokenSet => {
  if (typeof d.access_token !== "string" || typeof d.refresh_token !== "string" || typeof d.expires_at !== "number") throw new StravaError(502, "Strava sent no tokens");
  return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: new Date(d.expires_at * 1000) };
};

export async function exchangeCode(cfg: StravaConfig, code: string): Promise<TokenGrant> {
  const d = await postForm(cfg, `${OAUTH}/token`, { client_id: cfg.clientId, client_secret: cfg.clientSecret, code, grant_type: "authorization_code" });
  const athlete = (d.athlete ?? {}) as { id?: number | string; firstname?: string; lastname?: string };
  if (athlete.id === undefined) throw new StravaError(502, "Strava sent no athlete");
  const name = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ").trim();
  return { ...tokens(d), scope: typeof d.scope === "string" ? d.scope : null, athleteId: String(athlete.id), athleteName: name ? name.slice(0, 80) : null };
}

export async function refresh(cfg: StravaConfig, refreshToken: string): Promise<TokenSet> {
  return tokens(await postForm(cfg, `${OAUTH}/token`, { client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }));
}

/** Revokes the app's access for this athlete at Strava. Best effort: the local connection is deleted either way. */
export async function deauthorize(cfg: StravaConfig, accessToken: string): Promise<void> {
  try {
    await cfg.fetch(`${OAUTH}/deauthorize`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ access_token: accessToken }) });
  } catch { /* offline / Strava down: the user can still remove the app in Strava's settings */ }
}

/* ---------- activities ---------- */

async function getJson<T>(cfg: StravaConfig, token: string, path: string): Promise<T> {
  const res = await cfg.fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new StravaError(res.status, res.status === 429 ? "Strava rate limit reached. Try again in 15 min." : `Strava ${res.status}`);
  return (await res.json()) as T;
}

interface SummaryActivity {
  id: number | string; name?: string; sport_type?: string; type?: string; start_date: string;
  distance?: number; moving_time?: number; elapsed_time?: number; total_elevation_gain?: number;
  average_heartrate?: number; max_heartrate?: number;
}
type Streams = Partial<Record<"latlng" | "time" | "altitude" | "heartrate", { data: unknown[] }>>;

const hrOrNull = (v: number | undefined) => (v && v >= 20 && v <= 255 ? Math.round(v) : null);

/** Strava summary + streams → the shape of a GPX/FIT import (points with seconds since start). */
export function toRun(a: SummaryActivity, streams: Streams | null): StravaRun {
  const latlng = (streams?.latlng?.data ?? []) as Array<[number, number]>;
  const time = (streams?.time?.data ?? []) as number[];
  const alt = (streams?.altitude?.data ?? []) as number[];
  const hr = (streams?.heartrate?.data ?? []) as number[];
  const points = latlng.length === time.length
    ? latlng.map(([lat, lon], i) => ({ lat, lon, t: time[i]! - (time[0] ?? 0), ele: alt[i] ?? null, hr: hr[i] ?? null }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.t))
    : [];
  return {
    stravaId: String(a.id),
    name: (a.name ?? "").trim().slice(0, 40),
    startedAt: new Date(a.start_date).toISOString(),
    points,
    totals: {
      distanceM: Math.max(0, a.distance ?? 0),
      movingTimeS: Math.max(0, Math.round(a.moving_time ?? 0)),
      elapsedS: Math.max(0, Math.round(a.elapsed_time ?? a.moving_time ?? 0)),
      elevationGainM: a.total_elevation_gain ?? null,
      avgHr: hrOrNull(a.average_heartrate),
      maxHr: hrOrNull(a.max_heartrate),
    },
  };
}

/**
 * Runs that started after `after` (unix s), oldest first, at most RUNS_PER_BATCH with their GPS streams.
 * `next` is the start time of the last activity looked at (runs and skipped non-runs), so nothing is fetched twice.
 */
export async function fetchRuns(cfg: StravaConfig, token: string, after: number): Promise<{ runs: StravaRun[]; next: number; hasMore: boolean }> {
  const list = await getJson<SummaryActivity[]>(cfg, token, `/athlete/activities?after=${after}&per_page=50&page=1`);
  const sorted = [...list].sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date));
  const runs: StravaRun[] = [];
  let next = after, seen = 0;
  for (const a of sorted) {
    const isRun = RUN_TYPES.has(a.sport_type ?? a.type ?? "");
    if (isRun && runs.length >= RUNS_PER_BATCH) break;
    seen++;
    next = Math.max(next, Math.floor(Date.parse(a.start_date) / 1000));
    if (!isRun) continue;
    const streams = await getJson<Streams>(cfg, token, `/activities/${encodeURIComponent(String(a.id))}/streams?keys=latlng,time,altitude,heartrate&key_by_type=true`)
      .catch((e: unknown) => { if (e instanceof StravaError && e.status === 404) return null; throw e; });
    runs.push(toRun(a, streams));
  }
  return { runs, next, hasMore: seen < sorted.length || list.length === 50 };
}
