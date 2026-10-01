import { bestE1rm, formatTime } from "@fitness/shared";
import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { deleteWorkout, saveWorkoutAsRoutine } from "@/db/actions";
import { useCatalog, useRoutines, useTraining } from "@/data/hooks";
import { SetList } from "@/features/common/SetList";
import { useStarter } from "@/features/workout/useStarter";
import { useT } from "@/i18n";
import { columnsFor } from "@/lib/labels";
import { useFormat } from "@/lib/useFormat";
import { IconBack, IconMore } from "@/ui/icons";
import { ConfirmSheet, MenuSheet, TextSheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";

export function WorkoutDetailScreen() {
  const { activityId } = useParams({ from: "/history/$activityId" });
  const router = useRouter();
  const navigate = useNavigate();
  const toast = useToast();
  const training = useTraining();
  const catalog = useCatalog();
  const routines = useRoutines();
  const fmt = useFormat();
  const t = useT();
  const h = t.history;
  const { start, element } = useStarter();
  const [sheet, setSheet] = useState<"menu" | "routine" | "delete" | null>(null);
  const w = training.byId.get(activityId);

  if (!training.loaded) return <div className="page" />;
  if (!w) return <div className="page"><div className="topbar"><button type="button" className="ib" onClick={() => router.history.back()} aria-label={t.common.back}><IconBack /></button></div><p className="muted">{h.notFound}</p></div>;
  const routine = routines?.find((r) => r.routine.id === w.activity.routineId);

  return (
    <div className="page tight">
      <div className="topbar">
        <button type="button" className="ib" onClick={() => router.history.back()} aria-label={t.common.back}><IconBack /></button>
        <button type="button" className="ib" onClick={() => setSheet("menu")} aria-label={h.options}><IconMore /></button>
      </div>
      <div>
        <h1 className="title">{w.activity.name}</h1>
        <p className="sub">{fmt.date(w.start)} · {formatTime(w.start)}–{formatTime(w.end)}</p>
        {routine && <p className="sub small" style={{ marginTop: 2 }}>{h.fromRoutine(routine.routine.name)}</p>}
      </div>
      <div className="card stats">
        <div className="stat"><span className="stat-v">{fmt.duration(w.durationMin)}</span><span className="lbl">{t.workout.duration}</span></div>
        <div className="stat"><span className="stat-v">{w.setCount}</span><span className="lbl">{t.workout.sets}</span></div>
        <div className="stat"><span className="stat-v">{w.prCount}</span><span className="lbl">{t.workout.prs}</span></div>
      </div>
      <div className="exs">
        {w.exercises.map(({ ae, sets, pr }) => {
          const ex = catalog.byId.get(ae.exerciseId);
          const cols = columnsFor(ex);
          const work = sets.filter((s) => s.setType !== "warmup");
          const best = Math.max(0, ...work.map((s) => s.weightKg ?? 0));
          const e1 = bestE1rm(sets);
          return (
            <section className="card ex" key={ae.id}>
              <div className="ex-head">
                <button type="button" onClick={() => void navigate({ to: "/exercises/$exerciseId", params: { exerciseId: ae.exerciseId } })}>
                  <h2 className="ex-name">{ex?.name ?? t.common.exercise}<span className="ex-eq">{ex ? t.equipment[ex.equipment] : ""}</span></h2>
                </button>
              </div>
              {ae.note && <p className="ex-note">{ae.note}</p>}
              <SetList sets={sets} exercise={ex} fmt={fmt} prValue={pr?.value ?? null} />
              {cols.weight && cols.reps ? (
                <div className="ex-foot"><span>{h.best} <span className="nw">{fmt.weight(best)}</span></span>{e1 !== null && <span>e1RM <span className="nw">{fmt.weight(Math.round(e1))}</span></span>}</div>
              ) : cols.reps ? <div className="ex-foot"><span>{h.bestRepsFoot(Math.max(0, ...work.map((s) => s.reps ?? 0)))}</span></div> : null}
            </section>
          );
        })}
      </div>

      {sheet === "menu" && (
        <MenuSheet title={w.activity.name} onClose={() => setSheet(null)} items={[
          { label: h.editWorkout, onSelect: () => void navigate({ to: "/history/$activityId/edit", params: { activityId } }) },
          { label: h.repeatWorkout, onSelect: () => void start({ repeatActivityId: activityId }) },
          { label: h.saveAsRoutine, onSelect: () => setSheet("routine") },
          { label: h.deleteWorkout, danger: true, onSelect: () => setSheet("delete") },
        ]} />
      )}
      {sheet === "routine" && (
        <TextSheet title={h.saveAsRoutine} initial={w.activity.name} maxLength={40} onClose={() => setSheet(null)}
          onSave={(name) => void saveWorkoutAsRoutine(activityId, name || w.activity.name).then(() => toast(h.routineSaved(name || w.activity.name)))} />
      )}
      {sheet === "delete" && (
        <ConfirmSheet title={h.deleteTitle} danger confirm={h.deleteWorkout}
          text={h.deleteText(w.activity.name, fmt.date(w.start), w.prCount > 0)}
          onClose={() => setSheet(null)}
          onConfirm={() => void deleteWorkout(activityId).then((undo) => { toast(h.deleted, undo); void navigate({ to: "/history" }); })} />
      )}
      {element}
    </div>
  );
}
