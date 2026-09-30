import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

// The sync integration test drives the real web sync engine (apps/web/src) against this server.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../web/src", import.meta.url)) } },
  test: { environment: "node", setupFiles: ["fake-indexeddb/auto"] },
});
