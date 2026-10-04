import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateBanner } from "./UpdateBanner";
import { FOREGROUND_MIN_GAP_MS, INTERVAL_MS, resetUpdateState, setUpdateReady, watchForUpdates } from "./updates";

function setVisibility(v: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("watchForUpdates", () => {
  let now = 0;
  let stop: () => void = () => {};
  beforeEach(() => { vi.useFakeTimers(); now = 1_000_000; Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true }); });
  afterEach(() => { stop(); vi.useRealTimers(); });

  it("checks when the app comes back to the foreground, at most once a minute", () => {
    const reg = { update: vi.fn().mockResolvedValue(undefined) };
    stop = watchForUpdates(reg, () => now);
    setVisibility("hidden");
    now += FOREGROUND_MIN_GAP_MS + 1;
    setVisibility("visible");
    expect(reg.update).toHaveBeenCalledTimes(1);
    now += 5_000;
    setVisibility("visible");
    expect(reg.update).toHaveBeenCalledTimes(1);
  });

  it("does not check while hidden or offline", () => {
    const reg = { update: vi.fn().mockResolvedValue(undefined) };
    stop = watchForUpdates(reg, () => now);
    now += FOREGROUND_MIN_GAP_MS + 1;
    setVisibility("hidden");
    expect(reg.update).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    setVisibility("visible");
    expect(reg.update).not.toHaveBeenCalled();
  });

  it("checks every 30 minutes while open and survives a failed check", () => {
    const reg = { update: vi.fn().mockRejectedValue(new Error("offline")) };
    stop = watchForUpdates(reg, () => now);
    setVisibility("visible");
    now += INTERVAL_MS;
    vi.advanceTimersByTime(INTERVAL_MS);
    expect(reg.update).toHaveBeenCalledTimes(1);
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
