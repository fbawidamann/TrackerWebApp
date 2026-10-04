import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { router } from "./app/router";
import { watchForUpdates } from "./app/updates";
// IBM Plex Sans is self-hosted (bundled from @fontsource, OFL-1.1): no request to Google, works offline from the
// first start (docs/adr/0008-self-hosted-font.md). Only Latin + Latin Extended, the weights the UI uses.
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-ext-400.css";
import "@fontsource/ibm-plex-sans/latin-ext-500.css";
import "@fontsource/ibm-plex-sans/latin-ext-600.css";
import { db } from "./db/db";
import { setOwner } from "./db/owner";
import { initDb } from "./db/seed";
import { getAccount } from "./sync/account";
import { startSyncLoop } from "./sync/engine";
import "./styles/app.css";

async function boot() {
  await initDb();
  // Start screen setting: open on the Workout tab instead of Home.
  // New rows belong to the logged-in account (or "local" before the first login).
  setOwner((await getAccount())?.userId ?? null);
  const settings = await db.settings.get("user");
  if (settings?.startScreen === "workout" && window.location.pathname === "/") window.history.replaceState(null, "", "/workout");
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void boot();
// iOS Safari only applies :active styles (press feedback, app.css) when a touchstart listener exists.
document.addEventListener("touchstart", () => {}, { passive: true });
// Updates: the new version waits for a tap on the banner instead of reloading by itself (app/updates.ts).
// registerSW only registers the service worker; update detection and applying are in watchForUpdates.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) { if (reg) watchForUpdates(reg); },
});
startSyncLoop(async () => !!(await getAccount()) && !(await db.meta.get("sessionExpired"))?.value);
// Ask the browser to keep IndexedDB data (the only copy until sync exists).
void navigator.storage?.persist?.();
