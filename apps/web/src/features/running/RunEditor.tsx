import { formatRunTime, parseDistanceInput, parseRunTimeInput, paceOf, runNameForTime } from "@fitness/shared";
import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { saveRun } from "@/db/actions";
import { useRuns } from "@/data/hooks";
import { currentLanguage, useT } from "@/i18n";
import { useFormat } from "@/lib/useFormat";
import { ConfirmSheet } from "@/ui/Sheet";

const toLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const toLocalTime = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

interface Form { name: string; startedAt: Date; distance: string; time: string; elevation: string; hr: string; notes: string }

function blank(): Form {
  const t = new Date(Date.now() - 60 * 60000);
  t.setMinutes(Math.floor(t.getMinutes() / 5) * 5, 0, 0);
  return { name: runNameForTime(t, currentLanguage()), startedAt: t, distance: "", time: "", elevation: "", hr: "", notes: "" };
}

const optInt = (s: string, max: number): number | null | undefined => {
  if (!s.trim()) return null;
  if (!/^\d+$/.test(s.trim())) return undefined;
  const n = Number(s.trim());
  return n <= max ? n : undefined;
};

/** "Log run" and "Edit run" (docs/design/screens/running.md → Log / edit). Imported runs: only name, date and notes. */
export function RunEditor() {
  const params = useParams({ strict: false }) as { activityId?: string };
  const router = useRouter();
  const navigate = useNavigate();
  const fmt = useFormat();
  const tx = useT();
  const r9 = tx.running;
  const runs = useRuns();
  const existing = params.activityId ? runs?.find((r) => r.activity.id === params.activityId) : undefined;
  const [form, setForm] = useState<Form | null>(params.activityId ? null : blank());
  const [dirty, setDirty] = useState(false);
  const [need, setNeed] = useState<Set<keyof Form>>(new Set());
  const [discard, setDiscard] = useState(false);

  if (!form && existing) {
    const { activity: a, run } = existing;
    setForm({
      name: a.name, startedAt: existing.start, notes: a.notes,
      distance: fmt.dist(run.distanceM), time: formatRunTime(run.movingTimeS),
      elevation: run.elevationGainM === null ? "" : String(run.elevationGainM), hr: run.avgHr === null ? "" : String(run.avgHr),
    });
  }
  if (!form) {
    if (runs === undefined) return <div className="page no-nav" />;
    return <div className="page no-nav"><div className="topbar"><button type="button" className="tbtn" onClick={() => router.history.back()}>{tx.common.back}</button></div><p className="muted">{r9.notFound}</p></div>;
  }

  const measured = !!existing && existing.run.source !== "manual";
  const edit = (changes: Partial<Form>) => { setForm((f) => (f ? { ...f, ...changes } : f)); setDirty(true); };
  const distanceM = parseDistanceInput(form.distance);
  const timeS = parseRunTimeInput(form.time);
  const pace = distanceM && timeS ? paceOf(distanceM, timeS) : null;
  const cancel = () => (dirty ? setDiscard(true) : router.history.back());

  const save = async () => {
    const elevation = optInt(form.elevation, 20_000), hr = optInt(form.hr, 250);
    const missing = new Set<keyof Form>();
    if (!measured) {
      if (!distanceM) missing.add("distance");
      if (!timeS) missing.add("time");
      if (elevation === undefined) missing.add("elevation");
      if (hr === undefined || (hr !== null && hr < 20)) missing.add("hr");
    }
    setNeed(missing);
    if (missing.size) return;
    const id = await saveRun({
      activityId: existing?.activity.id ?? null, name: form.name, startedAt: form.startedAt, notes: form.notes,
      distanceM: distanceM ?? 0, movingTimeS: timeS ?? 0, elevationGainM: elevation ?? null, avgHr: hr ?? null,
    });
    if (existing) router.history.back();
    else void navigate({ to: "/running/$activityId", params: { activityId: id }, replace: true });
  };

  const field = (key: keyof Form) => "field" + (need.has(key) ? " need" : "");

  return (
    <div className="page tight no-nav">
      <div className="ehead" style={{ padding: 0, margin: "-6px -8px -6px" }}>
        <button type="button" className="tbtn" onClick={cancel}>{tx.common.cancel}</button>
        <h1>{existing ? r9.editRun : r9.logRun}</h1>
        <button type="button" className="tbtn save" onClick={() => void save()}>{tx.common.save}</button>
      </div>

      <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
        <div className="grp" style={{ gap: 6 }}>
          <label className="lbl" htmlFor="r-name">{tx.common.name}</label>
          <input id="r-name" className="field" maxLength={40} value={form.name} onChange={(e) => edit({ name: e.target.value })} />
        </div>
        <div className="two-col">
          <div className="grp" style={{ gap: 6 }}>
            <label className="lbl" htmlFor="r-date">{tx.common.date}</label>
            <input id="r-date" className="field" type="date" max={toLocalDate(new Date())} value={toLocalDate(form.startedAt)}
              onChange={(e) => { if (!e.target.value) return; const [y, mo, da] = e.target.value.split("-").map(Number); edit({ startedAt: new Date(y!, mo! - 1, da!, form.startedAt.getHours(), form.startedAt.getMinutes()) }); }} />
          </div>
          <div className="grp" style={{ gap: 6 }}>
            <label className="lbl" htmlFor="r-time">{r9.startTime}</label>
            <input id="r-time" className="field" type="time" value={toLocalTime(form.startedAt)}
              onChange={(e) => { if (!e.target.value) return; const [hh, mm] = e.target.value.split(":").map(Number); const s = new Date(form.startedAt); s.setHours(hh!, mm!, 0, 0); edit({ startedAt: s }); }} />
          </div>
        </div>
      </div>

      {measured ? (
        <p className="hint">{r9.measured}</p>
      ) : (
        <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
          <div className="two-col">
            <div className="grp" style={{ gap: 6 }}>
              <label className="lbl" htmlFor="r-dist">{r9.distanceKm}</label>
              <input id="r-dist" className={field("distance")} inputMode="decimal" placeholder={fmt.dist(5000)} autoComplete="off"
                value={form.distance} onChange={(e) => edit({ distance: e.target.value })} />
            </div>
            <div className="grp" style={{ gap: 6 }}>
              <label className="lbl" htmlFor="r-dur">{r9.time}</label>
              <input id="r-dur" className={field("time")} inputMode="numeric" placeholder="25:00" autoComplete="off"
                value={form.time} onChange={(e) => edit({ time: e.target.value })} />
            </div>
          </div>
          <p className="hint">{r9.pace} <b className="nw" style={{ color: "var(--text)" }}>{fmt.pace(pace)} /km</b></p>
          <div className="two-col">
            <div className="grp" style={{ gap: 6 }}>
              <label className="lbl" htmlFor="r-ele">{r9.elevationM}</label>
              <input id="r-ele" className={field("elevation")} inputMode="numeric" placeholder={tx.common.optional} autoComplete="off"
                value={form.elevation} onChange={(e) => edit({ elevation: e.target.value })} />
            </div>
            <div className="grp" style={{ gap: 6 }}>
              <label className="lbl" htmlFor="r-hr">{r9.avgHeartRate}</label>
              <input id="r-hr" className={field("hr")} inputMode="numeric" placeholder={tx.common.optional} autoComplete="off"
                value={form.hr} onChange={(e) => edit({ hr: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      <div className="grp" style={{ gap: 6 }}>
        <label className="lbl" htmlFor="r-notes">{tx.common.notes}</label>
        <textarea id="r-notes" className="field" rows={3} maxLength={1000} value={form.notes} onChange={(e) => edit({ notes: e.target.value })} />
      </div>

      {discard && (
        <ConfirmSheet title={tx.common.discardChanges} danger confirm={tx.common.discard} cancel={tx.common.keepEditing} onClose={() => setDiscard(false)} onConfirm={() => router.history.back()} />
      )}
    </div>
  );
}
