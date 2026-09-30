// Bundles the server (and CLI) with esbuild. @fitness/shared, zod and uuid are bundled in;
// the database drivers and Hono stay external (installed in the runtime image).
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts", "src/cli.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: true,
  external: ["@electric-sql/pglite", "postgres", "drizzle-orm", "hono", "@hono/node-server"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});
