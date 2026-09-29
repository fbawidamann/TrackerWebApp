import { parseRepsInput, type Exercise, type SetType, type WorkoutSet } from "@fitness/shared";
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { columnsFor } from "@/lib/labels";
import { durationInputValue, parseDurationInput } from "@/lib/time";
import type { Fmt } from "@/lib/useFormat";
import { IconCheck } from "@/ui/icons";

/** Minimal shape shared by live sets (DB rows) and draft sets (edit mode). */
export interface TableSet {
  key: string;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  durationS: number | null;
  done?: boolean;
}

export interface Placeholder { weightKg: number | null; reps: number | null; durationS: number | null }

/** Placeholder for row i: the previous session's matching set, else the row above (its value or placeholder). */
export function placeholders(sets: TableSet[], prev: WorkoutSet[] | undefined): Array<{ prev: WorkoutSet | null; ph: Placeholder | null }> {
  const out: Array<{ prev: WorkoutSet | null; ph: Placeholder | null }> = [];
  const counts: Record<string, number> = {};
  sets.forEach((s, i) => {
    const k = counts[s.setType] ?? 0;
    counts[s.setType] = k + 1;
    const p = prev?.filter((x) => x.setType === s.setType)[k] ?? null;
    let ph: Placeholder | null = p ? { weightKg: p.weightKg, reps: p.reps, durationS: p.durationS } : null;
    if (!ph && i > 0) {
      const above = sets[i - 1]!, abovePh = out[i - 1]!.ph;
      ph = { weightKg: above.weightKg ?? abovePh?.weightKg ?? null, reps: above.reps ?? abovePh?.reps ?? null, durationS: above.durationS ?? abovePh?.durationS ?? null };
    }
    out.push({ prev: p, ph });
  });
  return out;
}

interface Props {
  exercise: Exercise | undefined;
  sets: TableSet[];
  prev: WorkoutSet[] | undefined;
  fmt: Fmt;
  withCheck: boolean;
  onChange: (key: string, changes: Partial<Pick<TableSet, "weightKg" | "reps" | "durationS">>) => void;
  onCheck?: (key: string, filled: Placeholder | null) => void;
  onSetMenu: (key: string) => void;
  onSwipeDelete: (key: string) => void;
  afterRow?: (key: string) => ReactNode;
  /** Row keys whose empty required fields should be highlighted (edit mode Save). */
  need?: Set<string>;
}

/** The logging set table: SET · PREVIOUS · KG · REPS · ✓ (✓ hidden in edit mode). */
export function SetTable({ exercise, sets, prev, fmt, withCheck, onChange, onCheck, onSetMenu, onSwipeDelete, afterRow, need }: Props) {
  const cols = columnsFor(exercise);
  const info = placeholders(sets, prev);
  const narrow = !cols.weight || !cols.reps;
  const cls = "tr" + (narrow ? " r" : "") + (withCheck ? "" : " nochk");
  let n = 0;
  return (
    <div>
      <div className={cls + " th"}>
        <span className="lbl">Set</span>
        <span className="lbl">Previous</span>
        {cols.weight && <span className="lbl c">{fmt.unit}</span>}
        {cols.reps && <span className="lbl c">Reps</span>}
        {cols.time && <span className="lbl c">Time</span>}
        {withCheck && <span />}
      </div>
      {sets.map((s, i) => {
        if (s.setType !== "warmup") n++;
        const label = s.setType === "warmup" ? "W" : String(n);
        const { prev: p, ph } = info[i]!;
        const prevText = !p ? "–"
          : cols.time ? durationInputValue(p.durationS)
          : !cols.weight ? `${p.reps ?? 0} reps`
          : `${fmt.weightValue(p.weightKg ?? 0)} × ${p.reps ?? 0}`;
        return (
          <div key={s.key}>
            <SetRow cls={cls} label={label} warm={s.setType === "warmup"} set={s} prevText={prevText} ph={ph} cols={cols} fmt={fmt}
              withCheck={withCheck} forceNeed={!!need?.has(s.key)} onChange={onChange} onCheck={onCheck} onSetMenu={onSetMenu} onSwipeDelete={onSwipeDelete} />
            {afterRow?.(s.key)}
          </div>
        );
      })}
    </div>
  );
}

function SetRow(props: {
  cls: string; label: string; warm: boolean; set: TableSet; prevText: string; ph: Placeholder | null;
  cols: ReturnType<typeof columnsFor>; fmt: Fmt; withCheck: boolean; forceNeed: boolean;
} & Pick<Props, "onChange" | "onCheck" | "onSetMenu" | "onSwipeDelete">) {
  const { cls, label, warm, set, prevText, ph, cols, fmt, withCheck, forceNeed, onChange, onCheck, onSetMenu, onSwipeDelete } = props;
  const [w, setW] = useState(() => fmt.weightInput(set.weightKg));
  const [r, setR] = useState(() => (set.reps === null ? "" : String(set.reps)));
  const [t, setT] = useState(() => durationInputValue(set.durationS));
  const [need, setNeed] = useState<string[]>([]);
  // Keep inputs in sync when the stored value changes elsewhere (✓ filling placeholders, undo, unit switch).
  const synced = useRef({ weightKg: set.weightKg, reps: set.reps, durationS: set.durationS, unit: fmt.unit });
  if (synced.current.weightKg !== set.weightKg || synced.current.unit !== fmt.unit) {
    const parsed = fmt.parseWeight(w);
    if (!(parsed.ok && parsed.value === set.weightKg) || synced.current.unit !== fmt.unit) setW(fmt.weightInput(set.weightKg));
    synced.current = { ...synced.current, weightKg: set.weightKg, unit: fmt.unit };
  }
  if (synced.current.reps !== set.reps) {
    if (String(set.reps ?? "") !== r) setR(set.reps === null ? "" : String(set.reps));
    synced.current = { ...synced.current, reps: set.reps };
  }
  if (synced.current.durationS !== set.durationS) {
    if (parseDurationInput(t) !== set.durationS) setT(durationInputValue(set.durationS));
    synced.current = { ...synced.current, durationS: set.durationS };
  }

  const has = (v: string, p: number | null | undefined) => v.trim() !== "" || (p !== null && p !== undefined);
  const needW = need.includes("w") || (forceNeed && !has(w, ph?.weightKg));
  const needR = need.includes("r") || (forceNeed && !has(r, ph?.reps));
  const needT = need.includes("t") || (forceNeed && !has(t, ph?.durationS));
  const ready = (!cols.weight || has(w, ph?.weightKg)) && (!cols.reps || has(r, ph?.reps)) && (!cols.time || has(t, ph?.durationS));

  const check = () => {
    if (!onCheck) return;
    if (set.done) { onCheck(set.key, null); return; }
    const pw = fmt.parseWeight(w), pr = parseRepsInput(r), pt = parseDurationInput(t);
    const bad: string[] = [];
    const weightKg = cols.weight ? (pw.ok ? pw.value ?? ph?.weightKg ?? null : null) : null;
    const reps = cols.reps ? (pr.ok ? pr.value ?? ph?.reps ?? null : null) : null;
    const durationS = cols.time ? (pt === undefined ? null : pt ?? ph?.durationS ?? null) : null;
    if (cols.weight && weightKg === null) bad.push("w");
    if (cols.reps && reps === null) bad.push("r");
    if (cols.time && durationS === null) bad.push("t");
    if (bad.length) {
      setNeed(bad);
      window.setTimeout(() => setNeed([]), 900);
      return;
    }
    onCheck(set.key, { weightKg, reps, durationS });
  };

  const next = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const all = [...document.querySelectorAll<HTMLInputElement>("input.inp")];
    const nextEl = all[all.indexOf(e.currentTarget) + 1];
    if (nextEl) nextEl.focus(); else e.currentTarget.blur();
  };

  /* Swipe left to delete */
  const rowRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x0: number; y0: number; dx: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input, button")) return;
    swipe.current = { x0: e.clientX, y0: e.clientY, dx: 0, moved: false, id: e.pointerId };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current, el = rowRef.current;
    if (!s || !el || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (!s.moved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { swipe.current = null; return; }
    if (!s.moved && Math.abs(dx) > 6) {
      s.moved = true;
      try { el.setPointerCapture(s.id); } catch { /* ignore */ }
      el.classList.add("dragging");
      el.parentElement?.classList.add("swiping");
    }
    if (s.moved) { s.dx = Math.min(0, dx); el.style.transform = `translateX(${s.dx}px)`; }
  };
  const onUp = () => {
    const s = swipe.current, el = rowRef.current;
    swipe.current = null;
    if (!s || !el || !s.moved) return;
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 60);
    el.classList.remove("dragging");
    if (s.dx < -90) { onSwipeDelete(set.key); return; }
    el.style.transform = "";
    const wrap = el.parentElement;
    window.setTimeout(() => wrap?.classList.remove("swiping"), 200);
  };

  const fmtPh = (v: number | null | undefined, kind: "w" | "r" | "t") =>
    v === null || v === undefined ? "" : kind === "w" ? fmt.weightInput(v) : kind === "t" ? durationInputValue(v) : String(v);

  return (
    <div className="row-wrap">
      <div className="row-del" aria-hidden="true">Delete</div>
      <div ref={rowRef} className={cls + (set.done ? " done" : "") + (ready ? " ready" : "")}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onClickCapture={(e) => { if (suppressClick.current) { e.stopPropagation(); e.preventDefault(); } }}>
        <button type="button" className={"setn" + (warm ? " w" : "")} onClick={() => onSetMenu(set.key)} aria-label={`Set ${label} options`}>{label}</button>
        <span className="prev">{prevText}</span>
        {cols.weight && (
          <input className={"inp" + (needW ? " need" : "")} inputMode="decimal" enterKeyHint="next" autoComplete="off"
            aria-label={`Set ${label} weight in ${fmt.unit}`} placeholder={fmtPh(ph?.weightKg, "w")} value={w}
            onKeyDown={next}
            onChange={(e) => { setW(e.target.value); const p = fmt.parseWeight(e.target.value); if (p.ok) { synced.current.weightKg = p.value; onChange(set.key, { weightKg: p.value }); } }} />
        )}
        {cols.reps && (
          <input className={"inp" + (needR ? " need" : "")} inputMode="numeric" enterKeyHint="next" autoComplete="off"
            aria-label={`Set ${label} reps`} placeholder={fmtPh(ph?.reps, "r")} value={r}
            onKeyDown={next}
            onChange={(e) => { setR(e.target.value); const p = parseRepsInput(e.target.value); if (p.ok) { synced.current.reps = p.value; onChange(set.key, { reps: p.value }); } }} />
        )}
        {cols.time && (
          <input className={"inp" + (needT ? " need" : "")} inputMode="numeric" enterKeyHint="next" autoComplete="off"
            aria-label={`Set ${label} time`} placeholder={fmtPh(ph?.durationS, "t") || "0:30"} value={t}
            onKeyDown={next}
            onChange={(e) => { setT(e.target.value); const p = parseDurationInput(e.target.value); if (p !== undefined) { synced.current.durationS = p; onChange(set.key, { durationS: p }); } }} />
        )}
        {withCheck && (
          <button type="button" className="chk" onClick={check} aria-pressed={!!set.done} aria-label={set.done ? "Mark set not done" : "Complete set"}>
            <IconCheck />
          </button>
        )}
      </div>
    </div>
  );
}
