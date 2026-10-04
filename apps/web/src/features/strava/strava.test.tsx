import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/db";
import { ToastProvider } from "@/ui/Toast";
import { StravaCard } from "./StravaCard";
import { importStravaRuns, resetStravaState, stravaTotals } from "./strava";

type Handler = (method: string, path: string, body: unknown) => { status?: number; json: unknown };
let handler: Handler;
const requests: Array<{ method: string; path: string; body: unknown }> = [];

beforeEach(async () => {
  resetStravaState();
  requests.length = 0;
  await db.runs.clear();
  await db.activities.clear();
  await db.runTracks.clear();
  vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) as unknown : undefined;
    const method = init?.method ?? "GET";
    requests.push({ method, path, body });
    const r = handler(method, path, body);
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const run = (id: string, startedAt: string) => ({
  stravaId: id, name: `Run ${id}`, startedAt,
  points: [{ lat: 49, lon: 12, t: 0, ele: 300, hr: 140 }, { lat: 49.001, lon: 12, t: 30, ele: 301, hr: 150 }, { lat: 49.002, lon: 12, t: 60, ele: 302, hr: 155 }],
  totals: { distanceM: 5000, movingTimeS: 1500, elapsedS: 1600, elevationGainM: 10, avgHr: 150, maxHr: 170 },
});
const status = (over: object = {}) => ({ available: true, connected: true, athleteName: "Flo B", connectedAt: null, lastSyncAt: null, ...over });

describe("Strava import (client)", () => {
  it("saves runs with Strava totals and id, confirms each batch, skips known runs", async () => {
    let page = 0;
    handler = (m, p) => {
      if (p === "/api/strava/runs") {
        page++;
        return { json: page === 1 ? { runs: [run("11", "2026-10-01T06:00:00Z"), run("12", "2026-10-02T06:00:00Z")], next: 100, hasMore: true }
          : { runs: [run("11", "2026-10-01T06:00:00Z")], next: 200, hasMore: false } };
      }
      if (p === "/api/strava/status") return { json: status() };
      return { json: { ok: true } };
    };
    const r = await importStravaRuns();
    expect(r).toEqual({ added: 2, skipped: 1 });
    expect(requests.filter((x) => x.path === "/api/strava/ack").map((x) => x.body)).toEqual([{ next: 100 }, { next: 200 }]);
    const runs = await db.runs.toArray();
    expect(runs).toHaveLength(2);
    expect(runs.map((x) => x.stravaId).sort()).toEqual(["11", "12"]);
    expect(runs[0]).toMatchObject({ source: "strava", distanceM: 5000, movingTimeS: 1500, avgHr: 150, maxHr: 170, hasTrack: true });
  });

  it("a run already imported as GPX/FIT (same start) is not added again", async () => {
    handler = (m, p) => p === "/api/strava/runs" ? { json: { runs: [run("21", "2026-10-03T06:00:00Z")], next: 1, hasMore: false } } : { json: status() };
    await importStravaRuns();
    handler = (m, p) => p === "/api/strava/runs" ? { json: { runs: [run("99", "2026-10-03T06:00:30Z")], next: 2, hasMore: false } } : { json: status() };
    expect(await importStravaRuns()).toEqual({ added: 0, skipped: 1 });
  });

  it("stravaTotals drops unknown values (0 distance/time, null HR)", () => {
    expect(stravaTotals({ distanceM: 0, movingTimeS: 0, elapsedS: 900, elevationGainM: null, avgHr: null, maxHr: 160 })).toEqual({ elapsedS: 900, maxHr: 160 });
  });
});

describe("StravaCard", () => {
  const renderCard = async () => {
    render(<ToastProvider><StravaCard /></ToastProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  };

  it("not connected: pitch, three points, orange connect button that asks the server for the consent URL", async () => {
    handler = (m, p) => p === "/api/strava/connect" ? { json: { url: "https://www.strava.com/oauth/authorize?x=1" } } : { json: status({ connected: false, athleteName: null }) };
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, search: "", pathname: "/profile" });
    await renderCard();
    expect(screen.getByText("Connect Strava")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    const btn = screen.getByRole("button", { name: "Connect with Strava" });
    await act(async () => { btn.click(); await new Promise((r) => setTimeout(r, 0)); });
    expect(assign).toHaveBeenCalledWith("https://www.strava.com/oauth/authorize?x=1");
  });

  it("connected: shows the athlete and offers sync + disconnect", async () => {
    handler = () => ({ json: status() });
    await renderCard();
    expect(screen.getByText(/Connected as Flo B/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeTruthy();
  });

  it("server without Strava keys: says so, no button", async () => {
    handler = () => ({ json: status({ available: false, connected: false }) });
    await renderCard();
    expect(screen.getByText(/Not set up on this server/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
