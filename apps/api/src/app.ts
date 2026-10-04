import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SESSION_COOKIE, validateSession } from "./auth/session";
import type { AppContext, AppEnv } from "./env";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { foodRoutes, type FetchFn } from "./routes/food";
import { stravaRoutes } from "./routes/strava";
import { syncRoutes } from "./routes/sync";

/**
 * The single app container (docs/adr/0004-deployment.md, 0005-backend-auth-and-sync.md):
 *   /api/*  → API (health, auth, admin, sync, strava, food)
 *   /*      → the built frontend, with index.html as fallback for client-side routes
 */
export function createApp(ctx: AppContext, staticRoot?: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.use("/api/*", async (c, next) => {
    c.set("ctx", ctx);
    // Behind Traefik the client IP comes from X-Forwarded-For (the app port only listens on 127.0.0.1).
    c.set("clientIp", c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local");

    // CSRF guard for state-changing requests: JSON only, and from our own origin.
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      if (!(c.req.header("content-type") ?? "").includes("application/json")) return c.json({ error: "Expected JSON" }, 415);
      const origin = c.req.header("origin");
      if (ctx.allowedOrigins.length && (!origin || !ctx.allowedOrigins.includes(origin))) return c.json({ error: "Forbidden origin" }, 403);
    }
    c.set("user", await validateSession(ctx.db, getCookie(c, SESSION_COOKIE)));
    c.header("Cache-Control", "no-store");
    await next();
  });

  app.route("/api/auth", authRoutes());
  app.route("/api/admin", adminRoutes());
  app.route("/api/sync", syncRoutes());
  app.route("/api/strava", stravaRoutes(ctx.strava ?? null));
  app.route("/api/food", foodRoutes(ctx.foodFetch as FetchFn | undefined));
  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "Something went wrong" }, 500);
  });

  if (staticRoot && existsSync(join(staticRoot, "index.html"))) {
    const indexHtml = readFileSync(join(staticRoot, "index.html"), "utf8");
    // Cache rules: hashed assets forever; the service worker, manifest and HTML must always be revalidated,
    // otherwise installed PWAs never see updates.
    app.use("*", async (c, next) => {
      await next();
      const p = c.req.path;
      if (p.startsWith("/assets/")) c.header("Cache-Control", "public, max-age=31536000, immutable");
      else if (p.startsWith("/exercise-images/")) c.header("Cache-Control", "public, max-age=2592000");
      else if (p === "/sw.js" || p.startsWith("/workbox-") || p.endsWith(".webmanifest") || p === "/" || p.endsWith(".html")) c.header("Cache-Control", "no-cache");
    });
    app.use("*", serveStatic({ root: staticRoot }));
    // Client-side routes (/history, /exercises/…): serve the app shell.
    app.get("*", (c) => {
      c.header("Cache-Control", "no-cache");
      return c.html(indexHtml);
    });
  }

  return app;
}
