import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  const root = mkdtempSync(join(tmpdir(), "fitness-static-"));
  writeFileSync(join(root, "index.html"), "<!doctype html><title>Fitness</title>");
  writeFileSync(join(root, "sw.js"), "self.addEventListener('install',()=>{})");
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "assets", "index-abc.js"), "console.log(1)");
  app = createApp(root);
});

describe("app container", () => {
  it("answers the health check", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 404 JSON for unknown API routes", async () => {
    expect((await app.request("/api/nope")).status).toBe(404);
  });

  it("serves hashed assets with a long cache", async () => {
    const res = await app.request("/assets/index-abc.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("immutable");
  });

  it("never caches the service worker", async () => {
    const res = await app.request("/sw.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  it("serves the app shell for client-side routes", async () => {
    const res = await app.request("/history/calendar");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>Fitness</title>");
  });
});
