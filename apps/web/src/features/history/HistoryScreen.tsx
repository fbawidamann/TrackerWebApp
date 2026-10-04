import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalog, useRoutines, useRuns, useSettings, useTraining } from "@/data/hooks";
import { RunCard } from "@/features/running/RunCard";
import { useStarter } from "@/features/workout/useStarter";
import { useT } from "@/i18n";
import { matchesQuery } from "@/lib/labels";
import { personalBests, type RunView } from "@/lib/runStats";
import type { WorkoutView } from "@/lib/training";
import { useFormat } from "@/lib/useFormat";
import { IconCalendar, IconPlus, IconSearch, IconSliders, IconX } from "@/ui/icons";
import { Sheet } from "@/ui/Sheet";
import { WorkoutCard } from "./WorkoutCard";
import { StartWorkoutButton } from "@/ui/StartWorkoutButton";

/** One entry of the timeline: a gym workout or a run (docs/design/screens/running.md → History). */
type Item = { kind: "gym"; w: WorkoutView; start: Date } | { kind: "run"; r: RunView; start: Date };

/** Filter id for runs, next to the routine ids and "free". */
const RUNS = "run";

/** Remembered while the app is open. */
const memory = { q: "", routines: [] as string[] };

export function HistoryScreen() {
  const navigate = useNavigate();
  const training = useTraining();
  const runs = useRuns();
  const catalog = useCatalog();
  const routines = useRoutines();
  const settings = useSettings();
  const fmt = useFormat();
  const t = useT();
  const h = t.history;
  const { start, element } = useStarter();
  const [q, setQ] = useState(memory.q);
  const [sel, setSel] = useState<string[]>(memory.routines);
  const [sheet, setSheet] = useState(false);
  const [limit, setLimit] = useState(30);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => { memory.q = q; memory.routines = sel; }, [q, sel]);

  const filtered = useMemo(() => {
    const gym: Item[] = training.workouts.filter((w) => {
      if (sel.length && !sel.includes(w.activity.routineId ?? "free")) return false;
      if (q.trim() && !w.exercises.some((e) => matchesQuery(catalog.byId.get(e.ae.exerciseId)?.name ?? "", q))) return false;
      return true;
    }).map((w) => ({ kind: "gym", w, start: w.start }));
    // Runs have no exercises: an exercise search hides them, and so does a routine filter without "Runs".
    const showRuns = !q.trim() && (!sel.length || sel.includes(RUNS));
    const run: Item[] = showRuns ? (runs ?? []).map((r) => ({ kind: "run", r, start: r.start })) : [];
    return [...gym, ...run].sort((a, b) => b.start.getTime() - a.start.getTime());
  }, [training.workouts, runs, sel, q, catalog]);
  const runPbs = useMemo(() => new Set(personalBests(runs ?? []).map((b) => b.activityId)), [runs]);

  // Load older weeks while scrolling.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) setLimit((l) => l + 30); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const weeks = useMemo(() => {
    const out: Array<{ start: Date; items: typeof filtered }> = [];
    for (const w of filtered.slice(0, limit)) {
      const ws = fmt.weekStart(w.start);
      const g = out[out.length - 1];
      if (g && g.start.getTime() === ws.getTime()) g.items.push(w);
      else out.push({ start: ws, items: [w] });
    }
    return out;
  }, [filtered, limit, fmt]);

  const routineName = (id: string) => (id === "free" ? h.freeform : id === RUNS ? h.runs : routines?.find((r) => r.routine.id === id)?.routine.name ?? h.routineFallback);
  const routineOptions: Array<[string, string]> = [...(routines ?? []).map((r) => [r.routine.id, r.routine.name] as [string, string]), ["free", h.freeform], ...(runs?.length ? [[RUNS, h.runs] as [string, string]] : [])];
  const countFor = (ids: string[]) => training.workouts.filter((w) => (!ids.length || ids.includes(w.activity.routineId ?? "free")) && (!q.trim() || w.exercises.some((e) => matchesQuery(catalog.byId.get(e.ae.exerciseId)?.name ?? "", q)))).length
    + (!q.trim() && (!ids.length || ids.includes(RUNS)) ? runs?.length ?? 0 : 0);
  const weekCount = (items: Item[]) => {
    const g = items.filter((i) => i.kind === "gym").length;
    return h.weekCount(g, items.length - g);
  };

  return (
    <div className="plain">
      <div className="plain-head">
        <div className="topbar" style={{ margin: 0 }}>
          <h1 className="title">{h.history}</h1>
          <span style={{ display: "flex", marginRight: -8 }}>
            <button type="button" className="ib" onClick={() => void navigate({ to: "/history/calendar" })} aria-label={h.calendar}><IconCalendar /></button>
            <button type="button" className="ib" onClick={() => void navigate({ to: "/history/new" })} aria-label={h.logPast}><IconPlus /></button>
          </span>
        </div>
      </div>
      <div className="sticky-head" style={{ margin: 0, padding: "8px 20px 10px", top: "var(--safe-t)" }}>
        <div className="searchrow">
          <label className="search">
            <IconSearch />
            <input className="field" type="search" placeholder={h.searchExercise} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} aria-label={h.searchAria} />
          </label>
          <button type="button" className={"ib filter-btn" + (sel.length ? " active" : "")} onClick={() => setSheet(true)} aria-label={h.filterAria(sel.length)}>
            <IconSliders />{sel.length > 0 && <span className="badge">{sel.length}</span>}
          </button>
        </div>
        {sel.length > 0 && (
          <div className="chiprow">
            {sel.map((id) => <button key={id} type="button" className="fchip" onClick={() => setSel(sel.filter((x) => x !== id))} aria-label={h.removeFilter(routineName(id))}>{routineName(id)}<IconX /></button>)}
          </div>
        )}
      </div>
      <div className="stack" style={{ padding: "6px 20px 0", gap: 28 }}>
        {!training.loaded || runs === undefined ? null : !training.workouts.length && !runs.length ? (
          <div className="card empty" style={{ justifyItems: "stretch" }}>
            <p>{h.noWorkouts}</p>
            <StartWorkoutButton onStart={() => void start()} />
          </div>
        ) : !weeks.length ? (
          <div className="card empty"><p>{h.noneFound}</p></div>
        ) : weeks.map((g) => (
          <div className="week" key={g.start.getTime()}>
            <span className="lbl">{fmt.weekLabel(g.start)} · {weekCount(g.items)}</span>
            {g.items.map((it) => it.kind === "gym" ? (
              <WorkoutCard key={it.w.activity.id} w={it.w} catalog={catalog} fmt={fmt} style={settings.historyCardStyle} query={q}
                onOpen={() => void navigate({ to: "/history/$activityId", params: { activityId: it.w.activity.id } })} />
            ) : (
              <RunCard key={it.r.activity.id} r={it.r} fmt={fmt} pb={runPbs.has(it.r.activity.id)}
                onOpen={() => void navigate({ to: "/running/$activityId", params: { activityId: it.r.activity.id } })} />
            ))}
          </div>
        ))}
        <div ref={sentinel} />
      </div>
      {sheet && (
        <Sheet onClose={() => setSheet(false)} label={t.common.filter}>
          <h3>{t.common.filter}</h3>
          <div className="grp">
            <span className="lbl">{h.filterRoutine}</span>
            <div className="chips">
              {routineOptions.map(([id, name]) => (
                <button key={id} type="button" className="chip" aria-pressed={sel.includes(id)} onClick={() => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])}>{name}</button>
              ))}
            </div>
          </div>
          <div className="acts two">
            <button type="button" className="btn" onClick={() => setSel([])}>{t.common.reset}</button>
            <button type="button" className="btn btn-primary" onClick={() => setSheet(false)}>{h.show(countFor(sel))}</button>
          </div>
        </Sheet>
      )}
      {element}
    </div>
  );
}
