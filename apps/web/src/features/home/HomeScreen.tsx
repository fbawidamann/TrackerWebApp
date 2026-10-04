import { formatClock } from "@fitness/shared";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { updateSettings } from "@/db/actions";
import {
  lastDoneByRoutine, muscleGroup, useAccount, useActiveWorkout, useCatalog, useRoutines, useRuns, useSettings, useTraining, type RoutineView,
} from "@/data/hooks";
import { RoutinePreview } from "@/features/routines/RoutinePreview";
import { StarterRoutines } from "@/features/routines/StarterRoutines";
import { useStarter } from "@/features/workout/useStarter";
import { useT } from "@/i18n";
import { goalStreak, nextRoutine, recentFeed, routineGroups, weekDays, workSetCount } from "@/lib/home";
import { useNow } from "@/lib/time";
import { useFormat } from "@/lib/useFormat";
import { IconChevron, IconLift, IconMedal, IconRun } from "@/ui/icons";
import { RadioSheet } from "@/ui/Sheet";
import { StartWorkoutButton } from "@/ui/StartWorkoutButton";
import { UpNextCard } from "./UpNextCard";
import { WeekCard } from "./WeekCard";

/** Start tab (docs/design/screens/home.md). */
export function HomeScreen() {
  const settings = useSettings();
  const account = useAccount();
  const training = useTraining();
  const routines = useRoutines();
  const runs = useRuns();
  const active = useActiveWorkout();
  const catalog = useCatalog();
  const fmt = useFormat();
  const t = useT();
  const navigate = useNavigate();
  const now = useNow(active ? 1000 : 60_000); // seconds only matter while the Resume clock shows
  const { start, element } = useStarter();
  const [preview, setPreview] = useState<RoutineView | null>(null);
  const [goalSheet, setGoalSheet] = useState(false);

  const today = new Date(now);
  // Week data only changes with the day (or the data), not with every clock tick.
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const goal = settings.weeklyGoal;
  const week = useMemo(() => {
    const day = new Date(dayStart);
    const days = weekDays(fmt.weekStart(day), training.workouts, runs ?? [], day);
    return {
      days,
      done: days.reduce((n, x) => n + x.gym, 0),
      runs: days.reduce((n, x) => n + x.runs, 0),
      streak: goalStreak(training.workouts, fmt.weekStart, day, goal),
    };
  }, [dayStart, fmt, runs, training.workouts, goal]);

  const last = useMemo(() => lastDoneByRoutine(training), [training]);
  const next = !active && routines?.length ? nextRoutine(routines, last) : null;
  const nextGroups = next ? routineGroups(next.items, catalog.byId, muscleGroup) : [];
  const listed = [...(routines ?? [])]
    .filter((r) => r !== next)
    .sort((a, b) => (last.get(b.routine.id)?.getTime() ?? -1) - (last.get(a.routine.id)?.getTime() ?? -1) || a.routine.position - b.routine.position)
    .slice(0, next ? 3 : 4);
  const feed = recentFeed(training.workouts, runs ?? []);
  const activeSets = active ? active.exercises.flatMap((e) => e.sets) : [];
  const activeDone = activeSets.filter((s) => s.completedAt).length;
  const user = account?.username ?? settings.displayName;

  return (
    <div className="page home">
      <div className="home-head">
        <div>
          {/* Username at the very top (docs/design/screens/home.md). Until accounts exist (M7) this is the Profile name. */}
          {user && <p className="home-user">{user}</p>}
          <h1 className="title">{fmt.weekday(today)}</h1>
          <p className="sub" style={{ marginTop: 2 }}>{fmt.dayMonth(today)}</p>
        </div>
        {settings.homeShowGoal && (
          <WeekCard days={week.days} done={week.done} goal={goal} runs={week.runs} streak={week.streak}
            loading={!training.loaded} onEditGoal={() => setGoalSheet(true)} />
        )}
      </div>

      {active ? (
        <div className="card resume">
          <span className="lbl">{active.activity.name} · {t.home.inProgress}</span>
          <div className="resume-row">
            <span className="resume-time">{formatClock((now - new Date(active.activity.startedAt).getTime()) / 1000)}</span>
            <span className="muted small">{t.home.setsDone(activeDone, activeSets.length)}</span>
          </div>
          {activeSets.length > 0 && (
            <span className="resume-bar" aria-hidden="true"><i style={{ transform: `scaleX(${activeDone / activeSets.length})` }} /></span>
          )}
          <Link to="/workout" className="btn btn-primary btn-block" style={{ textDecoration: "none" }}>{t.home.resume}</Link>
        </div>
      ) : (
        <div className="home-start">
          <StartWorkoutButton onStart={() => void start()} />
          {settings.homeShowRoutines && next && (
            <UpNextCard view={next} groups={nextGroups} lastDone={last.get(next.routine.id)}
              onOpen={() => setPreview(next)} onStart={() => void start({ routineId: next.routine.id })} />
          )}
        </div>
      )}

      {settings.homeShowRoutines && (
        routines === undefined ? (
          <div className="sec" aria-hidden="true"><span className="lbl">{t.home.routines}</span><div className="card skel"><i /><i /></div></div>
        ) : (routines.length === 0 || listed.length > 0) && (
          <div className="sec">
            <div className="sec-head"><span className="lbl">{t.home.routines}</span>{routines.length > 0 && <Link to="/routines" className="link">{t.common.all}</Link>}</div>
            {routines.length ? (
              <div className="card list">
                {listed.map((r) => (
                  <button key={r.routine.id} type="button" className="li" onClick={() => setPreview(r)}>
                    <span className="li-main">
                      <span className="li-name">{r.routine.name}</span>
                      <span className="li-meta">{t.common.exercises(r.items.length)} · {last.get(r.routine.id) ? t.home.lastDone(fmt.relDay(last.get(r.routine.id)!)) : t.home.neverDone}</span>
                    </span>
                    <span className="li-side"><IconChevron /></span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <StarterRoutines />
                <Link to="/routines/new" className="ghost" style={{ justifySelf: "start", textDecoration: "none" }}>{t.home.createRoutine}</Link>
              </>
            )}
          </div>
        )
      )}

      {settings.homeShowRecent && feed.length > 0 && (
        <div className="sec">
          <div className="sec-head"><span className="lbl">{t.home.recent}</span><Link to="/history" className="link">{t.nav.history}</Link></div>
          <div className="card list">
            {feed.map((f) => f.kind === "gym" ? (
              <button key={f.w.activity.id} type="button" className="li" onClick={() => void navigate({ to: "/history/$activityId", params: { activityId: f.w.activity.id } })}>
                <span className="lead">
                  <span className="kind" role="img" aria-label={t.home.kindGym}><IconLift /></span>
                  <span className="li-main">
                    <span className="li-name">{f.w.activity.name}</span>
                    <span className="li-meta">{fmt.relDay(f.w.start)} · <span className="nw">{fmt.duration(f.w.durationMin)}</span> · <span className="nw">{t.common.sets(workSetCount(f.w))}</span></span>
                  </span>
                </span>
                <span className="li-side">{f.w.prCount > 0 && <span className="medal" role="img" aria-label={t.common.pr}><IconMedal /></span>}<IconChevron /></span>
              </button>
            ) : (
              <button key={f.r.activity.id} type="button" className="li" onClick={() => void navigate({ to: "/running/$activityId", params: { activityId: f.r.activity.id } })}>
                <span className="lead">
                  <span className="kind" role="img" aria-label={t.home.kindRun}><IconRun /></span>
                  <span className="li-main">
                    <span className="li-name">{f.r.activity.name}</span>
                    <span className="li-meta">{fmt.relDay(f.r.start)} · <span className="nw">{fmt.dist(f.r.run.distanceM)} km</span> · <span className="nw">{fmt.pace(f.r.pace)} /km</span></span>
                  </span>
                </span>
                <span className="li-side"><IconChevron /></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {settings.homeShowPrs && training.prEvents.length > 0 && (
        <div className="sec">
          <span className="lbl">{t.home.latestPrs}</span>
          <div className="card list">
            {training.prEvents.slice(0, 3).map((p) => {
              const ex = catalog.byId.get(p.exerciseId);
              return (
                <button key={p.activityId + p.exerciseId} type="button" className="li" onClick={() => void navigate({ to: "/exercises/$exerciseId", params: { exerciseId: p.exerciseId } })}>
                  <span className="lead">
                    <span className="medal"><IconMedal /></span>
                    <span className="li-main"><span className="li-name">{ex?.name}</span><span className="li-meta">{fmt.relDay(p.date)}{ex ? ` · ${t.equipment[ex.equipment]}` : ""}</span></span>
                  </span>
                  <span className="pr-val">
                    <span className="v nw">{fmt.weightValue(p.value)}<span className="u">{fmt.unit}</span></span>
                    <span className="pr-up nw" aria-label={t.home.prUp(fmt.weight(p.value - p.previous))}>+{fmt.weightValue(p.value - p.previous)}<span className="u">{fmt.unit}</span></span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {preview && <RoutinePreview view={preview} lastDone={last.get(preview.routine.id)} onStart={() => void start({ routineId: preview.routine.id })} onClose={() => setPreview(null)} />}
      {goalSheet && (
        <RadioSheet title={t.home.weeklyGoal} sub={t.home.workoutsPerWeek} value={goal}
          options={[1, 2, 3, 4, 5, 6, 7].map((n) => [n, String(n)] as [number, string])}
          onChange={(v) => void updateSettings({ weeklyGoal: v })} onClose={() => setGoalSheet(false)} />
      )}
      {element}
    </div>
  );
}
