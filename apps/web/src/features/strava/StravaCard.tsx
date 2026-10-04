import { useEffect, useState } from "react";
import { ApiError, NetworkError } from "@/api/client";
import { useT } from "@/i18n";
import { useNow } from "@/lib/time";
import { IconLink } from "@/ui/icons";
import { ConfirmSheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";
import { connectStrava, disconnectStrava, importStravaRuns, loadStravaStatus, useStravaStatus } from "./strava";

/**
 * Profile → Strava card (docs/design/screens/profile.md "Strava"), right below the stats so it is easy to find.
 * States: loading · not set up on the server · not connected · connected (sync now / disconnect).
 */
export function StravaCard() {
  const status = useStravaStatus();
  const t = useT();
  const s = t.strava;
  const toast = useToast();
  const now = useNow(30_000);
  const [busy, setBusy] = useState<"connect" | "sync" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [failed, setFailed] = useState(false);

  const fail = (e: unknown) => toast(e instanceof NetworkError ? s.offline : e instanceof ApiError ? e.message : s.failed);

  const sync = async (quiet = false) => {
    setBusy("sync");
    try {
      const r = await importStravaRuns();
      if (!quiet || r.added) toast(r.added ? s.imported(r.added) : s.nothingNew);
    } catch (e) { fail(e); } finally { setBusy(null); }
  };

  useEffect(() => {
    let alive = true;
    const load = () => loadStravaStatus().then(() => alive && setFailed(false)).catch(() => alive && setFailed(true));
    void load();
    // Back from Strava's consent page (/api/strava/callback links to /profile?strava=<outcome>).
    const q = new URLSearchParams(window.location.search).get("strava");
    if (q) {
      window.history.replaceState(null, "", window.location.pathname);
      if (q === "connected") { toast(s.connectedToast); void sync(true); }
    }
    // The consent page may have been in another window: refresh when the user comes back.
    const onShow = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { alive = false; document.removeEventListener("visibilitychange", onShow); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!status) {
    if (!failed) return <div className="card strava" aria-busy="true"><div className="strava-head"><span className="strava-ic"><IconLink /></span><span className="li-main"><span className="li-name">Strava</span><span className="li-meta">{s.loading}</span></span></div></div>;
    return null; // offline and never loaded: nothing useful to show
  }

  const ago = (iso: string | null) => {
    if (!iso) return s.never;
    const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
    return mins < 1 ? s.justNow : mins < 60 ? s.minsAgo(mins) : mins < 1440 ? s.hoursAgo(Math.floor(mins / 60)) : s.daysAgo(Math.floor(mins / 1440));
  };

  return (
    <div className={"card strava" + (status.connected ? " on" : "")}>
      <div className="strava-head">
        <span className="strava-ic"><IconLink /></span>
        <span className="li-main">
          <span className="li-name">{status.connected ? s.titleConnected : s.title}</span>
          <span className="li-meta">
            {!status.available ? s.notSetUp
              : status.connected ? <><span className="sdot ok" />{status.athleteName ? s.as(status.athleteName) : s.connected} · {s.lastSync(ago(status.lastSyncAt))}</>
              : s.pitch}
          </span>
        </span>
      </div>

      {status.available && !status.connected && (
        <>
          <ul className="strava-points">
            <li>{s.point1}</li>
            <li>{s.point2}</li>
            <li>{s.point3}</li>
          </ul>
          <button type="button" className="btn btn-block strava-btn" disabled={busy !== null}
            onClick={() => { setBusy("connect"); void connectStrava().catch((e: unknown) => { fail(e); setBusy(null); }); }}>
            {busy === "connect" ? s.opening : s.connect}
          </button>
          <p className="strava-note">{s.privacy}</p>
        </>
      )}

      {status.available && status.connected && (
        <div className="acts two-eq">
          <button type="button" className="btn" disabled={busy !== null} onClick={() => void sync()}>{busy === "sync" ? s.syncing : s.syncNow}</button>
          <button type="button" className="btn" disabled={busy !== null} onClick={() => setConfirm(true)}>{s.disconnect}</button>
        </div>
      )}

      {confirm && (
        <ConfirmSheet title={s.disconnectTitle} text={s.disconnectText} confirm={s.disconnect} danger
          onConfirm={() => { setConfirm(false); void disconnectStrava().then(() => toast(s.disconnected)).catch(fail); }}
          onClose={() => setConfirm(false)} />
      )}
    </div>
  );
}
