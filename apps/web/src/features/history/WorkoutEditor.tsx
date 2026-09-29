import { newId, workoutNameForTime, type SetType } from "@fitness/shared";
import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getRoutineItems, lastSessionSets, loadDraft, saveDraft, type WorkoutDraft } from "@/db/actions";
import { useCatalog, useRoutines, useSettings, useTraining } from "@/data/hooks";
import { ExercisePicker } from "@/features/exercises/ExercisePicker";
import { placeholders, SetTable } from "@/features/workout/SetTable";
import { columnsFor, EQUIPMENT_LABEL } from "@/lib/labels";
import { useFormat } from "@/lib/useFormat";
import { IconMore } from "@/ui/icons";
import { ReorderList } from "@/ui/ReorderList";
import { ConfirmSheet, MenuSheet, TextSheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";

interface ESet { key: string; id: string | null; setType: SetType; weightKg: number | null; reps: number | null; durationS: number | null }
interface EEx { key: string; id: string | null; exerciseId: string; note: string; sets: ESet[] }
interface Draft { activityId: string | null; name: string; routineId: string | null; startedAt: Date; durationMin: number; exercises: EEx[] }

const toLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const toLocalTime = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const blankSet = (setType: SetType = "normal"): ESet => ({ key: newId(), id: null, setType, weightKg: null, reps: null, durationS: null });

function fromWorkoutDraft(d: WorkoutDraft): Draft {
  return { ...d, exercises: d.exercises.map((e) => ({ key: e.id ?? newId(), ...e, sets: e.sets.map((s) => ({ key: s.id ?? newId(), ...s })) })) };
}

function newDraft(): Draft {
  const t = new Date(Date.now() - 60 * 60000);
  t.setMinutes(Math.floor(t.getMinutes() / 5) * 5, 0, 0);
  return { activityId: null, name: workoutNameForTime(t), routineId: null, startedAt: t, durationMin: 60, exercises: [] };
}

/** Edit mode and "Log past workout" (docs/design/screens/history.md). Same set table as logging, without ✓. */
export function WorkoutEditor() {
  const params = useParams({ strict: false }) as { activityId?: string };
  const isNew = !params.activityId;
  const router = useRouter();
  const navigate = useNavigate();
  const toast = useToast();
  const catalog = useCatalog();
  const training = useTraining();
  const routines = useRoutines();
  const settings = useSettings();
  const fmt = useFormat();
  const [draft, setDraft] = useState<Draft | null>(isNew ? newDraft() : null);
  const [dirty, setDirty] = useState(false);
  const [from, setFrom] = useState<string>("");
  const [need, setNeed] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<{ kind: "discard" } | { kind: "exmenu"; key: string } | { kind: "setmenu"; ex: string; set: string } | { kind: "note"; key: string } | null>(null);
  const [picker, setPicker] = useState<{ mode: "multi" } | { mode: "single"; key: string } | null>(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    if (!isNew && params.activityId) void loadDraft(params.activityId).then((d) => setDraft(d ? fromWorkoutDraft(d) : null));
  }, [isNew, params.activityId]);

  if (!draft) return <div className="page no-nav" />;
  const edit = (fn: (d: Draft) => Draft) => { setDraft((d) => (d ? fn(d) : d)); setDirty(true); };
  const editEx = (key: string, fn: (e: EEx) => EEx) => edit((d) => ({ ...d, exercises: d.exercises.map((e) => (e.key === key ? fn(e) : e)) }));

  const prevFor = (exerciseId: string) => {
    const list = (training.sessionsByExercise.get(exerciseId) ?? []).filter((s) => s.date < draft.startedAt && s.activityId !== draft.activityId);
    return list[list.length - 1]?.sets;
  };

  const startFrom = async (routineId: string) => {
    setFrom(routineId);
    if (!routineId) { edit((d) => ({ ...d, routineId: null, name: workoutNameForTime(d.startedAt), exercises: [] })); return; }
    const items = await getRoutineItems(routineId);
    const r = routines?.find((x) => x.routine.id === routineId);
    edit((d) => ({
      ...d, routineId, name: r?.routine.name ?? d.name,
      exercises: items.map((i) => ({ key: newId(), id: null, exerciseId: i.exerciseId, note: i.note, sets: [...Array.from({ length: i.warmupSets }, () => blankSet("warmup")), ...Array.from({ length: i.workingSets }, () => blankSet())] })),
    }));
  };

  const addExercises = async (ids: string[]) => {
    const added: EEx[] = [];
    for (const id of ids) {
      const last = await lastSessionSets(id);
      const types: SetType[] = last.length ? last.map((s) => s.setType) : Array.from({ length: settings.defaultSets }, () => "normal");
      added.push({ key: newId(), id: null, exerciseId: id, note: "", sets: types.map((t) => blankSet(t)) });
    }
    edit((d) => ({ ...d, exercises: [...d.exercises, ...added] }));
  };

  const save = async () => {
    const badKeys = new Set<string>();
    let bad = draft.durationMin < 1 || draft.durationMin > 720 || draft.startedAt.getTime() > Date.now();
    const exercises = draft.exercises.map((e) => {
      const cols = columnsFor(catalog.byId.get(e.exerciseId));
      const info = placeholders(e.sets, prevFor(e.exerciseId));
      return {
        ...e,
        sets: e.sets.map((s, i) => {
          const ph = info[i]!.ph;
          const filled = { ...s, weightKg: s.weightKg ?? ph?.weightKg ?? null, reps: s.reps ?? ph?.reps ?? null, durationS: s.durationS ?? ph?.durationS ?? null };
          if ((cols.weight && filled.weightKg === null) || (cols.reps && filled.reps === null) || (cols.time && filled.durationS === null)) { badKeys.add(s.key); bad = true; }
          return filled;
        }),
      };
    });
    if (bad) {
      setNeed(badKeys);
      toast(draft.startedAt.getTime() > Date.now() ? "The date can't be in the future" : draft.durationMin < 1 || draft.durationMin > 720 ? "Duration must be 1 min to 12 h" : "Fill in the highlighted fields");
      window.setTimeout(() => setNeed(new Set()), 1500);
      return;
    }
    const id = await saveDraft({ ...draft, exercises: exercises.map((e) => ({ id: e.id, exerciseId: e.exerciseId, note: e.note, sets: e.sets.map((s) => ({ id: s.id, setType: s.setType, weightKg: s.weightKg, reps: s.reps, durationS: s.durationS })) })) });
    toast("Saved");
    if (isNew) void navigate({ to: "/history/$activityId", params: { activityId: id }, replace: true });
    else router.history.back();
  };
  const cancel = () => (dirty ? setSheet({ kind: "discard" }) : router.history.back());

  const menuEx = sheet?.kind === "exmenu" ? draft.exercises.find((e) => e.key === sheet.key) : undefined;
  const noteEx = sheet?.kind === "note" ? draft.exercises.find((e) => e.key === sheet.key) : undefined;
  const setMenu = sheet?.kind === "setmenu" ? draft.exercises.find((e) => e.key === sheet.ex)?.sets.find((s) => s.key === sheet.set) : undefined;
  const h = Math.floor(draft.durationMin / 60), m = draft.durationMin % 60;

  if (reordering) {
    return (
      <div className="page tight no-nav">
        <div className="ehead" style={{ padding: 0, margin: "-6px -8px -10px" }}>
          <span style={{ width: 60 }} /><h1>Change order</h1>
          <button type="button" className="tbtn save" onClick={() => setReordering(false)}>Done</button>
        </div>
        <ReorderList items={draft.exercises.map((e) => ({ id: e.key, label: catalog.byId.get(e.exerciseId)?.name ?? "Exercise" }))}
          onChange={(keys) => edit((d) => ({ ...d, exercises: keys.map((k) => d.exercises.find((e) => e.key === k)!) }))} />
      </div>
    );
  }

  return (
    <div className="page tight no-nav">
      <div className="ehead" style={{ padding: 0, margin: "-6px -8px -6px" }}>
        <button type="button" className="tbtn" onClick={cancel}>Cancel</button>
        <h1>{isNew ? "Log past workout" : "Edit workout"}</h1>
        <button type="button" className="tbtn save" onClick={() => void save()}>Save</button>
      </div>

      {isNew && (
        <div className="grp">
          <span className="lbl">Start from</span>
          <div className="chips scroll-x">
            <button type="button" className="chip" aria-pressed={from === ""} onClick={() => void startFrom("")}>Empty</button>
            {(routines ?? []).map((r) => <button key={r.routine.id} type="button" className="chip" aria-pressed={from === r.routine.id} onClick={() => void startFrom(r.routine.id)}>{r.routine.name}</button>)}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
        <div className="grp" style={{ gap: 6 }}>
          <label className="lbl" htmlFor="w-name">Name</label>
          <input id="w-name" className="field" maxLength={40} value={draft.name} onChange={(e) => edit((d) => ({ ...d, name: e.target.value }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="grp" style={{ gap: 6 }}>
            <label className="lbl" htmlFor="w-date">Date</label>
            <input id="w-date" className="field" type="date" max={toLocalDate(new Date())} value={toLocalDate(draft.startedAt)}
              onChange={(e) => { if (!e.target.value) return; const [y, mo, da] = e.target.value.split("-").map(Number); edit((d) => ({ ...d, startedAt: new Date(y!, mo! - 1, da!, d.startedAt.getHours(), d.startedAt.getMinutes()) })); }} />
          </div>
          <div className="grp" style={{ gap: 6 }}>
            <label className="lbl" htmlFor="w-time">Start time</label>
            <input id="w-time" className="field" type="time" value={toLocalTime(draft.startedAt)}
              onChange={(e) => { if (!e.target.value) return; const [hh, mm] = e.target.value.split(":").map(Number); edit((d) => { const s = new Date(d.startedAt); s.setHours(hh!, mm!, 0, 0); return { ...d, startedAt: s }; }); }} />
          </div>
        </div>
        <div className="grp" style={{ gap: 6 }}>
          <span className="lbl" id="w-dur">Duration</span>
          <div role="group" aria-labelledby="w-dur" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="field" inputMode="numeric" aria-label="Hours" style={{ width: 70, textAlign: "center" }} value={h}
              onChange={(e) => { const v = parseInt(e.target.value, 10) || 0; edit((d) => ({ ...d, durationMin: v * 60 + (d.durationMin % 60) })); }} />
            <span className="muted">h</span>
            <input className="field" inputMode="numeric" aria-label="Minutes" style={{ width: 70, textAlign: "center" }} value={m}
              onChange={(e) => { const v = Math.min(59, parseInt(e.target.value, 10) || 0); edit((d) => ({ ...d, durationMin: Math.floor(d.durationMin / 60) * 60 + v })); }} />
            <span className="muted">min</span>
          </div>
        </div>
      </div>

      <div className="exs">
        {draft.exercises.map((e) => {
          const ex = catalog.byId.get(e.exerciseId);
          return (
            <section key={e.key} className="card live">
              <div className="ex-head">
                <div>
                  <h2 className="ex-name">{ex?.name ?? "Exercise"}<span className="ex-eq">{ex ? EQUIPMENT_LABEL[ex.equipment] : ""}</span></h2>
                  {e.note && <p className="ex-note">{e.note}</p>}
                </div>
                <button type="button" className="ib" onClick={() => setSheet({ kind: "exmenu", key: e.key })} aria-label={`${ex?.name ?? "Exercise"} options`}><IconMore /></button>
              </div>
                <SetTable exercise={ex} sets={e.sets} prev={prevFor(e.exerciseId)} fmt={fmt} withCheck={false}
                  onChange={(key, ch) => editEx(e.key, (x) => ({ ...x, sets: x.sets.map((s) => (s.key === key ? { ...s, ...ch } : s)) }))}
                  onSetMenu={(key) => setSheet({ kind: "setmenu", ex: e.key, set: key })}
                  onSwipeDelete={(key) => editEx(e.key, (x) => ({ ...x, sets: x.sets.filter((s) => s.key !== key) }))} need={need} />
              <button type="button" className="ghost" onClick={() => editEx(e.key, (x) => ({ ...x, sets: [...x.sets, blankSet()] }))} style={{ justifySelf: "start", paddingLeft: 4 }}>+ Add set</button>
            </section>
          );
        })}
        <button type="button" className="btn btn-block" onClick={() => setPicker({ mode: "multi" })}>Add exercise</button>
      </div>

      {picker && (
        <ExercisePicker mode={picker.mode} onClose={() => setPicker(null)} onDone={(ids) => {
          setPicker(null);
          if (picker.mode === "multi") void addExercises(ids);
          else if (ids[0]) editEx(picker.key, (x) => ({ ...x, exerciseId: ids[0]! }));
        }} />
      )}
      {sheet?.kind === "discard" && (
        <ConfirmSheet title="Discard changes?" text="Your edits will be lost." confirm="Discard" cancel="Keep editing" danger onConfirm={() => router.history.back()} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "exmenu" && menuEx && (
        <MenuSheet title={catalog.byId.get(menuEx.exerciseId)?.name ?? "Exercise"} onClose={() => setSheet(null)} items={[
          { label: "Replace exercise", onSelect: () => setPicker({ mode: "single", key: menuEx.key }) },
          { label: "Note", onSelect: () => setSheet({ kind: "note", key: menuEx.key }) },
          { label: "Reorder exercises", onSelect: () => setReordering(true) },
          { label: "Remove exercise", danger: true, onSelect: () => edit((d) => ({ ...d, exercises: d.exercises.filter((x) => x.key !== menuEx.key) })) },
        ]} />
      )}
      {sheet?.kind === "note" && noteEx && (
        <TextSheet title="Note" initial={noteEx.note} maxLength={120} placeholder="e.g. Seat position 4" onClose={() => setSheet(null)}
          onSave={(v) => editEx(noteEx.key, (x) => ({ ...x, note: v }))} />
      )}
      {sheet?.kind === "setmenu" && setMenu && (
        <MenuSheet title="Set" onClose={() => setSheet(null)} items={[
          ...(["warmup", "normal"] as SetType[]).map((t) => ({ label: t === "warmup" ? "Warm-up" : "Normal", checked: setMenu.setType === t,
            onSelect: () => editEx(sheet.ex, (x) => ({ ...x, sets: x.sets.map((s) => (s.key === setMenu.key ? { ...s, setType: t } : s)) })) })),
          { label: "Delete set", danger: true, onSelect: () => editEx(sheet.ex, (x) => ({ ...x, sets: x.sets.filter((s) => s.key !== setMenu.key) })) },
        ]} />
      )}
    </div>
  );
}

