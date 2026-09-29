import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalog, useRoutines, useSettings, useTraining } from "@/data/hooks";
import { useStarter } from "@/features/workout/useStarter";
import { matchesQuery } from "@/lib/labels";
import { useFormat } from "@/lib/useFormat";
import { IconCalendar, IconPlus, IconSearch, IconSliders, IconX } from "@/ui/icons";
import { Sheet } from "@/ui/Sheet";
import { WorkoutCard } from "./WorkoutCard";

/** Remembered while the app is open. */
const memory = { q: "", routines: [] as string[] };

export function HistoryScreen() {
  const navigate = useNavigate();
  const training = useTraining();
  const catalog = useCatalog();
  const routines = useRoutines();
  const settings = useSettings();
  const fmt = useFormat();
  const { start, element } = useStarter();
  const [q, setQ] = useState(memory.q);
  const [sel, setSel] = useState<string[]>(memory.routines);
  const [sheet, setSheet] = useState(false);
  const [limit, setLimit] = useState(30);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => { memory.q = q; memory.routines = sel; }, [q, sel]);

  const filtered = useMemo(() => training.workouts.filter((w) => {
    if (sel.length && !sel.includes(w.activity.routineId ?? "free")) return false;
    if (q.trim() && !w.exercises.some((e) => matchesQuery(catalog.byId.get(e.ae.exerciseId)?.name ?? "", q))) return false;
    return true;
  }), [training.workouts, sel, q, catalog]);

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

  const routineName = (id: string) => (id === "free" ? "Freeform" : routines?.find((r) => r.routine.id === id)?.routine.name ?? "Routine");
  const routineOptions: Array<[string, string]> = [...(routines ?? []).map((r) => [r.routine.id, r.routine.name] as [string, string]), ["free", "Freeform"]];
  const countFor = (ids: string[]) => training.workouts.filter((w) => (!ids.length || ids.includes(w.activity.routineId ?? "free")) && (!q.trim() || w.exercises.some((e) => matchesQuery(catalog.byId.get(e.ae.exerciseId)?.name ?? "", q)))).length;

  return (
    <div className="plain">
      <div className="plain-head">
        <div className="topbar" style={{ margin: 0 }}>
          <h1 className="title">History</h1>
          <span style={{ display: "flex", marginRight: -8 }}>
            <button type="button" className="ib" onClick={() => void navigate({ to: "/history/calendar" })} aria-label="Calendar"><IconCalendar /></button>
            <button type="button" className="ib" onClick={() => void navigate({ to: "/history/new" })} aria-label="Log past workout"><IconPlus /></button>
          </span>
        </div>
      </div>
      <div className="sticky-head" style={{ margin: 0, padding: "8px 20px 10px", top: "var(--safe-t)" }}>
        <div className="searchrow">
          <label className="search">
            <IconSearch />
            <input className="field" type="search" placeholder="Search exercise" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search workouts by exercise" />
          </label>
          <button type="button" className={"ib filter-btn" + (sel.length ? " active" : "")} onClick={() => setSheet(true)} aria-label={"Filter" + (sel.length ? `, ${sel.length} active` : "")}>
            <IconSliders />{sel.length > 0 && <span className="badge">{sel.length}</span>}
          </button>
        </div>
        {sel.length > 0 && (
          <div className="chiprow">
            {sel.map((id) => <button key={id} type="button" className="fchip" onClick={() => setSel(sel.filter((x) => x !== id))} aria-label={"Remove filter " + routineName(id)}>{routineName(id)}<IconX /></button>)}
          </div>
        )}
      </div>
      <div className="stack" style={{ padding: "6px 20px 0", gap: 28 }}>
        {!training.loaded ? null : !training.workouts.length ? (
          <div className="card empty" style={{ justifyItems: "stretch" }}>
            <p>No workouts yet</p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => void start()}>Start empty workout</button>
          </div>
        ) : !weeks.length ? (
          <div className="card empty"><p>No workouts found</p></div>
        ) : weeks.map((g) => (
          <div className="week" key={g.start.getTime()}>
            <span className="lbl">{fmt.weekLabel(g.start)} · {g.items.length} {g.items.length === 1 ? "workout" : "workouts"}</span>
            {g.items.map((w) => (
              <WorkoutCard key={w.activity.id} w={w} catalog={catalog} fmt={fmt} style={settings.historyCardStyle} query={q}
                onOpen={() => void navigate({ to: "/history/$activityId", params: { activityId: w.activity.id } })} />
            ))}
          </div>
        ))}
        <div ref={sentinel} />
      </div>
      {sheet && (
        <Sheet onClose={() => setSheet(false)} label="Filter">
          <h3>Filter</h3>
          <div className="grp">
            <span className="lbl">Routine</span>
            <div className="chips">
              {routineOptions.map(([id, name]) => (
                <button key={id} type="button" className="chip" aria-pressed={sel.includes(id)} onClick={() => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])}>{name}</button>
              ))}
            </div>
          </div>
          <div className="acts two">
            <button type="button" className="btn" onClick={() => setSel([])}>Reset</button>
            <button type="button" className="btn btn-primary" onClick={() => setSheet(false)}>Show {countFor(sel)} workouts</button>
          </div>
        </Sheet>
      )}
      {element}
    </div>
  );
}
