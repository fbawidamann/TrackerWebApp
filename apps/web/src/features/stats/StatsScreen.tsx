import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { muscleGroup, useCatalog, useRuns, useTraining } from "@/data/hooks";
import { Stat } from "@/features/running/RunningScreen";
import { useT } from "@/i18n";
import { summarize } from "@/lib/runStats";
import { gymSummary, setsPerGroup, topExercises, weeklyWorkouts } from "@/lib/stats";
import { useNow } from "@/lib/time";
import { useFormat } from "@/lib/useFormat";
import { BarChart } from "@/ui/BarChart";
import { IconChevron, IconRun } from "@/ui/icons";

type Period = "week" | "month" | "year" | "all";
const PERIODS: Period[] = ["week", "month", "year", "all"];

/** Statistics (docs/design/screens/stats.md): totals for a period, workouts per week, sets per muscle group, top exercises. */
export function StatsScreen() {
  const training = useTraining();
  const catalog = useCatalog();
  const runs = useRuns();
  const fmt = useFormat();
  const navigate = useNavigate();
  const t = useT();
  const s = t.stats;
  const now = useNow(60_000);
  const [period, setPeriod] = useState<Period>("month");
  const [week, setWeek] = useState<number | null>(null);

  const today = new Date(now);
  const from = period === "week" ? fmt.weekStart(today)
    : period === "month" ? new Date(today.getFullYear(), today.getMonth(), 1)
    : period === "year" ? new Date(today.getFullYear(), 0, 1) : null;

  // Memo on the timestamp: `from` is a new Date object on every render.
  const fromMs = from ? from.getTime() : null;
  const sum = useMemo(() => gymSummary(training.workouts, fromMs === null ? null : new Date(fromMs)), [training.workouts, fromMs]);
  const groups = useMemo(() => setsPerGroup(training.workouts, catalog.byId, muscleGroup, fromMs === null ? null : new Date(fromMs)),
    [training.workouts, catalog.byId, fromMs]);
  const maxGroup = Math.max(1, ...groups.map((g) => g.sets));
  const top = useMemo(() => topExercises(training.workouts, fromMs === null ? null : new Date(fromMs)), [training.workouts, fromMs]);
  const weeks = useMemo(() => weeklyWorkouts(training.workouts, fmt.weekStart, new Date(now)), [training.workouts, fmt, now]);
  const selWeek = weeks[week ?? weeks.length - 1]!;
  const run = summarize(runs ?? [], from);

  return (
    <div className="page">
      <h1 className="title">{s.title}</h1>

      <div className="seg" role="tablist" aria-label={s.period}>
        {PERIODS.map((p) => <button key={p} type="button" role="tab" aria-selected={period === p} onClick={() => setPeriod(p)}>{s.periods[p]}</button>)}
      </div>

      <div className="card">
        <div className="stats">
          <Stat v={String(sum.workouts)} l={s.workouts} />
          <Stat v={String(sum.sets)} l={s.sets} />
          <Stat v={fmt.duration(sum.minutes)} l={s.time} />
        </div>
        <div className="stats stats-row">
          <Stat v={fmt.num(sum.volumeKg / 1000, 1)} u="t" l={s.volume} />
          <Stat v={String(sum.prs)} l={s.prs} />
          <Stat v={sum.avgMinutes ? fmt.duration(sum.avgMinutes) : "–"} l={s.avg} />
        </div>
      </div>

      <div className="sec">
        <span className="lbl">{s.perWeek}</span>
        <div className="card chart">
          <p className="readout" style={{ padding: "0 8px" }}>
            <b className="nw">{selWeek.count}</b>{s.weekReadout(selWeek.count, fmt.weekLabel(selWeek.start))}
          </p>
          <BarChart bars={weeks.map((w) => ({ label: fmt.shortDate(w.start), value: w.count }))}
            steps={[1, 2, 5, 10]} format={(v) => fmt.num(v, 0)}
            selected={week ?? weeks.length - 1} onSelect={setWeek} label={s.perWeekChart} />
        </div>
      </div>

      <div className="sec">
        <span className="lbl">{s.muscleGroups}</span>
        <div className="card hbars">
          {groups.map((g) => (
            <div key={g.group} className="hbar">
              <span className="hbar-l">{t.group[g.group]}</span>
              <span className="hbar-t"><i style={{ width: `${(g.sets / maxGroup) * 100}%` }} /></span>
              <span className="hbar-v">{g.sets}</span>
            </div>
          ))}
          <p className="small muted hbar-hint">{s.muscleHint}</p>
        </div>
      </div>

      {top.length > 0 ? (
        <div className="sec">
          <span className="lbl">{s.topExercises}</span>
          <div className="card list">
            {top.map((x) => {
              const ex = catalog.byId.get(x.exerciseId);
              return (
                <button key={x.exerciseId} type="button" className="li" onClick={() => void navigate({ to: "/exercises/$exerciseId", params: { exerciseId: x.exerciseId } })}>
                  <span className="li-main"><span className="li-name">{ex?.name ?? "–"}</span><span className="li-meta">{s.topMeta(x.sessions, x.sets)}</span></span>
                  <span className="li-side"><IconChevron /></span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card empty"><p>{s.empty}</p></div>
      )}

      {run.count > 0 && (
        <div className="sec">
          <span className="lbl">{s.running}</span>
          <div className="card list">
            <button type="button" className="li" onClick={() => void navigate({ to: "/running" })}>
              <span className="lead">
                <span className="medal"><IconRun /></span>
                <span className="li-main"><span className="li-name">{s.runningMeta(run.count, fmt.dist(run.distanceM))}</span><span className="li-meta">{fmt.runTime(run.timeS)}</span></span>
              </span>
              <span className="li-side"><IconChevron /></span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
