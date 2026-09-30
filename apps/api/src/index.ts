import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { LoginLimiter } from "./auth/rateLimit";
import { openDatabase } from "./db/client";

const port = Number(process.env.PORT ?? 3000);
const staticRoot = process.env.STATIC_ROOT ?? "./public";
const production = process.env.NODE_ENV === "production";
const domain = process.env.APP_DOMAIN;

if (production && !process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required in production");
  process.exit(1);
}

// Development without DATABASE_URL uses a local PGlite database in apps/api/.data (gitignored).
const database = await openDatabase({ url: process.env.DATABASE_URL, dataDir: process.env.DATABASE_URL ? undefined : "./.data/pglite" });

const app = createApp({
  db: database.db,
  limiter: new LoginLimiter(),
  secureCookies: production,
  allowedOrigins: production && domain ? [`https://${domain}`] : [],
}, staticRoot);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Fitness app listening on :${info.port} (static files from ${staticRoot}, db: ${process.env.DATABASE_URL ? "postgres" : "pglite"})`);
});

// Docker sends SIGTERM on stop/restart: close connections cleanly.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => server.close(() => void database.close().finally(() => process.exit(0))));
}
