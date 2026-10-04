import { toDisplayWeight } from "@fitness/shared";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { muscleGroup, useCatalog, useRuns, useSettings, useTraining } from "@/data/hooks";
import { useT, type Dict } from "@/i18n";
import { summarize } from "@/lib/runStats";
import {
  consistency, dayGrid, delta, FLAGGED_GROUPS, GUIDE_SETS_PER_WEEK, gymSummary, liftTrends, LOW_SETS_PER_WEEK, periodRange,
  prsInPeriod, setsPerGroup, topExercises, weeksCovered, type Delta, type Period,
} from "@/lib/stats";
import { useNow } from "@/lib/time";
import { useFormat } from "@/lib/useFormat";
import { IconChevron, IconMedal, IconRun } from "@/ui/icons";
import { Sparkline } from "@/ui/Sparkline";
import { ConsistencyGrid } from "./ConsistencyGrid";

const PERIODS: Period[] = ["week", "month", "year", "all"];
const PERIOD_KEY = "stats.period";
const PR_STEP = 5;

/** The period survives a trip to an exercise and back (session only: a fresh app start opens on Month again). */
function initialPeriod(): Period {
  try {
    const p = sessionStorage.getItem(PERIOD_KEY);
    if (p && (PERIODS as string[]).includes(p)) return p as Period;
  } catch { /* storage blocked */ }
  return "month";
}

/** "+3", "−2", "±0" (real minus sign). */
const signed = (n: number, text: string) => (n > 0 ? "+" : n < 0 ? "−" : "±") + text;

/**
 * Statistics (docs/design/screens/stats.md): period totals with changes vs the same stretch before, consistency over
 * 12 weeks, sets per muscle group (per week, with drill-down), strength trend (e1RM) of the top exercises, new PRs.
 */
export function StatsScreen() {
  const training = useTraining();
  const catalog = useCatalog();
  const runs = useRuns();
  const settings = useSettings();
  const fmt = useFormat();
  const navigate = useNavigate();
  const t = useT();
  const s = t.stats;
  const now = useNow(60_000);
  const [period, setPeriodState] = useState<Period>(initialPeriod);
  const [week, setWeek] = useState<number | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [prShown, setPrShown] = useState(PR_STEP);

  const setPeriod = (p: Period) => {
    setPeriodState(p);
    setPrShown(PR_STEP);
    setOpenGroup(null);
    try { sessionStorage.setItem(PERIOD_KEY, p); } catch { /* ignore */ }
  };

  // `now` ticks once a minute; all derived data is memoised on it and the period.
  const ws = training.workouts;
  const range = useMemo(() => periodRange(period, new Date(now), fmt.weekStart), [period, now, fmt]);
  const sum = useMemo(() => gymSummary(ws, range.from), [ws, range]);
  const prev = useMemo(() => (range.prevFrom ? gymSummary(ws, range.prevFrom, range.prevTo) : null), [ws, range]);
  const groups = useMemo(() => setsPerGroup(ws, catalog.byId, muscleGroup, range.from), [ws, catalog.byId, range]);
  const top = useMemo(() => topExercises(ws, range.from), [ws, range]);
  const lifts = useMemo(() => liftTrends(training.sessionsByExercise, top.map((x) => x.exerciseId), range, new Date(now)),
    [training.sessionsByExercise, top, range, now]);
  const prs = useMemo(() => prsInPeriod(training.prEvents, range.from, new Date(now)), [training.prEvents, range, now]);
  const grid = useMemo(() => dayGrid(ws, fmt.weekStart, new Date(now)), [ws, fmt, now]);
  const cons = useMemo(() => consistency(ws, fmt.weekStart, new Date(now), settings.weeklyGoal), [ws, fmt, now, settings.weeklyGoal]);
  const run = summarize(runs ?? [], range.from);

  if (!training.loaded) {
    return (
      <div className="page stats-page" aria-busy="true">
        <h1 className="title">{s.title}</h1>
        <p className="vh" role="status">{s.loading}</p>
        <div className="skel" style={{ height: 40 }} />
        <div className="skel" style={{ height: 150 }} />
        <div className="skel" style={{ height: 260 }} />
      </div>
    );
  }

  if (!ws.length) {
    return (
      <div className="page stats-page">
        <h1 className="title">{s.title}</h1>
        <div className="card empty">
          <p className="empty-t">{s.emptyAll}</p>
          <p className="small">{s.emptyAllHint}</p>
        </div>
      </div>
    );
  }

  const firstWorkout = ws[ws.length - 1]!.start;
  const perWeek = weeksCovered(range.from, firstWorkout, new Date(now));
  const groupValue = (sets: number) => (perWeek ? sets / perWeek : sets);
  const scaleMax = Math.max(perWeek ? GUIDE_SETS_PER_WEEK * 1.25 : 1, ...groups.map((g) => groupValue(g.sets)));
  const fmtGroup = (sets: number) => {
    const v = groupValue(sets);
    return perWeek ? fmt.num(v, v < 10 ? 1 : 0) : String(sets);
  };
  const wt = (kg: number) => Math.round(toDisplayWeight(kg, fmt.prefs));
  const selIdx = week ?? grid.length - 1;
  const selWeek = grid[selIdx]!;
  const selReached = settings.weeklyGoal > 0 && selWeek.count >= settings.weeklyGoal;
  const openExercise = (exerciseId: string) => void navigate({ to: "/exercises/$exerciseId", params: { exerciseId } });
  const dayLabels = grid[0]!.days.map((d) => fmt.weekday(d.date).slice(0, 2));

  const count = (x: Delta) => signed(x.diff, String(Math.abs(x.diff)));
  const mins = (x: Delta) => signed(x.diff, fmt.duration(Math.abs(x.diff)));
  const pct = (x: Delta) => x.pct !== null ? signed(x.pct, `${Math.abs(x.pct)} %`) : signed(x.diff, `${fmt.num(Math.abs(x.diff) / 1000, 1)} t`);
  const dl = (cur: number, before: number | undefined, show: (x: Delta) => string) =>
    prev && before !== undefined ? <DeltaTag d={delta(cur, before)} show={show} t={s} /> : null;

  return (
    <div className="page stats-page">
      <h1 className="title">{s.title}</h1>

      <div className="sec">
        <div className="seg" role="tablist" aria-label={s.period}>
          {PERIODS.map((p) => <button key={p} type="button" role="tab" aria-selected={period === p} onClick={() => setPeriod(p)}>{s.periods[p]}</button>)}
        </div>
        <div className="card">
          <div className="stats">
            <StatD v={String(sum.workouts)} l={s.workouts} d={dl(sum.workouts, prev?.workouts, count)} />
            <StatD v={String(sum.sets)} l={s.sets} d={dl(sum.sets, prev?.sets, count)} />
            <StatD v={fmt.duration(sum.minutes)} l={s.time} d={dl(sum.minutes, prev?.minutes, mins)} />
          </div>
          <div className="stats stats-row">
            <StatD v={fmt.num(sum.volumeKg / 1000, 1)} u="t" l={s.volume} d={dl(sum.volumeKg, prev?.volumeKg, pct)} />
            <StatD v={String(sum.prs)} l={s.prs} d={dl(sum.prs, prev?.prs, count)} />
            <StatD v={sum.avgMinutes ? fmt.duration(sum.avgMinutes) : "–"} l={s.avg}
              d={prev ? (sum.avgMinutes && prev.avgMinutes ? dl(sum.avgMinutes, prev.avgMinutes, mins) : <DeltaTag d={null} show={count} t={s} />) : null} />
          </div>
        </div>
        {period !== "all" && <p className="hint stat-foot">{s.vsPrev[period]}</p>}
      </div>

      <div className="sec">
        <div className="sec-head"><span className="lbl">{s.consistency}</span><span className="lbl">{s.last12}</span></div>
        <div className="card">
          <div className="stats">
            <div className="stat" role="group" aria-label={s.streakAria(cons.streak)}>
              <span className="stat-v" aria-hidden="true">{cons.streak}<span className="u">{s.weeksUnit}</span></span>
              <span className="lbl" aria-hidden="true">{s.streak}</span>
            </div>
            <div className="stat" role="group" aria-label={cons.counted ? s.goalHitAria(cons.hit, cons.counted) : s.goalHit}>
              <span className="stat-v" aria-hidden="true">{cons.counted ? <>{cons.hit}<span className="u">/{cons.counted}</span></> : "–"}</span>
              <span className="lbl" aria-hidden="true">{s.goalHit}</span>
            </div>
            <div className="stat">
              <span className="stat-v">{cons.counted ? fmt.num(cons.avgPerWeek, 1) : "–"}</span>
              <span className="lbl">{s.perWeekAvg}</span>
            </div>
          </div>
          <div className="cg-wrap stats-row">
            <p className="readout" aria-live="polite">
              <b className="nw">{selWeek.count}</b>{s.weekReadout(selWeek.count, fmt.weekLabel(selWeek.start))}
              {selReached && <> · <span className="reached">{s.goalReached}</span></>}
            </p>
            <ConsistencyGrid weeks={grid} goal={settings.weeklyGoal} selected={selIdx} onSelect={setWeek}
              dayLabels={dayLabels} weekLabel={(d) => fmt.shortDate(d)} label={s.consistencyChart}
              ariaFor={(w, reached) => s.weekAria(fmt.weekLabel(w.start), w.count, reached)} />
            <p className="hint cg-legend"><b className="cg-goal ok" aria-hidden="true" />{s.goalLegend(settings.weeklyGoal)}</p>
          </div>
        </div>
      </div>

      {sum.workouts === 0 ? (
        <div className="card empty"><p>{s.empty}</p></div>
      ) : (
        <>
          <div className="sec">
            <div className="sec-head"><span className="lbl">{s.muscleGroups}</span><span className="lbl">{perWeek ? s.perWeekUnit : s.totalUnit}</span></div>
            <div className="card hbars">
              {groups.map((g) => {
                const v = groupValue(g.sets);
                const low = perWeek !== null && FLAGGED_GROUPS.includes(g.group) && v < LOW_SETS_PER_WEEK;
                const open = openGroup === g.group;
                return (
                  <div key={g.group} className="hb-item">
                    <button type="button" className={"hbar" + (low ? " low" : "")} aria-expanded={open} disabled={!g.sets}
                      aria-label={s.groupAria(t.group[g.group], fmtGroup(g.sets), open) + (low ? `, ${s.lowAria}` : "")}
                      onClick={() => setOpenGroup(open ? null : g.group)}>
                      <span className="hbar-l">{t.group[g.group]}</span>
                      <span className="hbar-t">
                        <i style={{ width: `${(v / scaleMax) * 100}%` }} />
                        {perWeek !== null && <em style={{ left: `${(GUIDE_SETS_PER_WEEK / scaleMax) * 100}%` }} />}
                      </span>
                      <span className="hbar-v">{low && <span className="low-tag">{s.low}</span>}{fmtGroup(g.sets)}</span>
                      <IconChevron className={"hbar-chev" + (open ? " open" : "")} />
                    </button>
                    {open && (
                      <div className="hb-drill">
                        {g.exercises.map((x) => (
                          <button key={x.exerciseId} type="button" className="li" onClick={() => openExercise(x.exerciseId)}>
                            <span className="li-name">{catalog.byId.get(x.exerciseId)?.name ?? "–"}</span>
                            <span className="li-side">{t.common.sets(x.sets)}<IconChevron /></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="small muted hbar-hint">{perWeek ? s.perWeekHint : s.muscleHint}</p>
            </div>
          </div>

          {top.length > 0 && (
            <div className="sec">
              <span className="lbl">{s.topExercises}</span>
              <div className="card list">
                {top.map((x, i) => {
                  const name = catalog.byId.get(x.exerciseId)?.name ?? "–";
                  const lift = lifts[i];
                  const best = lift?.best ?? null;
                  const before = lift?.prev ?? null;
                  const diff = best !== null && before !== null ? wt(best) - wt(before) : null;
                  return (
                    <button key={x.exerciseId} type="button" className="li" onClick={() => openExercise(x.exerciseId)}>
                      <span className="li-main"><span className="li-name">{name}</span><span className="li-meta">{s.topMeta(x.sessions, x.sets)}</span></span>
                      <span className="li-side lift-side">
                        {lift && lift.series.length >= 2 && <Sparkline values={lift.series} label={s.trendAria} />}
                        {best !== null && (
                          <span className="pr-val" aria-label={s.e1rmAria(`${fmt.num(wt(best), 0)} ${fmt.unit}`, diff ? signed(diff, `${Math.abs(diff)} ${fmt.unit}`) : null)}>
                            <span className="v nw" aria-hidden="true">{fmt.num(wt(best), 0)}<span className="u">{fmt.unit}</span></span>
                            <span className="li-meta nw" aria-hidden="true">e1RM{diff ? <> <span className={diff > 0 ? "up" : ""}>{signed(diff, String(Math.abs(diff)))}</span></> : null}</span>
                          </span>
                        )}
                        <IconChevron />
                      </span>
                    </button>
                  );
                })}
              </div>
              {lifts.some((l) => l.best !== null) && <p className="hint stat-foot">{s.e1rmHint}</p>}
            </div>
          )}

          {prs.length > 0 && (
            <div className="sec">
              <div className="sec-head"><span className="lbl">{s.newPrs}</span><span className="lbl">{prs.length}</span></div>
              <div className="card list">
                {prs.slice(0, prShown).map((e, i) => (
                  <button key={`${e.activityId}-${e.exerciseId}-${i}`} type="button" className="li" onClick={() => openExercise(e.exerciseId)}>
                    <span className="lead">
                      <span className="medal"><IconMedal /></span>
                      <span className="li-main">
                        <span className="li-name">{catalog.byId.get(e.exerciseId)?.name ?? "–"}</span>
                        <span className="li-meta">{s.prMeta(fmt.shortDate(e.date), fmt.weight(e.previous))}</span>
                      </span>
                    </span>
                    <span className="pr-val"><span className="v nw">{fmt.weight(e.value)}</span></span>
                  </button>
                ))}
              </div>
              {prs.length > prShown && (
                <button type="button" className="ghost" style={{ justifySelf: "start" }} onClick={() => setPrShown(prs.length)}>{s.showAll(prs.length)}</button>
              )}
            </div>
          )}
        </>
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

/** Stat tile with an optional change line under the label. */
function StatD({ v, u, l, d }: { v: string; u?: string; l: string; d: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-v">{v}{u && <span className="u">{u}</span>}</span>
      <span className="lbl">{l}</span>
      {d}
    </div>
  );
}

/**
 * Change vs the comparison window: "+3" in the accent colour when up, muted when down or equal. Less isn't
 * automatically bad (deload week), so never red. Without a value it keeps the line height so tiles stay aligned.
 */
function DeltaTag({ d, show, t }: { d: Delta | null; show: (d: Delta) => string; t: Dict["stats"] }) {
  if (!d) return <span className="delta" aria-hidden="true">{" "}</span>;
  const text = show(d);
  const plain = text.replace(/^[+−±]/, "");
  const aria = d.dir > 0 ? t.deltaUp(plain) : d.dir < 0 ? t.deltaDown(plain) : t.deltaSame;
  return (
    <span className={"delta" + (d.dir > 0 ? " up" : "")}>
      <span aria-hidden="true">{text}</span>
      <span className="vh">{aria}</span>
    </span>
  );
}
