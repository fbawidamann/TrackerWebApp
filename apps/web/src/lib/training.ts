import { bestReps, heaviestWeight, prSessions, type Activity, type ActivityExercise, type WorkoutSet } from "@fitness/shared";

export interface WorkoutExerciseView {
  ae: ActivityExercise;
  sets: WorkoutSet[];
  pr: { value: number; previous: number } | null;
}

export interface WorkoutView {
  activity: Activity;
  start: Date;
  end: Date;
  durationMin: number;
  exercises: WorkoutExerciseView[];
  setCount: number;
  prCount: number;
}

export interface ExerciseSession {
  activityId: string;
  aeId: string;
  workoutName: string;
  date: Date;
  sets: WorkoutSet[];
  heaviest: number | null;
  bestReps: number | null;
}

export interface PrEvent {
  exerciseId: string;
  activityId: string;
  workoutName: string;
  date: Date;
  value: number;
  previous: number;
}

export interface Training {
  workouts: WorkoutView[];
  byId: Map<string, WorkoutView>;
  sessionsByExercise: Map<string, ExerciseSession[]>;
  prEvents: PrEvent[];
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/**
 * Builds all derived workout data (history, per-exercise sessions, PRs) from raw rows.
 * PRs are heaviest-weight only, and are never stored (docs/architecture/data-model.md).
 */
export function buildTraining(
  activities: Activity[],
  activityExercises: ActivityExercise[],
  sets: WorkoutSet[],
  includeWarmups: boolean,
): Training {
  const completed = activities.filter((a) => a.deletedAt === null && a.status === "completed");
  const actIds = new Set(completed.map((a) => a.id));
  const setsByAe = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    if (s.deletedAt !== null || !actIds.has(s.activityId)) continue;
    const list = setsByAe.get(s.activityExerciseId);
    if (list) list.push(s); else setsByAe.set(s.activityExerciseId, [s]);
  }
  const aesByAct = new Map<string, ActivityExercise[]>();
  for (const ae of activityExercises) {
    if (ae.deletedAt !== null || !actIds.has(ae.activityId)) continue;
    const list = aesByAct.get(ae.activityId);
    if (list) list.push(ae); else aesByAct.set(ae.activityId, [ae]);
  }

  const chronological = [...completed].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const sessionsByExercise = new Map<string, ExerciseSession[]>();
  for (const a of chronological) {
    for (const ae of (aesByAct.get(a.id) ?? []).sort(byPosition)) {
      const s = (setsByAe.get(ae.id) ?? []).sort(byPosition);
      if (!s.length) continue;
      const session: ExerciseSession = {
        activityId: a.id, aeId: ae.id, workoutName: a.name, date: new Date(a.startedAt), sets: s,
        heaviest: heaviestWeight(s, includeWarmups), bestReps: bestReps(s, includeWarmups),
      };
      const list = sessionsByExercise.get(ae.exerciseId);
      if (list) list.push(session); else sessionsByExercise.set(ae.exerciseId, [session]);
    }
  }

  const prByAe = new Map<string, { value: number; previous: number }>();
  const prEvents: PrEvent[] = [];
  for (const [exerciseId, sessions] of sessionsByExercise) {
    const prs = prSessions(sessions.map((s) => ({ key: s.aeId, value: s.heaviest })));
    for (const s of sessions) {
      const pr = prs.get(s.aeId);
      if (!pr) continue;
      prByAe.set(s.aeId, pr);
      prEvents.push({ exerciseId, activityId: s.activityId, workoutName: s.workoutName, date: s.date, ...pr });
    }
  }
  prEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

  const workouts: WorkoutView[] = completed
    .map((a) => {
      const exercises = (aesByAct.get(a.id) ?? [])
        .sort(byPosition)
        .map((ae) => ({ ae, sets: (setsByAe.get(ae.id) ?? []).sort(byPosition), pr: prByAe.get(ae.id) ?? null }))
        .filter((e) => e.sets.length > 0);
      const start = new Date(a.startedAt);
      const end = a.endedAt ? new Date(a.endedAt) : start;
      return {
        activity: a, start, end,
        durationMin: Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)),
        exercises,
        setCount: exercises.reduce((n, e) => n + e.sets.length, 0),
        prCount: exercises.filter((e) => e.pr).length,
      };
    })
    .sort((a, b) => b.start.getTime() - a.start.getTime());

  return { workouts, byId: new Map(workouts.map((w) => [w.activity.id, w])), sessionsByExercise, prEvents };
}

/** Previous-session set matching position and type (for the "Previous" column and placeholders). */
export function previousSetFor(prevSets: WorkoutSet[] | undefined, setTypes: string[], index: number): WorkoutSet | null {
  if (!prevSets?.length) return null;
  const type = setTypes[index];
  let k = 0;
  for (let i = 0; i < index; i++) if (setTypes[i] === type) k++;
  return prevSets.filter((s) => s.setType === type)[k] ?? null;
}
