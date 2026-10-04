import { stravaAckSchema, type StravaRunsResponse, type StravaStatus } from "@fitness/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { stravaConnections } from "../db/schema";
import type { AppEnv } from "../env";
import {
  authorizeUrl, checkState, createState, deauthorize, decrypt, encrypt, exchangeCode, fetchRuns, INITIAL_DAYS, refresh,
  StravaError, type StravaConfig,
} from "../strava";

/** Per user: at most this many run imports per 15 minutes (Strava allows the whole app 100 reads / 15 min). */
const RUNS_PER_WINDOW = 6;
const WINDOW_MS = 15 * 60_000;

/**
 * Strava connection (docs/adr/0009-strava.md):
 *   GET  /status      connection state for the Profile card
 *   POST /connect     → { url } of Strava's consent page (signed state carries the user id)
 *   GET  /callback    Strava redirects here; stores the encrypted tokens, shows a small "done" page
 *   GET  /runs        next batch of new runs (with GPS), converted for the client's importRun
 *   POST /ack         the client saved a batch: move the cursor on
 *   POST /disconnect  revoke at Strava and delete the tokens
 */
export function stravaRoutes(cfg: StravaConfig | null) {
  const r = new Hono<AppEnv>();
  const calls = new Map<string, number[]>();

  // Everything but the callback needs a session. The callback is opened by Strava in a browser that may not have
  // the app's cookie (iPhone home-screen app → in-app browser); the signed state proves who started it.
  r.use("*", async (c, next) => {
    if (c.req.path.endsWith("/callback")) return next();
    if (!c.var.user) return c.json({ error: "Not logged in" }, 401);
    await next();
  });

  r.onError((e, c) => {
    if (e instanceof StravaError) {
      console.warn(`strava: ${e.message}`);
      return c.json({ error: e.status === 429 ? e.message : "Strava is not reachable right now" }, 502);
    }
    throw e;
  });

  const load = async (db: AppEnv["Variables"]["ctx"]["db"], userId: string) =>
    (await db.select().from(stravaConnections).where(eq(stravaConnections.userId, userId)).limit(1))[0];

  r.get("/status", async (c) => {
    const row = cfg ? await load(c.var.ctx.db, c.var.user!.id) : undefined;
    return c.json({
      available: !!cfg, connected: !!row, athleteName: row?.athleteName ?? null,
      connectedAt: row?.connectedAt.toISOString() ?? null, lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
    } satisfies StravaStatus);
  });

  r.post("/connect", (c) => {
    if (!cfg) return c.json({ error: "Strava is not set up on this server" }, 503);
    return c.json({ url: authorizeUrl(cfg, createState(cfg, c.var.user!.id)) });
  });

  r.get("/callback", async (c) => {
    const lang = (c.req.header("accept-language") ?? "").toLowerCase().startsWith("de") ? "de" : "en";
    if (!cfg) return c.html(page(lang, "error"), 503);
    const userId = checkState(cfg, c.req.query("state"));
    if (!userId) return c.html(page(lang, "expired"), 400);
    if (c.req.query("error")) return c.html(page(lang, "denied"));
    const code = c.req.query("code");
    if (!code || code.length > 200) return c.html(page(lang, "error"), 400);
    // The user may untick the box on Strava's page: without activity access there is nothing to import.
    const granted = (c.req.query("scope") ?? "").split(/[ ,]/);
    if (!granted.includes("activity:read_all") && !granted.includes("activity:read")) return c.html(page(lang, "scope"));

    try {
      const t = await exchangeCode(cfg, code);
      const values = {
        athleteId: t.athleteId, athleteName: t.athleteName, scope: t.scope ?? granted.join(","),
        accessToken: encrypt(cfg, t.accessToken), refreshToken: encrypt(cfg, t.refreshToken), expiresAt: t.expiresAt,
      };
      const cursor = Math.floor(cfg.now() / 1000) - INITIAL_DAYS * 86_400;
      await c.var.ctx.db.insert(stravaConnections).values({ userId, ...values, cursor, lastSyncAt: null })
        .onConflictDoUpdate({ target: stravaConnections.userId, set: { ...values, connectedAt: new Date() } });
    } catch (e) {
      console.warn("strava callback failed:", e instanceof Error ? e.message : e);
      return c.html(page(lang, "error"), 502);
    }
    return c.html(page(lang, "connected"));
  });

  /** A valid access token for the user, refreshed (and re-saved) when it expires within 5 minutes. */
  async function accessToken(c: { var: AppEnv["Variables"] }, row: typeof stravaConnections.$inferSelect): Promise<string> {
    if (!cfg) throw new StravaError(503, "not configured");
    if (row.expiresAt.getTime() - cfg.now() > 5 * 60_000) return decrypt(cfg, row.accessToken);
    let t: Awaited<ReturnType<typeof refresh>>;
    try {
      t = await refresh(cfg, decrypt(cfg, row.refreshToken));
    } catch (e) {
      // 400/401 on refresh = the user removed the app in Strava's settings: forget the connection.
      if (e instanceof StravaError && (e.status === 400 || e.status === 401)) {
        await c.var.ctx.db.delete(stravaConnections).where(eq(stravaConnections.userId, row.userId));
        throw new StravaError(410, "revoked");
      }
      throw e;
    }
    await c.var.ctx.db.update(stravaConnections)
      .set({ accessToken: encrypt(cfg, t.accessToken), refreshToken: encrypt(cfg, t.refreshToken), expiresAt: t.expiresAt })
      .where(eq(stravaConnections.userId, row.userId));
    return t.accessToken;
  }

  r.get("/runs", async (c) => {
    if (!cfg) return c.json({ error: "Strava is not set up on this server" }, 503);
    const user = c.var.user!;
    const now = cfg.now();
    const recent = (calls.get(user.id) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= RUNS_PER_WINDOW) return c.json({ error: "Too many Strava imports. Try again in 15 min." }, 429);
    calls.set(user.id, [...recent, now]);

    const row = await load(c.var.ctx.db, user.id);
    if (!row) return c.json({ error: "Strava is not connected" }, 409);
    let token: string;
    try {
      token = await accessToken(c, row);
    } catch (e) {
      if (e instanceof StravaError && e.status === 410) return c.json({ error: "Strava access was removed. Connect again." }, 409);
      throw e;
    }
    const res = await fetchRuns(cfg, token, row.cursor);
    return c.json(res satisfies StravaRunsResponse);
  });

  r.post("/ack", async (c) => {
    const body = stravaAckSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Invalid input" }, 400);
    const row = await load(c.var.ctx.db, c.var.user!.id);
    if (!row) return c.json({ error: "Strava is not connected" }, 409);
    // Only forward, and never into the future: a wrong value can't skip runs that haven't happened yet.
    const nowS = Math.floor((cfg?.now() ?? Date.now()) / 1000);
    const cursor = Math.min(Math.max(row.cursor, body.data.next), nowS);
    await c.var.ctx.db.update(stravaConnections).set({ cursor, lastSyncAt: new Date() }).where(eq(stravaConnections.userId, row.userId));
    return c.json({ ok: true });
  });

  r.post("/disconnect", async (c) => {
    const row = await load(c.var.ctx.db, c.var.user!.id);
    if (row && cfg) {
      try { await deauthorize(cfg, await accessToken(c, row)); } catch { /* already revoked */ }
    }
    await c.var.ctx.db.delete(stravaConnections).where(eq(stravaConnections.userId, c.var.user!.id));
    return c.json({ ok: true });
  });

  return r;
}

type Outcome = "connected" | "denied" | "scope" | "expired" | "error";

const TEXTS: Record<"de" | "en", Record<Outcome, [string, string]>> = {
  de: {
    connected: ["Strava ist verbunden ✓", "Deine Läufe werden jetzt in die App übernommen. Du kannst dieses Fenster schließen (oben „Fertig“) und zur App zurückgehen."],
    denied: ["Nicht verbunden", "Du hast den Zugriff bei Strava abgelehnt. Du kannst es im Profil jederzeit nochmal versuchen."],
    scope: ["Zugriff auf Aktivitäten fehlt", "Bitte lass beim Verbinden das Häkchen bei den Aktivitäten gesetzt, sonst kann die App keine Läufe übernehmen."],
    expired: ["Link abgelaufen", "Bitte starte das Verbinden nochmal im Profil der App."],
    error: ["Das hat nicht geklappt", "Strava war gerade nicht erreichbar. Bitte versuch es gleich nochmal im Profil."],
  },
  en: {
    connected: ["Strava is connected ✓", "Your runs will now come into the app. You can close this window (\"Done\" at the top) and go back to the app."],
    denied: ["Not connected", "You declined access on Strava. You can try again in your profile any time."],
    scope: ["Activity access missing", "Please leave the activities box ticked when connecting, otherwise the app can't import runs."],
    expired: ["Link expired", "Please start connecting again in the app's profile."],
    error: ["That didn't work", "Strava couldn't be reached. Please try again in your profile in a moment."],
  },
};

/** The small page shown after Strava's consent screen (the app may be open in another window). */
function page(lang: "de" | "en", outcome: Outcome): string {
  const [title, text] = TEXTS[lang][outcome];
  const back = lang === "de" ? "Zurück zur App" : "Back to the app";
  const ok = outcome === "connected";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0E12;color:#E9EDF2;font:16px/1.5 system-ui,-apple-system,sans-serif;padding:24px;box-sizing:border-box}
main{max-width:380px;text-align:center}.i{width:64px;height:64px;border-radius:20px;display:grid;place-items:center;margin:0 auto 18px;font-size:32px;background:${ok ? "#FC520022" : "#ffffff14"};color:${ok ? "#FC5200" : "#E9EDF2"}}
h1{font-size:22px;margin:0 0 8px}p{margin:0 0 22px;color:#9AA4B2}a{display:inline-block;padding:13px 22px;border-radius:12px;background:#3D6BFF;color:#fff;text-decoration:none;font-weight:600}
</style></head><body><main><div class="i">${ok ? "✓" : "!"}</div><h1>${title}</h1><p>${text}</p><a href="/profile?strava=${outcome}">${back}</a></main></body></html>`;
}
