import { formatDuration, formatTime } from "@fitness/shared";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { routineChanges, updateRoutineFromWorkout } from "@/db/actions";
import { useCatalog, useRoutines, useTraining } from "@/data/hooks";
import { EQUIPMENT_LABEL } from "@/lib/labels";
import { useFormat } from "@/lib/useFormat";
import { IconMedal } from "@/ui/icons";

/** Shown after Finish: duration, sets, PRs, exercises, "Update routine?" (docs/design/screens/active-workout.md). */
export function SummaryScreen() {
  const { activityId } = useParams({ from: "/workout/done/$activityId" });
  const navigate = useNavigate();
  const training = useTraining();
  const catalog = useCatalog();
  const routines = useRoutines();
  const fmt = useFormat();
  const w = training.byId.get(activityId);
  const routine = routines?.find((r) => r.routine.id === w?.activity.routineId);
  const [change, setChange] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  useEffect(() => {
    if (w && routine) void routineChanges(routine.routine.id, w.activity.id).then(setChange);
  }, [w?.activity.id, routine?.routine.id, routine?.items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!training.loaded) return <div className="page no-nav" />;
  if (!w) return <div className="page no-nav"><p className="muted">Workout not found.</p><button type="button" className="btn btn-primary btn-block" onClick={() => void navigate({ to: "/" })}>Done</button></div>;

  const prs = w.exercises.filter((e) => e.pr);
  return (
    <div className="page no-nav">
      <div>
        <span className="lbl">Workout complete</span>
        <h1 className="title" style={{ marginTop: 4 }}>{w.activity.name}</h1>
        <p className="sub">{fmt.date(w.start)} · {formatTime(w.start)}</p>
      </div>
      <div className="card stats">
        <div className="stat"><span className="stat-v">{formatDuration(w.durationMin)}</span><span className="lbl">Duration</span></div>
        <div className="stat"><span className="stat-v">{w.setCount}</span><span className="lbl">Sets</span></div>
        <div className="stat"><span className="stat-v">{w.prCount}</span><span className="lbl">PRs</span></div>
      </div>
      {prs.length > 0 && (
        <div className="sec">
          <span className="lbl">New records</span>
          <div className="card list">
            {prs.map(({ ae, pr }) => {
              const ex = catalog.byId.get(ae.exerciseId);
              return (
                <div className="li" key={ae.id}>
                  <span className="li-main">
                    <span className="li-name">{ex?.name}</span>
                    <span className="li-meta">{ex ? EQUIPMENT_LABEL[ex.equipment] : ""} · was {fmt.weight(pr!.previous)}</span>
                  </span>
                  <span className="li-side" style={{ color: "var(--text)", fontWeight: 600 }}>
                    <span className="medal"><IconMedal /></span>
                    <span className="nw">{fmt.weightValue(pr!.value)}<span className="u">{fmt.unit}</span></span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="sec">
        <span className="lbl">Exercises</span>
        <div className="card list">
          {w.exercises.map(({ ae, sets, pr }) => {
            const ex = catalog.byId.get(ae.exerciseId);
            const best = Math.max(0, ...sets.filter((s) => s.setType !== "warmup").map((s) => s.weightKg ?? 0));
            return (
              <div className="li" key={ae.id}>
                <span className="li-main">
                  <span className="li-name">{ex?.name}</span>
                  <span className="li-meta">{sets.length} sets{best > 0 ? <> · best <span className="nw">{fmt.weight(best)}</span></> : null}</span>
                </span>
                {pr && <span className="medal" aria-label="PR"><IconMedal /></span>}
              </div>
            );
          })}
        </div>
      </div>
      {routine && change && (
        <div className="card" style={{ padding: 18, display: "grid", gap: 14 }}>
          {answer ? <p className="muted" style={{ margin: 0 }}>{answer}</p> : (
            <>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Update {routine.routine.name} with these changes?</p>
                <p className="hint" style={{ marginTop: 4 }}>{change}</p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => void updateRoutineFromWorkout(routine.routine.id, w.activity.id).then(() => setAnswer(`${routine.routine.name} updated.`))}>Update routine</button>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setAnswer(`${routine.routine.name} kept as it was.`)}>Keep routine</button>
              </div>
            </>
          )}
        </div>
      )}
      <button type="button" className="btn btn-primary btn-block" onClick={() => void navigate({ to: "/" })}>Done</button>
    </div>
  );
}
