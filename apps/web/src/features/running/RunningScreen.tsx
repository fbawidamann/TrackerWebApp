import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { importRun } from "@/db/actions";
import { useRuns } from "@/data/hooks";
import { useT } from "@/i18n";
import { personalBests, summarize, weeklyDistance, type RunView } from "@/lib/runStats";
import { useNow } from "@/lib/time";
import { useFormat, type Fmt } from "@/lib/useFormat";
import { BarChart } from "@/ui/BarChart";
import { IconChevron, IconMedal } from "@/ui/icons";
import { useToast } from "@/ui/Toast";
import { parseRunFile } from "./parseRunFile";

type Period = "week" | "month" | "year" | "all";
const PERIODS: Period[] = ["week", "month", "year", "all"];
const LIST_STEP = 20;

/** The Running tab (docs/design/screens/running.md): totals, weekly distance, personal bests, all runs. */
export function RunningScreen() {
  const runs = useRuns();
  const fmt = useFormat();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT();
  const r9 = t.running;
  const now = useNow(60_000);
  const [period, setPeriod] = useState<Period>("week");
  const [week, setWeek] = useState<number | null>(null);
  const [shown, setShown] = useState(LIST_STEP);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date(now);
  const from = period === "week" ? fmt.weekStart(today)
    : period === "month" ? new Date(today.getFullYear(), today.getMonth(), 1)
    : period === "year" ? new Date(today.getFullYear(), 0, 1) : null;
  const all = useMemo(() => runs ?? [], [runs]);
  const sum = summarize(all, from);
  const weeks = useMemo(() => weeklyDistance(all, fmt.weekStart, new Date(now)), [all, fmt, now]);
  const bests = useMemo(() => personalBests(all), [all]);
  const selWeek = weeks[week ?? weeks.length - 1]!;

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    let added = 0, dups = 0, lastId: string | null = null;
    const errors: string[] = [];
    for (const f of files) {
      try {
        const r = await importRun(await parseRunFile(f));
        lastId = r.activityId;
        if (r.duplicate) dups++; else added++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : r9.errUnreadable);
      }
    }
    setBusy(false);
    if (files.length === 1 && lastId) {
      toast(dups ? r9.alreadyImported : r9.imported);
      void navigate({ to: "/running/$activityId", params: { activityId: lastId } });
      return;
    }
    if (files.length === 1) { toast(errors[0]!); return; }
    toast(r9.importSummary(added, dups, errors.length));
  };

  return (
    <div className="page">
      <h1 className="title">{r9.running}</h1>

      <div className="acts two-eq">
        <button type="button" className="btn btn-primary" onClick={() => void navigate({ to: "/running/new" })}>{r9.logRun}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? r9.importing : r9.importFile}</button>
        <input ref={fileRef} type="file" accept=".gpx,.fit,application/gpx+xml,application/octet-stream" multiple hidden onChange={(e) => void onFiles(e)} />
      </div>

      {runs !== undefined && !all.length && (
        <div className="card empty">
          <p>{r9.noRuns}</p>
          <p className="small">{r9.noRunsHint}</p>
        </div>
      )}

      {all.length > 0 && (
        <>
          <div className="sec">
            <div className="seg" role="tablist" aria-label={r9.period}>
              {PERIODS.map((p) => <button key={p} type="button" role="tab" aria-selected={period === p} onClick={() => setPeriod(p)}>{r9.periods[p]}</button>)}
            </div>
            <div className="card">
              <div className="stats">
                <Stat v={fmt.dist(sum.distanceM)} u="km" l={r9.distance} />
                <Stat v={fmt.runTime(sum.timeS)} l={r9.time} />
                <Stat v={String(sum.count)} l={r9.runsLabel(sum.count)} />
              </div>
              <div className="stats stats-row">
                <Stat v={fmt.pace(sum.pace)} u="/km" l={r9.avgPace} />
                <Stat v={fmt.num(sum.elevationM, 0)} u="m" l={r9.elevation} />
                <Stat v={fmt.dist(sum.longestM)} u="km" l={r9.longest} />
              </div>
            </div>
          </div>

          <div className="sec">
            <span className="lbl">{r9.weeklyDistance}</span>
            <div className="card chart">
              <p className="readout" style={{ padding: "0 8px" }}>
                <b className="nw">{fmt.dist(selWeek.distanceM)}<span className="u">km</span></b>
                {t.common.runs(selWeek.count)} · {fmt.weekLabel(selWeek.start)}
              </p>
              <BarChart bars={weeks.map((w) => ({ label: fmt.shortDate(w.start), value: w.distanceM / 1000 }))}
                steps={[1, 2, 5, 10, 20, 50, 100]} format={(v) => fmt.num(v, 0)}
                selected={week ?? weeks.length - 1} onSelect={setWeek} label={r9.weeklyChart} />
            </div>
          </div>

          {bests.length > 0 && (
            <div className="sec">
              <span className="lbl">{r9.personalBests}</span>
              <div className="card list">
                {bests.map((b) => (
                  <button key={b.key} type="button" className="li" onClick={() => void navigate({ to: "/running/$activityId", params: { activityId: b.activityId } })}>
                    <span className="lead">
                      <span className="medal"><IconMedal /></span>
                      <span className="li-main"><span className="li-name">{r9.efforts[b.key] ?? b.label}</span><span className="li-meta">{fmt.shortDate(b.date)}</span></span>
                    </span>
                    <span className="pr-val">
                      <span className="v nw">{fmt.runTime(b.timeS)}</span>
                      <span className="li-meta nw">{fmt.pace(b.timeS / (b.m / 1000))} /km</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="sec">
            <span className="lbl">{r9.allRuns}</span>
            <div className="card list">
              {all.slice(0, shown).map((r) => <RunRow key={r.activity.id} r={r} fmt={fmt} onOpen={() => void navigate({ to: "/running/$activityId", params: { activityId: r.activity.id } })} />)}
            </div>
            {all.length > shown && <button type="button" className="ghost" style={{ justifySelf: "start" }} onClick={() => setShown((n) => n + LIST_STEP)}>{t.common.showMore}</button>}
          </div>
        </>
      )}
    </div>
  );
}

export function Stat({ v, u, l }: { v: string; u?: string; l: string }) {
  return <div className="stat"><span className="stat-v">{v}{u && <span className="u">{u}</span>}</span><span className="lbl">{l}</span></div>;
}

export function RunRow({ r, fmt, onOpen }: { r: RunView; fmt: Fmt; onOpen: () => void }) {
  return (
    <button type="button" className="li" onClick={onOpen}>
      <span className="li-main">
        <span className="li-name">{r.activity.name}</span>
        <span className="li-meta">{fmt.relDay(r.start)} · {fmt.runTime(r.run.movingTimeS)}</span>
      </span>
      <span className="li-side">
        <span className="run-side">
          <span className="run-km nw">{fmt.dist(r.run.distanceM)}<span className="u">km</span></span>
          <span className="nw">{fmt.pace(r.pace)} /km</span>
        </span>
        <IconChevron />
      </span>
    </button>
  );
}
