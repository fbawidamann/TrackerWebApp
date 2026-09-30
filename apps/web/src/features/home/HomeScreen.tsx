import { formatClock, formatDuration, MONTHS, WEEKDAYS } from "@fitness/shared";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { updateSettings } from "@/db/actions";
import { lastDoneByRoutine, useAccount, useActiveWorkout, useCatalog, useRoutines, useSettings, useTraining, type RoutineView } from "@/data/hooks";
import { RoutinePreview } from "@/features/routines/RoutinePreview";
import { StarterRoutines } from "@/features/routines/StarterRoutines";
import { useStarter } from "@/features/workout/useStarter";
import { EQUIPMENT_LABEL } from "@/lib/labels";
import { useNow } from "@/lib/time";
import { useFormat } from "@/lib/useFormat";
import { IconChevron, IconMedal } from "@/ui/icons";
import { RadioSheet } from "@/ui/Sheet";

export function HomeScreen() {
  const settings = useSettings();
  const account = useAccount();
  const training = useTraining();
  const routines = useRoutines();
  const active = useActiveWorkout();
  const catalog = useCatalog();
  const fmt = useFormat();
  const navigate = useNavigate();
  const now = useNow(1000);
  const { start, element } = useStarter();
  const [preview, setPreview] = useState<RoutineView | null>(null);
  const [goalSheet, setGoalSheet] = useState(false);

  const today = new Date(now);
  const weekStart = fmt.weekStart(today).getTime();
  const doneThisWeek = training.workouts.filter((w) => w.start.getTime() >= weekStart).length;
  const reached = doneThisWeek >= settings.weeklyGoal;
  const last = lastDoneByRoutine(training);
  const sortedRoutines = [...(routines ?? [])].sort((a, b) =>
    (last.get(b.routine.id)?.getTime() ?? -1) - (last.get(a.routine.id)?.getTime() ?? -1) || a.routine.position - b.routine.position);
  const activeSets = active ? active.exercises.flatMap((e) => e.sets) : [];

  return (
    <div className="page">
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          {/* Username at the very top (docs/design/screens/home.md). Until accounts exist (M7) this is the Profile name. */}
          {(account?.username ?? settings.displayName) && <p className="home-user">{account?.username ?? settings.displayName}</p>}
          <h1 className="title">{WEEKDAYS[today.getDay()]}</h1>
          <p className="sub" style={{ marginTop: 2 }}>{today.getDate()} {MONTHS[today.getMonth()]}</p>
        </div>
        {settings.homeShowGoal && (
          <button type="button" className="goal" onClick={() => setGoalSheet(true)} aria-label={`Weekly goal: ${doneThisWeek} of ${settings.weeklyGoal} workouts. Change goal`}>
            <span className="goal-t"><b>{doneThisWeek}</b> of <b>{settings.weeklyGoal}</b> workouts{reached ? <> · <span className="reached">goal reached</span></> : " this week"}</span>
            <span className="segs" style={{ gridTemplateColumns: `repeat(${settings.weeklyGoal}, 1fr)` }}>
              {Array.from({ length: settings.weeklyGoal }, (_, i) => <i key={i} className={i < doneThisWeek ? "on" : ""} />)}
            </span>
          </button>
        )}
      </div>

      {active ? (
        <div className="card resume">
          <span className="lbl">{active.activity.name} · In progress</span>
          <div className="resume-row">
            <span className="resume-time">{formatClock((now - new Date(active.activity.startedAt).getTime()) / 1000)}</span>
            <span className="muted small">{activeSets.filter((s) => s.completedAt).length} of {activeSets.length} sets</span>
          </div>
          <Link to="/workout" className="btn btn-primary btn-block" style={{ textDecoration: "none" }}>Resume</Link>
        </div>
      ) : (
        <button type="button" className="btn btn-primary btn-block" onClick={() => void start()}>Start empty workout</button>
      )}

      {settings.homeShowRoutines && routines !== undefined && (
        <div className="sec">
          <div className="sec-head"><span className="lbl">Routines</span>{routines.length > 0 && <Link to="/routines" className="link">All</Link>}</div>
          {routines.length ? (
            <div className="card list">
              {sortedRoutines.slice(0, 4).map((r) => (
                <button key={r.routine.id} type="button" className="li" onClick={() => setPreview(r)}>
                  <span className="li-main">
                    <span className="li-name">{r.routine.name}</span>
                    <span className="li-meta">{r.items.length} exercises · {last.get(r.routine.id) ? "last " + fmt.relDay(last.get(r.routine.id)!) : "never done"}</span>
                  </span>
                  <span className="li-side"><IconChevron /></span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <StarterRoutines />
              <Link to="/routines/new" className="ghost" style={{ justifySelf: "start", textDecoration: "none" }}>Create routine</Link>
            </>
          )}
        </div>
      )}

      {settings.homeShowRecent && training.workouts.length > 0 && (
        <div className="sec">
          <div className="sec-head"><span className="lbl">Recent</span><Link to="/history" className="link">History</Link></div>
          <div className="card list">
            {training.workouts.slice(0, 3).map((w) => (
              <button key={w.activity.id} type="button" className="li" onClick={() => void navigate({ to: "/history/$activityId", params: { activityId: w.activity.id } })}>
                <span className="li-main">
                  <span className="li-name">{w.activity.name}</span>
                  <span className="li-meta">{fmt.relDay(w.start)} · {formatDuration(w.durationMin)}</span>
                </span>
                <span className="li-side">{w.prCount > 0 && <span className="medal" aria-label="PR"><IconMedal /></span>}<IconChevron /></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {settings.homeShowPrs && training.prEvents.length > 0 && (
        <div className="sec">
          <span className="lbl">Latest PRs</span>
          <div className="card list">
            {training.prEvents.slice(0, 3).map((p) => {
              const ex = catalog.byId.get(p.exerciseId);
              return (
                <button key={p.activityId + p.exerciseId} type="button" className="li" onClick={() => void navigate({ to: "/exercises/$exerciseId", params: { exerciseId: p.exerciseId } })}>
                  <span className="lead">
                    <span className="medal"><IconMedal /></span>
                    <span className="li-main"><span className="li-name">{ex?.name}</span><span className="li-meta">{ex ? EQUIPMENT_LABEL[ex.equipment] : ""}</span></span>
                  </span>
                  <span className="pr-val"><span className="v nw">{fmt.weightValue(p.value)}<span className="u">{fmt.unit}</span></span><span className="li-meta">{fmt.relDay(p.date)}</span></span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {preview && <RoutinePreview view={preview} lastDone={last.get(preview.routine.id)} onStart={() => void start({ routineId: preview.routine.id })} onClose={() => setPreview(null)} />}
      {goalSheet && (
        <RadioSheet title="Weekly goal" sub="Workouts per week" value={settings.weeklyGoal}
          options={[1, 2, 3, 4, 5, 6, 7].map((n) => [n, String(n)] as [number, string])}
          onChange={(v) => void updateSettings({ weeklyGoal: v })} onClose={() => setGoalSheet(false)} />
      )}
      {element}
    </div>
  );
}
