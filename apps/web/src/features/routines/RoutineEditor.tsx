import { newId } from "@fitness/shared";
import { useParams, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getRoutineItems, saveRoutine, type RoutineItemInput } from "@/db/actions";
import { useCatalog, useRoutines, useTraining } from "@/data/hooks";
import { ExercisePicker } from "@/features/exercises/ExercisePicker";
import { useT } from "@/i18n";
import { columnsFor } from "@/lib/labels";
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
  const t = useT();
  const r9 = t.routines;
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
    toast(r9.saved);
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
    return s.bestReps !== null ? t.common.reps(s.bestReps) : null;
  };
  const menuItem = sheet && sheet.kind !== "discard" ? items.find((i) => i.key === sheet.key) : undefined;

  if (reordering) {
    return (
      <div className="page tight no-nav">
        <div className="ehead" style={{ padding: 0, margin: "-6px -8px -10px" }}>
          <span style={{ width: 60 }} /><h1>{r9.changeOrder}</h1>
          <button type="button" className="tbtn save" onClick={() => setReordering(false)}>{t.common.done}</button>
        </div>
        <ReorderList items={items.map((i) => ({ id: i.key, label: catalog.byId.get(i.exerciseId)?.name ?? t.common.exercise }))}
          onChange={(keys) => change((l) => keys.map((k) => l.find((i) => i.key === k)!))} />
      </div>
    );
  }

  return (
    <div className="page tight no-nav">
      <div className="ehead" style={{ padding: 0, margin: "-6px -8px -6px" }}>
        <button type="button" className="tbtn" onClick={() => (dirty ? setSheet({ kind: "discard" }) : router.history.back())}>{t.common.cancel}</button>
        <h1>{isNew ? r9.newRoutine : r9.editRoutine}</h1>
        <button type="button" className="tbtn save" disabled={!valid} onClick={() => void save()}>{t.common.save}</button>
      </div>
      <div className="grp" style={{ gap: 8 }}>
        <label className="lbl" htmlFor="r-name">{t.common.name}</label>
        <input id="r-name" className="field" maxLength={40} autoComplete="off" placeholder={r9.namePlaceholder} value={name} autoFocus={isNew}
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
                  <h2 className="ex-name">{ex?.name ?? t.common.exercise}<span className="ex-eq">{ex ? t.equipment[ex.equipment] : ""}</span></h2>
                  <button type="button" className="ib" onClick={() => setSheet({ kind: "menu", key: i.key })} aria-label={r9.options(ex?.name ?? t.common.exercise)}><IconMore /></button>
                </div>
                {last && <p className="hint" style={{ marginTop: 4 }}>{r9.lastSession(last)}</p>}
                {i.note && <p className="ex-note" style={{ marginTop: 2 }}>{i.note}</p>}
                <div className="steps">
                  <div className="step">
                    <span className="lbl">{r9.warmup}</span>
                    <span className="stepper">
                      <button type="button" disabled={i.warmupSets <= 0} onClick={() => step("warmupSets", -1)} aria-label={r9.fewerWarmups}>−</button>
                      <b>{i.warmupSets}</b>
                      <button type="button" disabled={i.warmupSets >= 5} onClick={() => step("warmupSets", 1)} aria-label={r9.moreWarmups}>+</button>
                    </span>
                  </div>
                  <div className="step">
                    <span className="lbl">{r9.sets}</span>
                    <span className="stepper">
                      <button type="button" disabled={i.workingSets <= 1} onClick={() => step("workingSets", -1)} aria-label={r9.fewerSets}>−</button>
                      <b>{i.workingSets}</b>
                      <button type="button" disabled={i.workingSets >= 10} onClick={() => step("workingSets", 1)} aria-label={r9.moreSets}>+</button>
                    </span>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
      <button type="button" className="btn btn-block" onClick={() => setPicker({ mode: "multi" })}>{r9.addExercise}</button>

      {picker && (
        <ExercisePicker mode={picker.mode} onClose={() => setPicker(null)} onDone={(ids) => {
          setPicker(null);
          if (picker.mode === "multi") change((l) => [...l, ...ids.map((id) => ({ key: newId(), exerciseId: id, warmupSets: 0, workingSets: 3, note: "" }))]);
          else if (ids[0]) change((l) => l.map((x) => (x.key === picker.key ? { ...x, exerciseId: ids[0]! } : x)));
        }} />
      )}
      {sheet?.kind === "discard" && (
        <ConfirmSheet title={t.common.discardChanges} text={r9.editsLost} confirm={t.common.discard} cancel={t.common.keepEditing} danger onConfirm={() => router.history.back()} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "menu" && menuItem && (
        <MenuSheet title={catalog.byId.get(menuItem.exerciseId)?.name ?? t.common.exercise} onClose={() => setSheet(null)} items={[
          { label: r9.note, onSelect: () => setSheet({ kind: "note", key: menuItem.key }) },
          { label: r9.replaceExercise, onSelect: () => setPicker({ mode: "single", key: menuItem.key }) },
          { label: r9.reorderExercises, onSelect: () => setReordering(true) },
          { label: r9.removeExercise, danger: true, onSelect: () => change((l) => l.filter((x) => x.key !== menuItem.key)) },
        ]} />
      )}
      {sheet?.kind === "note" && menuItem && (
        <TextSheet title={r9.note} initial={menuItem.note} maxLength={120} placeholder={r9.notePlaceholder} onClose={() => setSheet(null)}
          onSave={(v) => change((l) => l.map((x) => (x.key === menuItem.key ? { ...x, note: v } : x)))} />
      )}
    </div>
  );
}
