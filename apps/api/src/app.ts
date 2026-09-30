import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The single app container (docs/adr/0004-deployment.md):
 *   /api/*  → API (M7: auth, sync; for now only a health check)
 *   /*      → the built frontend, with index.html as fallback for client-side routes
 */
export function createApp(staticRoot: string): Hono {
  const app = new Hono();
  const indexHtml = readFileSync(join(staticRoot, "index.html"), "utf8");

  app.get("/api/health", (c) => c.json({ ok: true }));
  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

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

  return app;
}
