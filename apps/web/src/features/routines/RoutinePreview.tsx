import { useNavigate } from "@tanstack/react-router";
import { useCatalog, type RoutineView } from "@/data/hooks";
import { useT } from "@/i18n";
import { useFormat } from "@/lib/useFormat";
import { Sheet } from "@/ui/Sheet";

/** Preview sheet: exercises with set counts, Start workout / Edit routine. Same on Home, Workout tab and Routines. */
export function RoutinePreview({ view, lastDone, onStart, onClose }: {
  view: RoutineView; lastDone: Date | undefined; onStart: () => void; onClose: () => void;
}) {
  const catalog = useCatalog();
  const fmt = useFormat();
  const t = useT();
  const navigate = useNavigate();
  return (
    <Sheet onClose={onClose} label={view.routine.name}>
      <div>
        <h3>{view.routine.name}</h3>
        <p className="small">{lastDone ? t.routines.lastDoneOn(fmt.date(lastDone)) : t.routines.notDoneYet}</p>
      </div>
      {view.items.length > 0 && (
        <div className="card list">
          {view.items.map((i) => {
            const ex = catalog.byId.get(i.exerciseId);
            return (
              <div className="li" key={i.id}>
                <span className="li-main">
                  <span>{ex?.name ?? t.common.exercise}</span>
                  <span className="li-meta">{ex ? t.equipment[ex.equipment] : ""}</span>
                </span>
                <span className="li-side small">{t.routines.setsText(i.warmupSets, i.workingSets)}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="acts">
        <button type="button" className="btn btn-primary btn-block" onClick={() => { onClose(); onStart(); }}>{t.routines.startWorkout}</button>
        <button type="button" className="btn btn-block" onClick={() => { onClose(); void navigate({ to: "/routines/$routineId/edit", params: { routineId: view.routine.id } }); }}>{t.routines.editRoutine}</button>
      </div>
    </Sheet>
  );
}
