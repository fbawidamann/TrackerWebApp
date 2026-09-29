import { EQUIPMENT, MUSCLE_GROUPS, type Exercise, type MuscleGroup } from "@fitness/shared";
import { useMemo, useState, type ReactNode } from "react";
import { muscleGroup, useCatalog, useTraining } from "@/data/hooks";
import { EQUIPMENT_LABEL, exerciseSearchText, matchesQuery } from "@/lib/labels";
import { useFormat } from "@/lib/useFormat";
import { IconCheck, IconChevron, IconSearch, IconSliders, IconX } from "@/ui/icons";
import { Sheet } from "@/ui/Sheet";

export type SortMode = "recent" | "az" | "muscle" | "most";
export interface BrowserFilters { sort: SortMode; groups: MuscleGroup[]; equipment: Exercise["equipment"][]; showHidden: boolean; q: string }

const EMPTY: BrowserFilters = { sort: "recent", groups: [], equipment: [], showHidden: false, q: "" };
/** Filters are remembered separately for the Exercises tab and the picker while the app is open. */
const memory: Record<string, BrowserFilters> = {};

interface Props {
  scope: "tab" | "picker";
  head: ReactNode;
  mode: "browse" | "multi" | "single";
  selected?: string[];
  onRow: (id: string) => void;
  onCreate: (name: string) => void;
}

export function ExerciseBrowser({ scope, head, mode, selected = [], onRow, onCreate }: Props) {
  const catalog = useCatalog();
  const training = useTraining();
  const fmt = useFormat();
  const [f, setF] = useState<BrowserFilters>(() => memory[scope] ?? { ...EMPTY });
  const [sheet, setSheet] = useState(false);
  const update = (next: Partial<BrowserFilters>) => setF((cur) => { const v = { ...cur, ...next }; memory[scope] = v; return v; });

  const usage = useMemo(() => {
    const last = new Map<string, Date>(), count = new Map<string, number>();
    for (const [id, sessions] of training.sessionsByExercise) {
      last.set(id, sessions[sessions.length - 1]!.date);
      count.set(id, sessions.length);
    }
    return { last, count };
  }, [training.sessionsByExercise]);

  const visible = useMemo(() => catalog.list.filter((e) => {
    if (!f.showHidden && catalog.hidden.has(e.id)) return false;
    if (f.groups.length && !f.groups.includes(muscleGroup(e))) return false;
    if (f.equipment.length && !f.equipment.includes(e.equipment)) return false;
    return matchesQuery(exerciseSearchText(e), f.q);
  }), [catalog, f]);

  const sections = useMemo(() => {
    const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name) || a.equipment.localeCompare(b.equipment);
    const done = visible.filter((e) => usage.count.has(e.id));
    const rest = visible.filter((e) => !usage.count.has(e.id)).sort(byName);
    if (f.sort === "az") return [{ title: null as string | null, items: [...visible].sort(byName), side: "last" as const }];
    if (f.sort === "muscle") {
      return MUSCLE_GROUPS.map((g) => ({ title: g as string | null, items: visible.filter((e) => muscleGroup(e) === g).sort(byName), side: "last" as const })).filter((s) => s.items.length);
    }
    const yours = f.sort === "most"
      ? done.sort((a, b) => (usage.count.get(b.id) ?? 0) - (usage.count.get(a.id) ?? 0))
      : done.sort((a, b) => (usage.last.get(b.id)?.getTime() ?? 0) - (usage.last.get(a.id)?.getTime() ?? 0));
    return [
      { title: "Your exercises" as string | null, items: yours, side: (f.sort === "most" ? "count" : "last") as "count" | "last" },
      { title: "All exercises" as string | null, items: rest, side: "last" as const },
    ].filter((s) => s.items.length);
  }, [visible, usage, f.sort]);

  const filterCount = f.groups.length + f.equipment.length + (f.showHidden ? 1 : 0);
  const chips: Array<{ key: string; label: string; remove: () => void }> = [
    ...f.groups.map((g) => ({ key: "g" + g, label: g, remove: () => update({ groups: f.groups.filter((x) => x !== g) }) })),
    ...f.equipment.map((q) => ({ key: "e" + q, label: EQUIPMENT_LABEL[q], remove: () => update({ equipment: f.equipment.filter((x) => x !== q) }) })),
    ...(f.showHidden ? [{ key: "h", label: "Hidden shown", remove: () => update({ showHidden: false }) }] : []),
  ];

  const row = (e: Exercise, side: "last" | "count") => {
    const last = usage.last.get(e.id);
    const isSel = selected.includes(e.id);
    const right = mode === "multi" ? <span className="tick"><IconCheck /></span>
      : mode === "single" ? <IconChevron />
      : <>{side === "count" && usage.count.get(e.id) ? <span>{usage.count.get(e.id)}×</span> : last ? <span>{fmt.relDay(last)}</span> : null}<IconChevron /></>;
    return (
      <button key={e.id} type="button" className="li" onClick={() => onRow(e.id)} aria-pressed={mode === "multi" ? isSel : undefined} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 66px" }}>
        <span className="li-main">
          <span className="li-name">
            {e.name}
            {e.isCustom && <span className="tag">Custom</span>}
            {catalog.hidden.has(e.id) && <span className="tag">Hidden</span>}
          </span>
          <span className="li-meta">{EQUIPMENT_LABEL[e.equipment]} · {muscleGroup(e)}</span>
        </span>
        <span className="li-side">{right}</span>
      </button>
    );
  };

  return (
    <>
      {head}
      <div className="sticky-head" style={{ margin: 0, padding: "8px 20px 10px", top: scope === "tab" ? "var(--safe-t)" : 0 }}>
        <div className="searchrow">
          <label className="search">
            <IconSearch />
            <input className="field" type="search" placeholder="Search" autoComplete="off" value={f.q} onChange={(e) => update({ q: e.target.value })} aria-label="Search exercises" />
          </label>
          <button type="button" className={"ib filter-btn" + (filterCount ? " active" : "")} onClick={() => setSheet(true)} aria-label={"Sort and filter" + (filterCount ? `, ${filterCount} active` : "")}>
            <IconSliders />
            {filterCount > 0 && <span className="badge">{filterCount}</span>}
          </button>
        </div>
        {chips.length > 0 && (
          <div className="chiprow">
            {chips.map((c) => (
              <button key={c.key} type="button" className="fchip" onClick={c.remove} aria-label={"Remove filter " + c.label}>{c.label}<IconX /></button>
            ))}
          </div>
        )}
      </div>
      <div className="stack" style={{ padding: "4px 20px 0", gap: 22 }}>
        {!catalog.loaded ? null : sections.length ? sections.map((s) => (
          <div className="sec" key={s.title ?? "all"}>
            {s.title && <span className="lbl">{s.title}</span>}
            <div className="card list">{s.items.map((e) => row(e, s.side))}</div>
          </div>
        )) : (
          <div className="card empty">
            <p>No exercise found</p>
            {f.q.trim() && <button type="button" className="ghost" onClick={() => onCreate(f.q.trim())}>Create "{f.q.trim()}"</button>}
          </div>
        )}
      </div>
      {sheet && <FilterSheet f={f} count={visible.length} update={update} onClose={() => setSheet(false)} />}
    </>
  );
}

function FilterSheet({ f, count, update, onClose }: { f: BrowserFilters; count: number; update: (p: Partial<BrowserFilters>) => void; onClose: () => void }) {
  const sorts: Array<[SortMode, string]> = [["recent", "Recently used"], ["az", "A–Z"], ["muscle", "Muscle group"], ["most", "Most used"]];
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <Sheet onClose={onClose} label="Sort and filter">
      <h3>Sort and filter</h3>
      <div className="grp"><span className="lbl">Sort</span>
        <div className="chips">{sorts.map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={f.sort === k} onClick={() => update({ sort: k })}>{l}</button>)}</div>
      </div>
      <div className="grp"><span className="lbl">Muscle group</span>
        <div className="chips">{MUSCLE_GROUPS.map((g) => <button key={g} type="button" className="chip" aria-pressed={f.groups.includes(g)} onClick={() => update({ groups: toggle(f.groups, g) })}>{g}</button>)}</div>
      </div>
      <div className="grp"><span className="lbl">Equipment</span>
        <div className="chips">{EQUIPMENT.map((q) => <button key={q} type="button" className="chip" aria-pressed={f.equipment.includes(q)} onClick={() => update({ equipment: toggle(f.equipment, q) })}>{EQUIPMENT_LABEL[q]}</button>)}</div>
      </div>
      <button type="button" className="row" role="switch" aria-checked={f.showHidden} onClick={() => update({ showHidden: !f.showHidden })} style={{ minHeight: 44 }}>
        <span>Show hidden exercises</span><span className="sw" />
      </button>
      <div className="acts two">
        <button type="button" className="btn" onClick={() => update({ sort: "recent", groups: [], equipment: [], showHidden: false })}>Reset</button>
        <button type="button" className="btn btn-primary" onClick={onClose}>Show {count} exercises</button>
      </div>
    </Sheet>
  );
}
