import { useNavigate } from "@tanstack/react-router";
import { useCatalog, type RoutineView } from "@/data/hooks";
import { EQUIPMENT_LABEL } from "@/lib/labels";
import { useFormat } from "@/lib/useFormat";
import { Sheet } from "@/ui/Sheet";

export const setsText = (w: number, s: number) => (w ? `${w} warm-up + ` : "") + `${s} ${s === 1 ? "set" : "sets"}`;

/** Preview sheet: exercises with set counts, Start workout / Edit routine. Same on Home, Workout tab and Routines. */
export function RoutinePreview({ view, lastDone, onStart, onClose }: {
  view: RoutineView; lastDone: Date | undefined; onStart: () => void; onClose: () => void;
}) {
  const catalog = useCatalog();
  const fmt = useFormat();
  const navigate = useNavigate();
  return (
    <Sheet onClose={onClose} label={view.routine.name}>
      <div>
        <h3>{view.routine.name}</h3>
        <p className="small">{lastDone ? `last done ${fmt.date(lastDone)}` : "not done yet"}</p>
      </div>
      {view.items.length > 0 && (
        <div className="card list">
          {view.items.map((i) => {
            const ex = catalog.byId.get(i.exerciseId);
            return (
              <div className="li" key={i.id}>
                <span className="li-main">
                  <span>{ex?.name ?? "Exercise"}</span>
                  <span className="li-meta">{ex ? EQUIPMENT_LABEL[ex.equipment] : ""}</span>
                </span>
                <span className="li-side small">{setsText(i.warmupSets, i.workingSets)}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="acts">
        <button type="button" className="btn btn-primary btn-block" onClick={() => { onClose(); onStart(); }}>Start workout</button>
        <button type="button" className="btn btn-block" onClick={() => { onClose(); void navigate({ to: "/routines/$routineId/edit", params: { routineId: view.routine.id } }); }}>Edit routine</button>
      </div>
    </Sheet>
  );
}
