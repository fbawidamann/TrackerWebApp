import { afterEach, describe, expect, it, vi } from "vitest";
import { canHaptic, vibrate } from "./time";

describe("vibrate (haptic tick)", () => {
  const proto = HTMLInputElement.prototype as unknown as Record<string, unknown>;
  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as unknown as Record<string, unknown>).vibrate;
    delete proto.switch;
  });

  it("uses the Vibration API where it exists (Android)", () => {
    const v = vi.fn();
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: v });
    expect(canHaptic()).toBe(true);
    vibrate(true);
    expect(v).toHaveBeenCalledWith(15);
  });

  it("iPhone (iOS 18+): clicks a hidden native switch and removes it again", () => {
    proto.switch = false; // feature detection: Safari 18 has HTMLInputElement.prototype.switch
    expect(canHaptic()).toBe(true);
    const click = vi.spyOn(HTMLLabelElement.prototype, "click");
    const before = document.body.childElementCount;
    vibrate(true);
    expect(click).toHaveBeenCalledTimes(1);
    const label = click.mock.instances[0] as unknown as HTMLLabelElement;
    expect(label.querySelector("input")?.hasAttribute("switch")).toBe(true);
    expect(document.body.childElementCount).toBe(before);
  });

  it("does nothing when switched off or unsupported", () => {
    const click = vi.spyOn(HTMLLabelElement.prototype, "click");
    expect(canHaptic()).toBe(false);
    vibrate(true);
    proto.switch = false;
    vibrate(false);
    expect(click).not.toHaveBeenCalled();
  });
});
