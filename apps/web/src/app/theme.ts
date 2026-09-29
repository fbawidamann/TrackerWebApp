import type { Accent, DeviceSettings, UserSettings } from "@fitness/shared";
import { useEffect, useState } from "react";

/** Accent values per theme (docs/design/ui-guidelines.md → "Accent colour is a user setting"). */
export const ACCENTS: Record<Accent, { name: string; c: string; darkText: string; lightText: string; lightFill: string }> = {
  cobalt: { name: "Cobalt", c: "#4f86f7", darkText: "#6f9bf8", lightText: "#2f63cf", lightFill: "#3569d6" },
  teal:   { name: "Teal",   c: "#2fb39f", darkText: "#3cc7b2", lightText: "#1e7f71", lightFill: "#23907f" },
  amber:  { name: "Amber",  c: "#e08a3c", darkText: "#eba05d", lightText: "#a65e1c", lightFill: "#b8691f" },
  rose:   { name: "Rose",   c: "#e0607e", darkText: "#ec7d96", lightText: "#b23d5a", lightFill: "#c4455f" },
  violet: { name: "Violet", c: "#8b7cf6", darkText: "#a194f8", lightText: "#5b4bc4", lightFill: "#6a5ad8" },
};

function systemDark(): boolean {
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch { return true; }
}

/** Applies theme, accent, text size and nav-label settings to <html>. */
export function useApplyTheme(s: Pick<UserSettings, "theme" | "accent" | "navLabels">, d: Pick<DeviceSettings, "textSize">): void {
  const [sysDark, setSysDark] = useState(systemDark);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const h = () => setSysDark(mq.matches);
    mq?.addEventListener("change", h);
    return () => mq?.removeEventListener("change", h);
  }, []);
  const mode = s.theme === "system" ? (sysDark ? "dark" : "light") : s.theme;
  useEffect(() => {
    const el = document.documentElement;
    const a = ACCENTS[s.accent] ?? ACCENTS.cobalt;
    el.dataset.mode = mode;
    el.dataset.size = d.textSize;
    el.dataset.nav = s.navLabels;
    el.style.setProperty("--acc", a.c);
    el.style.setProperty("--acc-text", mode === "dark" ? a.darkText : a.lightText);
    el.style.setProperty("--acc-fill", mode === "dark" ? a.c : a.lightFill);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "dark" ? "#0a0c0f" : "#eef0f3");
  }, [mode, s.accent, s.navLabels, d.textSize]);
}
