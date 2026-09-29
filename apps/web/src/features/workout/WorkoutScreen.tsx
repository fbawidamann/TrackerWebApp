import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { lastDoneByRoutine, useActiveWorkout, useRoutines, useTraining, type RoutineView } from "@/data/hooks";
import { RoutinePreview } from "@/features/routines/RoutinePreview";
import { StarterRoutines } from "@/features/routines/StarterRoutines";
import { useFormat } from "@/lib/useFormat";
import { IconChevron } from "@/ui/icons";
import { ActiveWorkout } from "./ActiveWorkout";
import { useStarter } from "./useStarter";

export function WorkoutScreen() {
  const active = useActiveWorkout();
  if (active === undefined) return <div className="page" />;
  return active ? <ActiveWorkout workout={active} /> : <IdleWorkout />;
}

/** Workout tab with no workout running: Start + routines + Manage (docs/design/screens/routines.md). */
function IdleWorkout() {
  const routines = useRoutines();
  const training = useTraining();
  const fmt = useFormat();
  const { start, element } = useStarter();
  const [preview, setPreview] = useState<RoutineView | null>(null);
  const last = lastDoneByRoutine(training);
  return (
    <div className="page">
      <h1 className="title">Workout</h1>
      <button type="button" className="btn btn-primary btn-block" onClick={() => void start()}>Start empty workout</button>
      <div className="sec">
        <div className="sec-head"><span className="lbl">Routines</span><Link to="/routines" className="link">Manage</Link></div>
        {routines === undefined ? null : routines.length ? (
          <div className="card list">
            {routines.map((r) => (
              <button key={r.routine.id} type="button" className="li" onClick={() => setPreview(r)}>
                <span className="li-main">
                  <span className="li-name">{r.routine.name}</span>
                  <span className="li-meta">{r.items.length} exercises · {r.setCount} sets · {last.get(r.routine.id) ? "last " + fmt.relDay(last.get(r.routine.id)!) : "never done"}</span>
                </span>
                <span className="li-side"><IconChevron /></span>
              </button>
            ))}
          </div>
        ) : <StarterRoutines />}
      </div>
      {preview && <RoutinePreview view={preview} lastDone={last.get(preview.routine.id)} onStart={() => void start({ routineId: preview.routine.id })} onClose={() => setPreview(null)} />}
      {element}
    </div>
  );
}
