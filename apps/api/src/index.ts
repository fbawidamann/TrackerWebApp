import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const staticRoot = process.env.STATIC_ROOT ?? "./public";

const app = createApp(staticRoot);
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Fitness app listening on :${info.port} (static files from ${staticRoot})`);
});

// Docker sends SIGTERM on stop/restart: close open connections cleanly.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
