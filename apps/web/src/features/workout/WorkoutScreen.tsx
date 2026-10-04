import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { lastDoneByRoutine, useActiveWorkout, useRoutines, useTraining, type RoutineView } from "@/data/hooks";
import { RoutinePreview } from "@/features/routines/RoutinePreview";
import { StarterRoutines } from "@/features/routines/StarterRoutines";
import { useT } from "@/i18n";
import { useFormat } from "@/lib/useFormat";
import { IconChevron } from "@/ui/icons";
import { ActiveWorkout } from "./ActiveWorkout";
import { useStarter } from "./useStarter";
import { StartWorkoutButton } from "@/ui/StartWorkoutButton";

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
  const t = useT();
  const { start, element } = useStarter();
  const [preview, setPreview] = useState<RoutineView | null>(null);
  const last = lastDoneByRoutine(training);
  return (
    <div className="page">
      <h1 className="title">{t.workout.workout}</h1>
      <StartWorkoutButton onStart={() => void start()} />
      <div className="sec">
        <div className="sec-head"><span className="lbl">{t.workout.routines}</span><Link to="/routines" className="link">{t.workout.manage}</Link></div>
        {routines === undefined ? null : routines.length ? (
          <div className="card list">
            {routines.map((r) => (
              <button key={r.routine.id} type="button" className="li" onClick={() => setPreview(r)}>
                <span className="li-main">
                  <span className="li-name">{r.routine.name}</span>
                  <span className="li-meta">{t.routines.meta(r.items.length, r.setCount, last.get(r.routine.id) ? t.home.lastDone(fmt.relDay(last.get(r.routine.id)!)) : t.home.neverDone)}</span>
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
