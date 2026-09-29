import { newId } from "@fitness/shared";
import { useParams, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getRoutineItems, saveRoutine, type RoutineItemInput } from "@/db/actions";
import { useCatalog, useRoutines, useTraining } from "@/data/hooks";
import { ExercisePicker } from "@/features/exercises/ExercisePicker";
import { columnsFor, EQUIPMENT_LABEL } from "@/lib/labels";
import { useFormat } from "@/lib/useFormat";
import { IconMore } from "@/ui/icons";
import { ReorderList } from "@/ui/ReorderList";
import { ConfirmSheet, MenuSheet, TextSheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";

type Item = RoutineItemInput & { key: string };

/** Routine editor: name + exercise cards with Warm-up / Sets steppers (docs/design/screens/routines.md). */
export function RoutineEditor() {
  const params = useParams({ strict: false }) as { routineId?: string };
  const isNew = !params.routineId;
  const router = useRouter();
  const toast = useToast();
  const catalog = useCatalog();
  const training = useTraining();
  const routines = useRoutines();
  const fmt = useFormat();
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[] | null>(isNew ? [] : null);
  const [dirty, setDirty] = useState(false);
  const [sheet, setSheet] = useState<{ kind: "discard" } | { kind: "menu" | "note"; key: string } | null>(null);
  const [picker, setPicker] = useState<{ mode: "multi" } | { mode: "single"; key: string } | null>(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    if (isNew || !params.routineId || !routines || items !== null) return;
    const r = routines.find((x) => x.routine.id === params.routineId);
    if (!r) return;
    setName(r.routine.name);
    void getRoutineItems(r.routine.id).then((list) => setItems(list.map((i) => ({ ...i, key: i.id ?? newId() }))));
  }, [isNew, params.routineId, routines, items]);

  if (items === null) return <div className="page no-nav" />;
  const change = (fn: (list: Item[]) => Item[]) => { setItems((l) => fn(l ?? [])); setDirty(true); };
  const valid = name.trim().length > 0 && items.length > 0;
  const save = async () => {
    if (!valid) return;
    await saveRoutine(params.routineId ?? null, name, items.map(({ key: _k, ...rest }) => rest));
    toast("Routine saved");
    router.history.back();
  };
  const lastText = (exerciseId: string) => {
    const sessions = training.sessionsByExercise.get(exerciseId);
    const s = sessions?.[sessions.length - 1];
    if (!s) return null;
    const cols = columnsFor(catalog.byId.get(exerciseId));
    const work = s.sets.filter((x) => x.setType !== "warmup");
    if (cols.weight && cols.reps && s.heaviest !== null) {
      const top = work.find((x) => x.weightKg === s.heaviest);
      return `${fmt.weight(s.heaviest)} × ${top?.reps ?? 0}`;
    }
    return s.bestReps !== null ? `${s.bestReps} reps` : null;
  };
  const menuItem = sheet && sheet.kind !== "discard" ? items.find((i) => i.key === sheet.key) : undefined;

  if (reordering) {
    return (
      <div className="page tight no-nav">
        <div className="ehead" style={{ padding: 0, margin: "-6px -8px -10px" }}>
          <span style={{ width: 60 }} /><h1>Change order</h1>
          <button type="button" className="tbtn save" onClick={() => setReordering(false)}>Done</button>
        </div>
        <ReorderList items={items.map((i) => ({ id: i.key, label: catalog.byId.get(i.exerciseId)?.name ?? "Exercise" }))}
          onChange={(keys) => change((l) => keys.map((k) => l.find((i) => i.key === k)!))} />
      </div>
    );
  }

  return (
    <div className="page tight no-nav">
      <div className="ehead" style={{ padding: 0, margin: "-6px -8px -6px" }}>
        <button type="button" className="tbtn" onClick={() => (dirty ? setSheet({ kind: "discard" }) : router.history.back())}>Cancel</button>
        <h1>{isNew ? "New routine" : "Edit routine"}</h1>
        <button type="button" className="tbtn save" disabled={!valid} onClick={() => void save()}>Save</button>
      </div>
      <div className="grp" style={{ gap: 8 }}>
        <label className="lbl" htmlFor="r-name">Name</label>
        <input id="r-name" className="field" maxLength={40} autoComplete="off" placeholder="e.g. Push Day" value={name} autoFocus={isNew}
          onChange={(e) => { setName(e.target.value); setDirty(true); }} />
      </div>
      {items.length > 0 && (
        <div className="exs">
          {items.map((i) => {
            const ex = catalog.byId.get(i.exerciseId);
            const last = lastText(i.exerciseId);
            const step = (k: "warmupSets" | "workingSets", d: number) =>
              change((l) => l.map((x) => (x.key === i.key ? { ...x, [k]: Math.min(k === "warmupSets" ? 5 : 10, Math.max(k === "warmupSets" ? 0 : 1, x[k] + d)) } : x)));
            return (
              <section key={i.key} className="card ex" style={{ padding: "16px 16px 12px", gap: 4 }}>
                <div className="ex-head">
                  <h2 className="ex-name">{ex?.name ?? "Exercise"}<span className="ex-eq">{ex ? EQUIPMENT_LABEL[ex.equipment] : ""}</span></h2>
                  <button type="button" className="ib" onClick={() => setSheet({ kind: "menu", key: i.key })} aria-label={`${ex?.name ?? "Exercise"} options`}><IconMore /></button>
                </div>
                {last && <p className="hint" style={{ marginTop: 4 }}>Last: {last}</p>}
                {i.note && <p className="ex-note" style={{ marginTop: 2 }}>{i.note}</p>}
                <div className="steps">
                  <div className="step">
                    <span className="lbl">Warm-up</span>
                    <span className="stepper">
                      <button type="button" disabled={i.warmupSets <= 0} onClick={() => step("warmupSets", -1)} aria-label="Fewer warm-up sets">−</button>
                      <b>{i.warmupSets}</b>
                      <button type="button" disabled={i.warmupSets >= 5} onClick={() => step("warmupSets", 1)} aria-label="More warm-up sets">+</button>
                    </span>
                  </div>
                  <div className="step">
                    <span className="lbl">Sets</span>
                    <span className="stepper">
                      <button type="button" disabled={i.workingSets <= 1} onClick={() => step("workingSets", -1)} aria-label="Fewer sets">−</button>
                      <b>{i.workingSets}</b>
                      <button type="button" disabled={i.workingSets >= 10} onClick={() => step("workingSets", 1)} aria-label="More sets">+</button>
                    </span>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
      <button type="button" className="btn btn-block" onClick={() => setPicker({ mode: "multi" })}>Add exercise</button>

      {picker && (
        <ExercisePicker mode={picker.mode} onClose={() => setPicker(null)} onDone={(ids) => {
          setPicker(null);
          if (picker.mode === "multi") change((l) => [...l, ...ids.map((id) => ({ key: newId(), exerciseId: id, warmupSets: 0, workingSets: 3, note: "" }))]);
          else if (ids[0]) change((l) => l.map((x) => (x.key === picker.key ? { ...x, exerciseId: ids[0]! } : x)));
        }} />
      )}
      {sheet?.kind === "discard" && (
        <ConfirmSheet title="Discard changes?" text="Your edits will be lost." confirm="Discard" cancel="Keep editing" danger onConfirm={() => router.history.back()} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "menu" && menuItem && (
        <MenuSheet title={catalog.byId.get(menuItem.exerciseId)?.name ?? "Exercise"} onClose={() => setSheet(null)} items={[
          { label: "Note", onSelect: () => setSheet({ kind: "note", key: menuItem.key }) },
          { label: "Replace exercise", onSelect: () => setPicker({ mode: "single", key: menuItem.key }) },
          { label: "Reorder exercises", onSelect: () => setReordering(true) },
          { label: "Remove exercise", danger: true, onSelect: () => change((l) => l.filter((x) => x.key !== menuItem.key)) },
        ]} />
      )}
      {sheet?.kind === "note" && menuItem && (
        <TextSheet title="Note" initial={menuItem.note} maxLength={120} placeholder="e.g. Seat 4, grip wide" onClose={() => setSheet(null)}
          onSave={(v) => change((l) => l.map((x) => (x.key === menuItem.key ? { ...x, note: v } : x)))} />
      )}
    </div>
  );
}
