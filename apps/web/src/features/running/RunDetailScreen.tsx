import {
  BEST_EFFORTS, cumulativeDistances, decodePolyline, paceSeries, seriesByDistance, splits as computeSplits,
} from "@fitness/shared";
import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { deleteRun } from "@/db/actions";
import { useRuns, useRunTrack } from "@/data/hooks";
import { useT } from "@/i18n";
import { personalBests, recordsSetBy } from "@/lib/runStats";
import { useFormat } from "@/lib/useFormat";
import { IconBack, IconMedal, IconMore } from "@/ui/icons";
import { ConfirmSheet, MenuSheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";
import { TrackChart } from "@/ui/TrackChart";
import { RouteMap } from "./RouteMap";
import { Stat } from "./RunningScreen";


/** One run (docs/design/screens/running.md → Run detail). */
export function RunDetailScreen() {
  const { activityId } = useParams({ from: "/running/$activityId" });
  const router = useRouter();
  const navigate = useNavigate();
  const toast = useToast();
  const fmt = useFormat();
  const t = useT();
  const r9 = t.running;
  const runs = useRuns();
  const track = useRunTrack(activityId);
  const [sheet, setSheet] = useState<"menu" | "delete" | null>(null);
  /** Distance (m) selected in any chart; shared so the map and all charts show the same spot. */
  const [selD, setSelD] = useState<number | null>(null);

  const derived = useMemo(() => {
    if (!track) return null;
    const coords = decodePolyline(track.polyline);
    const n = Math.min(coords.length, track.t.length);
    const pts = coords.slice(0, n).map(([lat, lon]) => ({ lat, lon }));
    const dist = cumulativeDistances(pts);
    const t = track.t.slice(0, n);
    const ele = track.ele?.slice(0, n) ?? null;
    return {
      coords: coords.slice(0, n), dist,
      splits: computeSplits(dist, t, ele),
      pace: paceSeries(dist, t).map((p) => ({ d: p.d, v: p.secPerKm })),
      ele: ele ? seriesByDistance(dist, ele) : [],
      hr: track.hr ? seriesByDistance(dist, track.hr) : [],
    };
  }, [track]);

  if (runs === undefined) return <div className="page" />;
  const r = runs.find((x) => x.activity.id === activityId);
  const back = <button type="button" className="ib" onClick={() => router.history.back()} aria-label={t.common.back}><IconBack /></button>;
  if (!r) return <div className="page"><div className="topbar">{back}</div><p className="muted">{r9.notFound}</p></div>;

  const { activity, run } = r;
  const records = recordsSetBy(activityId, personalBests(runs));
  const efforts = BEST_EFFORTS.filter((e) => run.efforts[e.key] !== undefined);
  const elapsed = activity.endedAt ? (new Date(activity.endedAt).getTime() - r.start.getTime()) / 1000 : run.movingTimeS;
  const fastest = derived?.splits.filter((s) => s.distanceM >= 500).reduce((m, s) => Math.min(m, (s.timeS / s.distanceM) * 1000), Infinity) ?? Infinity;
  const slowest = derived?.splits.filter((s) => s.distanceM >= 500).reduce((m, s) => Math.max(m, (s.timeS / s.distanceM) * 1000), 0) ?? 0;

  const nearest = (series: Array<{ d: number }>) => {
    if (selD === null || !series.length) return null;
    let best = 0;
    series.forEach((p, i) => { if (Math.abs(p.d - selD) < Math.abs(series[best]!.d - selD)) best = i; });
    return best;
  };
  const markerAt = (): [number, number] | null => {
    if (selD === null || !derived) return null;
    const i = derived.dist.findIndex((d) => d >= selD);
    return derived.coords[i < 0 ? derived.coords.length - 1 : i] ?? null;
  };
  const readout = (series: Array<{ d: number; v: number }>, show: (v: number) => string, fallback: string) => {
    const i = nearest(series);
    return i === null ? fallback : `${show(series[i]!.v)} · ${fmt.dist(series[i]!.d)} km`;
  };
  const avg = (series: Array<{ v: number }>) => series.reduce((s, p) => s + p.v, 0) / (series.length || 1);
  const kmLabel = (k: number) => `${fmt.num(k, 0)} km`;

  return (
    <div className="page tight">
      <div className="topbar">
        {back}
        <button type="button" className="ib" onClick={() => setSheet("menu")} aria-label={r9.options}><IconMore /></button>
      </div>
      <div>
        <h1 className="title">{activity.name}</h1>
        <p className="sub">{fmt.date(r.start)} · {fmt.time(r.start)}</p>
      </div>

      {derived && derived.coords.length > 1 && (
        <div className="card route-card"><RouteMap coords={derived.coords} marker={markerAt()} /></div>
      )}

      <div className="card">
        <div className="stats">
          <Stat v={fmt.dist(run.distanceM)} u="km" l={r9.distance} />
          <Stat v={fmt.runTime(run.movingTimeS)} l={r9.movingTime} />
          <Stat v={fmt.pace(r.pace)} u="/km" l={r9.avgPace} />
        </div>
        {(run.elevationGainM !== null || run.avgHr !== null || elapsed - run.movingTimeS > 30) && (
          <div className="stats stats-row">
            {run.elevationGainM !== null && <Stat v={fmt.num(run.elevationGainM, 0)} u="m" l={r9.elevation} />}
            {run.avgHr !== null && <Stat v={String(run.avgHr)} u="bpm" l={r9.avgHr} />}
            {run.maxHr !== null && <Stat v={String(run.maxHr)} u="bpm" l={r9.maxHr} />}
            {run.avgHr === null && elapsed - run.movingTimeS > 30 && <Stat v={fmt.runTime(elapsed)} l={r9.elapsed} />}
          </div>
        )}
      </div>

      {derived && derived.pace.length > 1 && (
        <ChartCard title={r9.pace} readout={readout(derived.pace, (v) => `${fmt.pace(v)} /km`, r9.avg(`${fmt.pace(r.pace)} /km`))}>
          <TrackChart points={derived.pace} invert steps={[15, 30, 60, 120]} format={(v) => fmt.pace(v)}
            selected={nearest(derived.pace)} onSelect={(i) => setSelD(i === null ? null : derived.pace[i]!.d)} label={r9.paceChart} kmLabel={kmLabel} />
        </ChartCard>
      )}
      {derived && derived.ele.length > 1 && (
        <ChartCard title={r9.elevation} readout={readout(derived.ele, (v) => `${fmt.num(v, 0)} m`, `+${fmt.num(run.elevationGainM ?? 0, 0)} m`)}>
          <TrackChart points={derived.ele} area steps={[5, 10, 20, 50, 100, 200]} format={(v) => fmt.num(v, 0)}
            selected={nearest(derived.ele)} onSelect={(i) => setSelD(i === null ? null : derived.ele[i]!.d)} label={r9.elevationChart} kmLabel={kmLabel} />
        </ChartCard>
      )}
      {derived && derived.hr.length > 1 && (
        <ChartCard title={r9.heartRate} readout={readout(derived.hr, (v) => `${Math.round(v)} bpm`, r9.avg(`${run.avgHr ?? Math.round(avg(derived.hr))} bpm`))}>
          <TrackChart points={derived.hr} steps={[5, 10, 20, 40]} format={(v) => String(v)}
            selected={nearest(derived.hr)} onSelect={(i) => setSelD(i === null ? null : derived.hr[i]!.d)} label={r9.hrChart} kmLabel={kmLabel} />
        </ChartCard>
      )}

      {derived && derived.splits.length > 1 && (
        <div className="sec">
          <span className="lbl">{r9.splits}</span>
          <div className="card splits">
            <div className="split th"><span>{r9.colKm}</span><span>{r9.colPace}</span><span /><span className="c-r">{r9.colElev}</span></div>
            {derived.splits.map((s) => {
              const pace = (s.timeS / s.distanceM) * 1000;
              // Bar length: faster = longer, relative to the slowest split (at least a sliver).
              const w = slowest > fastest ? 0.25 + 0.75 * ((slowest - pace) / (slowest - fastest)) : 1;
              return (
                <div key={s.n} className={"split" + (pace === fastest ? " best" : "")}>
                  <span className="muted">{s.distanceM < 990 ? fmt.dist(s.distanceM) : s.n}</span>
                  <span className="nw">{fmt.pace(pace)}</span>
                  <span className="sbar"><i style={{ width: `${Math.max(0.08, Math.min(1, w)) * 100}%` }} /></span>
                  <span className="c-r muted nw">{s.eleDeltaM === null ? "" : `${s.eleDeltaM > 0 ? "+" : ""}${s.eleDeltaM} m`}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {efforts.length > 0 && (
        <div className="sec">
          <span className="lbl">{r9.bestEfforts}</span>
          <div className="card kv">
            {efforts.map((e) => (
              <div key={e.key} className="kv-row">
                <span className="k effort-k">{records.has(e.key) && <span className="medal sm" aria-label={r9.personalBest}><IconMedal /></span>}{r9.efforts[e.key] ?? e.label}</span>
                <span className="v nw"><b>{fmt.runTime(run.efforts[e.key]!)}</b> <span className="muted">{fmt.pace(run.efforts[e.key]! / (e.m / 1000))} /km</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activity.notes && <p className="run-notes">{activity.notes}</p>}
      <p className="hint">
        {r9.source[run.source]}
        {run.stravaId && <> · <a className="strava-link" href={`https://www.strava.com/activities/${run.stravaId}`} target="_blank" rel="noopener noreferrer">{t.strava.viewOnStrava}</a></>}
      </p>

      {sheet === "menu" && (
        <MenuSheet title={activity.name} onClose={() => setSheet(null)} items={[
          { label: r9.editRun, onSelect: () => void navigate({ to: "/running/$activityId/edit", params: { activityId } }) },
          { label: r9.deleteRun, danger: true, onSelect: () => setSheet("delete") },
        ]} />
      )}
      {sheet === "delete" && (
        <ConfirmSheet title={r9.deleteTitle} danger confirm={r9.deleteRun} text={`${activity.name}, ${fmt.date(r.start)}.`}
          onClose={() => setSheet(null)}
          onConfirm={() => void deleteRun(activityId).then((undo) => { toast(r9.deleted, undo); void navigate({ to: "/running" }); })} />
      )}
    </div>
  );
}

function ChartCard({ title, readout, children }: { title: string; readout: string; children: ReactNode }) {
  return (
    <div className="sec">
      <span className="lbl">{title}</span>
      <div className="card chart">
        <p className="readout" style={{ padding: "0 8px", color: "var(--text)" }}>{readout}</p>
        {children}
      </div>
    </div>
  );
}
