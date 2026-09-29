import { bestE1rm, formatDuration, formatTime } from "@fitness/shared";
import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { deleteWorkout, saveWorkoutAsRoutine } from "@/db/actions";
import { useCatalog, useRoutines, useTraining } from "@/data/hooks";
import { SetList } from "@/features/common/SetList";
import { useStarter } from "@/features/workout/useStarter";
import { columnsFor, EQUIPMENT_LABEL } from "@/lib/labels";
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
  const { start, element } = useStarter();
  const [sheet, setSheet] = useState<"menu" | "routine" | "delete" | null>(null);
  const w = training.byId.get(activityId);

  if (!training.loaded) return <div className="page" />;
  if (!w) return <div className="page"><div className="topbar"><button type="button" className="ib" onClick={() => router.history.back()} aria-label="Back"><IconBack /></button></div><p className="muted">Workout not found.</p></div>;
  const routine = routines?.find((r) => r.routine.id === w.activity.routineId);

  return (
    <div className="page tight">
      <div className="topbar">
        <button type="button" className="ib" onClick={() => router.history.back()} aria-label="Back"><IconBack /></button>
        <button type="button" className="ib" onClick={() => setSheet("menu")} aria-label="Workout options"><IconMore /></button>
      </div>
      <div>
        <h1 className="title">{w.activity.name}</h1>
        <p className="sub">{fmt.date(w.start)} · {formatTime(w.start)}–{formatTime(w.end)}</p>
        {routine && <p className="sub small" style={{ marginTop: 2 }}>From {routine.routine.name} routine</p>}
      </div>
      <div className="card stats">
        <div className="stat"><span className="stat-v">{formatDuration(w.durationMin)}</span><span className="lbl">Duration</span></div>
        <div className="stat"><span className="stat-v">{w.setCount}</span><span className="lbl">Sets</span></div>
        <div className="stat"><span className="stat-v">{w.prCount}</span><span className="lbl">PRs</span></div>
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
                  <h2 className="ex-name">{ex?.name ?? "Exercise"}<span className="ex-eq">{ex ? EQUIPMENT_LABEL[ex.equipment] : ""}</span></h2>
                </button>
              </div>
              {ae.note && <p className="ex-note">{ae.note}</p>}
              <SetList sets={sets} exercise={ex} fmt={fmt} prValue={pr?.value ?? null} />
              {cols.weight && cols.reps ? (
                <div className="ex-foot"><span>Best <span className="nw">{fmt.weight(best)}</span></span>{e1 !== null && <span>e1RM <span className="nw">{fmt.weight(Math.round(e1))}</span></span>}</div>
              ) : cols.reps ? <div className="ex-foot"><span>Best {Math.max(0, ...work.map((s) => s.reps ?? 0))} reps</span></div> : null}
            </section>
          );
        })}
      </div>

      {sheet === "menu" && (
        <MenuSheet title={w.activity.name} onClose={() => setSheet(null)} items={[
          { label: "Edit workout", onSelect: () => void navigate({ to: "/history/$activityId/edit", params: { activityId } }) },
          { label: "Repeat workout", onSelect: () => void start({ repeatActivityId: activityId }) },
          { label: "Save as routine", onSelect: () => setSheet("routine") },
          { label: "Delete workout", danger: true, onSelect: () => setSheet("delete") },
        ]} />
      )}
      {sheet === "routine" && (
        <TextSheet title="Save as routine" initial={w.activity.name} maxLength={40} onClose={() => setSheet(null)}
          onSave={(name) => void saveWorkoutAsRoutine(activityId, name || w.activity.name).then(() => toast(`Routine "${name || w.activity.name}" saved`))} />
      )}
      {sheet === "delete" && (
        <ConfirmSheet title="Delete this workout?" danger confirm="Delete workout"
          text={`${w.activity.name}, ${fmt.date(w.start)}.${w.prCount ? " Its PRs will be removed." : ""}`}
          onClose={() => setSheet(null)}
          onConfirm={() => void deleteWorkout(activityId).then((undo) => { toast("Workout deleted", undo); void navigate({ to: "/history" }); })} />
      )}
      {element}
    </div>
  );
}
