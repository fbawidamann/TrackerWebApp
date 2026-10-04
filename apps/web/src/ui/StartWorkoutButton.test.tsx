import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { START_ANIM_MS, StartWorkoutButton } from "./StartWorkoutButton";

describe("StartWorkoutButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("shows '+ Start workout'", () => {
    render(<StartWorkoutButton onStart={() => {}} />);
    const b = screen.getByRole("button");
    expect(b.textContent).toBe("Start workout");
    expect(b.querySelector("svg")).not.toBeNull();
  });

  it("plays the animation, then starts exactly once (double taps are ignored)", () => {
    const onStart = vi.fn();
    render(<StartWorkoutButton onStart={onStart} />);
    const b = screen.getByRole("button");
    act(() => { b.click(); b.click(); });
    expect(b.className).toContain("go");
    expect(onStart).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(START_ANIM_MS); });
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(b.className).not.toContain("go");
  });

  it("starts immediately with reduced motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const onStart = vi.fn();
    render(<StartWorkoutButton onStart={onStart} />);
    act(() => { screen.getByRole("button").click(); });
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
