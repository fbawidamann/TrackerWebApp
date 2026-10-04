import { useEffect, useState } from "react";

/** Current time, re-rendering every `ms` (timers are always computed from timestamps). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    const vis = () => setNow(Date.now());
    document.addEventListener("visibilitychange", vis);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [ms]);
  return now;
}

/** Keeps the screen on while `active` (Screen Wake Lock API). Re-requests when the tab becomes visible. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        if (document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen");
      } catch { /* not allowed (low battery etc.): ignore */ }
      if (cancelled) void lock?.release();
    };
    void request();
    const onVis = () => { if (document.visibilityState === "visible") void request(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); void lock?.release(); };
  }, [active]);
}

/** "1:30" or "90" → seconds; "" → null; invalid → undefined. */
export function parseDurationInput(s: string): number | null | undefined {
  const t = s.trim();
  if (!t) return null;
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d{1,4}$/.test(t)) return Number(t);
  return undefined;
}

export function durationInputValue(sec: number | null): string {
  if (sec === null) return "";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/**
 * Short haptic tick. Android/Chrome: Vibration API. iPhone: Safari has no Vibration API, but since iOS 18 toggling
 * a native `<input type="checkbox" switch>` through its label gives a system haptic, so we click a hidden one.
 * Does nothing where neither exists (desktop, older iOS).
 */
export function vibrate(enabled: boolean): void {
  if (!enabled) return;
  if (typeof navigator.vibrate === "function") { navigator.vibrate(15); return; }
  if (!canHaptic()) return;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  label.click();
  label.remove();
}

/** True where vibrate() can give feedback (Vibration API or the iOS 18 switch haptic). */
export function canHaptic(): boolean {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") return true;
  return typeof HTMLInputElement !== "undefined" && "switch" in HTMLInputElement.prototype;
}
