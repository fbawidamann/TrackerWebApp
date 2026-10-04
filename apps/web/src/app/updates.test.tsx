import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateBanner } from "./UpdateBanner";
import {
  FOREGROUND_MIN_GAP_MS, INTERVAL_MS, RELOAD_FALLBACK_MS, makeApply, resetUpdateState, setUpdateReady, useUpdateReady,
  watchForUpdates, type RegLike, type SwEnv,
} from "./updates";

function setVisibility(v: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v });
  document.dispatchEvent(new Event("visibilitychange"));
}

class FakeSw extends EventTarget {
  state = "installing";
  postMessage = vi.fn();
  setState(s: string) { this.state = s; this.dispatchEvent(new Event("statechange")); }
}
class FakeReg extends EventTarget implements RegLike {
  waiting: FakeSw | null = null;
  installing: FakeSw | null = null;
  update = vi.fn().mockResolvedValue(undefined);
  /** A new version starts installing (fires updatefound like the browser). */
  found(): FakeSw { const sw = new FakeSw(); this.installing = sw; this.dispatchEvent(new Event("updatefound")); return sw; }
  /** The installing version finishes and waits. */
  installed(sw: FakeSw) { this.installing = null; this.waiting = sw; sw.setState("installed"); }
}
const waitingSw = () => Object.assign(new FakeSw(), { state: "installed" });
const env = (controller = true) => {
  let cb: (() => void) | null = null;
  const reload = vi.fn();
  const e: SwEnv = { hasController: () => controller, onControllerChange: (c) => { cb = c; }, reload };
  return { ...e, reload, fire: () => cb?.() };
};

let readyNow = false;
function Probe() { readyNow = useUpdateReady(); return null; }

describe("watchForUpdates", () => {
  let now = 0;
  let stop: () => void = () => {};
  beforeEach(() => {
    vi.useFakeTimers(); now = 1_000_000; readyNow = false;
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
    setVisibility("visible");
    render(<Probe />);
  });
  afterEach(() => { stop(); cleanup(); act(() => resetUpdateState()); vi.useRealTimers(); });

  it("shows the banner when a found update finishes installing while the app is open", () => {
    const reg = new FakeReg();
    stop = watchForUpdates(reg, env(), () => now);
    const sw = reg.found();
    expect(readyNow).toBe(false);
    act(() => reg.installed(sw));
    expect(readyNow).toBe(true);
  });

  it("iOS case: update installed while the app was suspended (no events seen) -> banner on return", () => {
    const reg = new FakeReg();
    stop = watchForUpdates(reg, env(), () => now);
    setVisibility("hidden");
    // The page is frozen: the new worker installs, but the page never gets updatefound/statechange.
    reg.waiting = waitingSw();
    expect(readyNow).toBe(false);
    act(() => setVisibility("visible"));
    expect(readyNow).toBe(true);
  });

  it("shows the banner at start when an update was already waiting", () => {
    const reg = new FakeReg();
    reg.waiting = waitingSw();
    act(() => { stop = watchForUpdates(reg, env(), () => now); });
    expect(readyNow).toBe(true);
  });

  it("does not treat the very first install as an update", () => {
    const reg = new FakeReg();
    reg.waiting = waitingSw();
    act(() => { stop = watchForUpdates(reg, env(false), () => now); });
    expect(readyNow).toBe(false);
  });

  it("checks the server on return to the foreground, at most every 10 s, never while hidden/offline", () => {
    const reg = new FakeReg();
    stop = watchForUpdates(reg, env(), () => now);
    now += FOREGROUND_MIN_GAP_MS + 1;
    setVisibility("hidden");
    expect(reg.update).not.toHaveBeenCalled();
    setVisibility("visible");
    expect(reg.update).toHaveBeenCalledTimes(1);
    now += 2_000;
    setVisibility("visible");
    expect(reg.update).toHaveBeenCalledTimes(1);
    now += FOREGROUND_MIN_GAP_MS;
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    setVisibility("visible");
    expect(reg.update).toHaveBeenCalledTimes(1);
  });

  it("checks every 30 minutes while open and survives a failed check", async () => {
    const reg = new FakeReg();
    reg.update.mockRejectedValue(new Error("offline"));
    stop = watchForUpdates(reg, env(), () => now);
    now += INTERVAL_MS;
    vi.advanceTimersByTime(INTERVAL_MS);
    expect(reg.update).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });
});

describe("makeApply", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("activates the waiting worker and reloads exactly once when it takes over", async () => {
    vi.useFakeTimers();
    const reg = new FakeReg();
    const sw = new FakeSw();
    reg.waiting = sw;
    const e = env();
    await makeApply(reg, e)();
    expect(sw.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(e.reload).not.toHaveBeenCalled();
    e.fire();
    vi.advanceTimersByTime(RELOAD_FALLBACK_MS);
    expect(e.reload).toHaveBeenCalledTimes(1);
  });

  it("still reloads if the takeover event never comes", async () => {
    vi.useFakeTimers();
    const reg = new FakeReg();
    reg.waiting = new FakeSw();
    const e = env();
    await makeApply(reg, e)();
    vi.advanceTimersByTime(RELOAD_FALLBACK_MS);
    expect(e.reload).toHaveBeenCalledTimes(1);
  });
});

describe("UpdateBanner", () => {
  afterEach(() => { cleanup(); act(() => resetUpdateState()); });

  it("is hidden until an update is ready, then reloads only on tap", () => {
    render(<UpdateBanner />);
    expect(screen.queryByRole("status")).toBeNull();
    const apply = vi.fn().mockResolvedValue(undefined);
    act(() => setUpdateReady(apply));
    expect(screen.getByRole("status").textContent).toContain("New version available");
    expect(apply).not.toHaveBeenCalled();
    act(() => screen.getByRole("button").click());
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
