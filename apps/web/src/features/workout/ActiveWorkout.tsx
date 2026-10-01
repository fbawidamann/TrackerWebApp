import { formatClock, type SetType } from "@fitness/shared";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  addExercises, addSet, deleteSet, discardWorkout, finishWorkout, removeActivityExercise, renameActivity, reorder,
  replaceExercise, setExerciseNote, startRest, stopRest, updateSet,
} from "@/db/actions";
import { useCatalog, useDeviceSettings, useRest, useSettings, useTraining, type ActiveWorkout as AW } from "@/data/hooks";
import { ExercisePicker } from "@/features/exercises/ExercisePicker";
import { syncNow } from "@/sync/engine";
import { useT } from "@/i18n";
import { useNow, useWakeLock, vibrate } from "@/lib/time";
import { useFormat } from "@/lib/useFormat";
import { IconMore } from "@/ui/icons";
import { ReorderList } from "@/ui/ReorderList";
import { ConfirmSheet, MenuSheet, TextSheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";
import { RestPill } from "./RestPill";
import { SetTable, type TableSet } from "./SetTable";

type SheetState =
  | { kind: "rename" } | { kind: "wmenu" } | { kind: "exmenu"; aeId: string } | { kind: "setmenu"; setId: string }
  | { kind: "note"; aeId: string } | { kind: "remove"; aeId: string; done: number } | { kind: "discard" }
  | { kind: "finish-open"; open: number } | { kind: "finish-empty" } | null;

export function ActiveWorkout({ workout }: { workout: AW }) {
  const navigate = useNavigate();
  const toast = useToast();
  const settings = useSettings();
  const device = useDeviceSettings();
  const catalog = useCatalog();
  const training = useTraining();
  const rest = useRest();
  const fmt = useFormat();
  const t = useT();
  const w = t.workout;
  const now = useNow(1000);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [picker, setPicker] = useState<{ mode: "multi" } | { mode: "single"; aeId: string } | null>(null);
  const [reordering, setReordering] = useState(false);
  useWakeLock(device.keepScreenOn);

  const { activity, exercises } = workout;
  const allSets = exercises.flatMap((e) => e.sets);
  const lastCompleted = useMemo(() => [...allSets].filter((s) => s.completedAt).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0], [allSets]);

  const complete = async (setId: string, filled: { weightKg: number | null; reps: number | null; durationS: number | null } | null) => {
    if (!filled) { await updateSet(setId, { completedAt: null }); return; }
    await updateSet(setId, { ...filled, completedAt: new Date().toISOString() });
    vibrate(device.vibrateOnComplete);
    if (settings.restTimerEnabled && settings.restAutostart) await startRest(settings.restSeconds);
  };

  const finish = () => {
    const done = allSets.filter((s) => s.completedAt).length;
    if (!done) setSheet({ kind: "finish-empty" });
    else if (done < allSets.length) setSheet({ kind: "finish-open", open: allSets.length - done });
    else void doFinish();
  };
  const doFinish = async () => {
    await finishWorkout(activity.id);
    void syncNow();
    void navigate({ to: "/workout/done/$activityId", params: { activityId: activity.id } });
  };

  const setMenuSet = sheet?.kind === "setmenu" ? allSets.find((s) => s.id === sheet.setId) : undefined;
  const menuEx = sheet?.kind === "exmenu" ? exercises.find((e) => e.ae.id === sheet.aeId) : undefined;
  const noteEx = sheet?.kind === "note" ? exercises.find((e) => e.ae.id === sheet.aeId) : undefined;

  if (reordering) {
    return (
      <div className="page tight no-nav">
        <div className="topbar" style={{ margin: "-6px 0 -10px" }}>
          <div><h1 className="title">{w.reorder}</h1><p className="sub">{w.dragHandles}</p></div>
          <button type="button" className="btn btn-primary" onClick={() => setReordering(false)}>{t.common.done}</button>
        </div>
        <ReorderList
          items={exercises.map((e) => {
            const ex = catalog.byId.get(e.ae.exerciseId);
            return { id: e.ae.id, label: <>{ex?.name ?? t.common.exercise} <span className="muted small" style={{ fontWeight: 400 }}>{ex ? t.equipment[ex.equipment] : ""}</span></> };
          })}
          onChange={(ids) => void reorder("activityExercises", ids)} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar" style={{ margin: "-6px 0 -10px", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <button type="button" onClick={() => setSheet({ kind: "rename" })} aria-label={w.renameWorkout} style={{ display: "block", textAlign: "left" }}>
            <h1 className="title">{activity.name}</h1>
          </button>
          <p className="sub">{formatClock((now - new Date(activity.startedAt).getTime()) / 1000)}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 2 }}>
          <button type="button" className="btn btn-primary" onClick={finish}>{w.finish}</button>
          <button type="button" className="ib" onClick={() => setSheet({ kind: "wmenu" })} aria-label={w.options}><IconMore /></button>
        </div>
      </div>

      {exercises.length ? (
        <div className="exs">
          {exercises.map(({ ae, sets }) => {
            const ex = catalog.byId.get(ae.exerciseId);
            const prevSessions = training.sessionsByExercise.get(ae.exerciseId);
            const prev = prevSessions?.[prevSessions.length - 1]?.sets;
            const tableSets: TableSet[] = sets.map((s) => ({ key: s.id, setType: s.setType, weightKg: s.weightKg, reps: s.reps, durationS: s.durationS, done: s.completedAt !== null }));
            return (
              <section key={ae.id} className="card live" aria-label={ex?.name}>
                <div className="ex-head">
                  <div>
                    <h2 className="ex-name">{ex?.name ?? t.common.exercise}<span className="ex-eq">{ex ? t.equipment[ex.equipment] : ""}</span></h2>
                    {ae.note && <p className="ex-note">{ae.note}</p>}
                  </div>
                  <button type="button" className="ib" onClick={() => setSheet({ kind: "exmenu", aeId: ae.id })} aria-label={w.exerciseOptions(ex?.name ?? t.common.exercise)}><IconMore /></button>
                </div>
                <SetTable exercise={ex} sets={tableSets} prev={prev} fmt={fmt} withCheck
                  onChange={(id, ch) => void updateSet(id, ch)}
                  onCheck={(id, filled) => void complete(id, filled)}
                  onSetMenu={(id) => setSheet({ kind: "setmenu", setId: id })}
                  onSwipeDelete={(id) => void deleteSet(id).then((undo) => toast(w.setDeleted, undo))}
                  afterRow={(id) => settings.restTimerEnabled && !settings.restAutostart && !rest && lastCompleted?.id === id
                    ? <button type="button" className="start-rest" onClick={() => void startRest(settings.restSeconds)}>{w.startRest}</button> : null} />
                <button type="button" className="ghost" onClick={() => void addSet(ae.id)} style={{ justifySelf: "start", paddingLeft: 4 }}>{w.addSet}</button>
              </section>
            );
          })}
          <button type="button" className="btn btn-block" onClick={() => setPicker({ mode: "multi" })}>{w.addExercise}</button>
        </div>
      ) : (
        <div className="card empty" style={{ justifyItems: "stretch", textAlign: "center" }}>
          <p>{w.addFirst}</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setPicker({ mode: "multi" })}>{w.addExercise}</button>
        </div>
      )}

      {rest && settings.restTimerEnabled && <RestPill rest={rest} />}

      {picker && (
        <ExercisePicker mode={picker.mode} onClose={() => setPicker(null)}
          onDone={(ids) => {
            setPicker(null);
            if (picker.mode === "multi") void addExercises(activity.id, ids);
            else if (ids[0]) void replaceExercise(picker.aeId, ids[0]);
          }} />
      )}

      {sheet?.kind === "rename" && <TextSheet title={w.workoutName} initial={activity.name} maxLength={40} onSave={(v) => void renameActivity(activity.id, v)} onClose={() => setSheet(null)} />}
      {sheet?.kind === "wmenu" && (
        <MenuSheet title={w.workout} onClose={() => setSheet(null)} items={[
          { label: w.reorderExercises, onSelect: () => setReordering(true) },
          { label: w.discardWorkout, danger: true, onSelect: () => setSheet({ kind: "discard" }) },
        ]} />
      )}
      {sheet?.kind === "exmenu" && menuEx && (
        <MenuSheet title={catalog.byId.get(menuEx.ae.exerciseId)?.name ?? t.common.exercise} onClose={() => setSheet(null)} items={[
          { label: w.replaceExercise, onSelect: () => setPicker({ mode: "single", aeId: menuEx.ae.id }) },
          { label: w.note, onSelect: () => setSheet({ kind: "note", aeId: menuEx.ae.id }) },
          { label: w.reorderExercises, onSelect: () => setReordering(true) },
          { label: w.removeExercise, danger: true, onSelect: () => {
            const done = menuEx.sets.filter((s) => s.completedAt).length;
            if (done) setSheet({ kind: "remove", aeId: menuEx.ae.id, done });
            else void removeActivityExercise(menuEx.ae.id).then((undo) => toast(w.exerciseRemoved, undo));
          } },
        ]} />
      )}
      {sheet?.kind === "setmenu" && setMenuSet && (
        <MenuSheet title={w.set} onClose={() => setSheet(null)} items={[
          ...(["warmup", "normal"] as SetType[]).map((st) => ({ label: st === "warmup" ? w.warmup : w.normal, checked: setMenuSet.setType === st, onSelect: () => void updateSet(setMenuSet.id, { setType: st }) })),
          { label: w.deleteSet, danger: true, onSelect: () => void deleteSet(setMenuSet.id).then((undo) => toast(w.setDeleted, undo)) },
        ]} />
      )}
      {sheet?.kind === "note" && noteEx && (
        <TextSheet title={w.noteTitle(catalog.byId.get(noteEx.ae.exerciseId)?.name ?? "")} initial={noteEx.ae.note} maxLength={120} placeholder={w.notePlaceholder}
          onSave={(v) => void setExerciseNote(noteEx.ae.id, v)} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "remove" && (
        <ConfirmSheet title={w.removeTitle(catalog.byId.get(exercises.find((e) => e.ae.id === sheet.aeId)?.ae.exerciseId ?? "")?.name ?? w.removeFallback)}
          text={w.removeText(sheet.done)} confirm={w.remove} danger
          onConfirm={() => void removeActivityExercise(sheet.aeId).then((undo) => toast(w.exerciseRemoved, undo))} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "discard" && (
        <ConfirmSheet title={w.discardTitle} text={w.discardText} confirm={w.discardWorkout} cancel={w.keepLogging} danger
          onConfirm={() => void discardWorkout(activity.id).then(() => { toast(w.discarded); void navigate({ to: "/" }); })} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "finish-open" && (
        <ConfirmSheet title={w.finishOpenTitle(sheet.open)} text={w.finishOpenText} confirm={w.discardAndFinish} cancel={w.keepLogging}
          onConfirm={() => void doFinish()} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "finish-empty" && (
        <ConfirmSheet title={w.nothingLogged} text={w.nothingLoggedText} confirm={w.discardWorkout} cancel={w.keepLogging} danger
          onConfirm={() => void discardWorkout(activity.id).then(() => { void stopRest(); void navigate({ to: "/" }); })} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}
