import { useState } from "react";
import { useT } from "@/i18n";
import { applyUpdate, useUpdateReady } from "./updates";

/** "New version available · Reload" at the top of the screen (docs/architecture/pwa-updates.md). */
export function UpdateBanner() {
  const ready = useUpdateReady();
  const t = useT().layout;
  const [busy, setBusy] = useState(false);
  if (!ready) return null;
  return (
    <div className="update-wrap">
      <div className="toast" role="status">
        <span>{t.updateReady}</span>
        <button type="button" disabled={busy} onClick={() => { setBusy(true); void applyUpdate(); }}>{t.updateReload}</button>
      </div>
    </div>
  );
}
