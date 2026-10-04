import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { CLOSE_DISTANCE, useSwipeToClose } from "./useSwipeToClose";

function Harness({ onClose }: { onClose: () => void }) {
  const sheet = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  useSwipeToClose(sheet, scrim, onClose);
  return (
    <>
      <div ref={scrim} data-testid="scrim" />
      <div ref={sheet} data-testid="sheet" />
    </>
  );
}

let t = 0;
function touch(el: HTMLElement, type: string, y: number, x = 100) {
  t += 50; // 50 ms between events -> slow drag, so only distance decides
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const touches = type === "touchend" ? [] : [{ clientX: x, clientY: y }];
  Object.defineProperty(ev, "touches", { value: touches });
  Object.defineProperty(ev, "timeStamp", { value: t });
  act(() => { el.dispatchEvent(ev); });
  return ev;
}

function drag(el: HTMLElement, from: number, to: number, x = 100, toX = x) {
  touch(el, "touchstart", from, x);
  const steps = 5;
  let last: Event | undefined;
  for (let i = 1; i <= steps; i++) last = touch(el, "touchmove", from + ((to - from) * i) / steps, x + ((toX - x) * i) / steps);
  touch(el, "touchend", to, toX);
  return last!;
}

describe("useSwipeToClose", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  const setup = () => {
    const onClose = vi.fn();
    const r = render(<Harness onClose={onClose} />);
    return { onClose, sheet: r.getByTestId("sheet") };
  };

  it("closes on a long swipe down from the top", () => {
    const { onClose, sheet } = setup();
    const move = drag(sheet, 100, 100 + CLOSE_DISTANCE + 60);
    expect(move.defaultPrevented).toBe(true);
    act(() => { vi.runAllTimers(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("springs back on a short swipe", () => {
    const { onClose, sheet } = setup();
    drag(sheet, 100, 140);
    act(() => { vi.runAllTimers(); });
    expect(onClose).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe("");
  });

  it("does not close while the content is scrolled down (normal scrolling)", () => {
    const { onClose, sheet } = setup();
    sheet.scrollTop = 200;
    const move = drag(sheet, 100, 400);
    expect(move.defaultPrevented).toBe(false);
    act(() => { vi.runAllTimers(); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores upward and sideways swipes", () => {
    const { onClose, sheet } = setup();
    drag(sheet, 400, 100);
    drag(sheet, 100, 160, 100, 400);
    act(() => { vi.runAllTimers(); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("is off in the desktop layout", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const { onClose, sheet } = setup();
    drag(sheet, 100, 400);
    act(() => { vi.runAllTimers(); });
    expect(onClose).not.toHaveBeenCalled();
  });
});
