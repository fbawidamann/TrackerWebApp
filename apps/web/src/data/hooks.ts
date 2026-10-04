import {
  DEFAULT_DEVICE_SETTINGS, DEFAULT_USER_SETTINGS, MUSCLE_TO_GROUP,
  type Activity, type ActivityExercise, type DeviceSettings, type Exercise, type MuscleGroup, type Routine,
  type RoutineExercise, type RunTrack, type UserSettings, type WorkoutSet,
} from "@fitness/shared";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import type { RestState } from "@/db/actions";
import { db, LOCAL_USER } from "@/db/db";
import { initialLanguage } from "@/i18n/device";
import { buildRuns, type RunView } from "@/lib/runStats";
import { buildTraining, type Training } from "@/lib/training";

const alive = <T extends { deletedAt: string | null }>(r: T) => r.deletedAt === null;
const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

const FALLBACK_SETTINGS: UserSettings = { ...DEFAULT_USER_SETTINGS, language: initialLanguage(), userId: LOCAL_USER, updatedAt: "" };

export function useSettings(): UserSettings {
  const row = useLiveQuery(() => db.settings.get("user"), []);
  // Rows saved before a setting existed (e.g. `language`) lack it: the fallback fills the gap.
  return useMemo(() => ({ ...FALLBACK_SETTINGS, ...(row ?? {}) }), [row]);
}

export function useDeviceSettings(): DeviceSettings {
  const row = useLiveQuery(() => db.meta.get("device"), []);
  return useMemo(() => ({ ...DEFAULT_DEVICE_SETTINGS, ...((row?.value as Partial<DeviceSettings>) ?? {}) }), [row]);
}

export interface Catalog {
  loaded: boolean;
  list: Exercise[];
  byId: Map<string, Exercise>;
  hidden: Set<string>;
}

export function useCatalog(): Catalog {
  const rows = useLiveQuery(() => db.exercises.toArray(), []);
  const prefs = useLiveQuery(() => db.exercisePrefs.toArray(), []);
  return useMemo(() => {
    const all = rows ?? [];
    return {
      loaded: rows !== undefined,
      list: all.filter(alive),
      byId: new Map(all.map((e) => [e.id, e])),
      hidden: new Set((prefs ?? []).filter((p) => alive(p) && p.hidden).map((p) => p.exerciseId)),
    };
  }, [rows, prefs]);
}

export const muscleGroup = (e: Pick<Exercise, "primaryMuscle">): MuscleGroup => MUSCLE_TO_GROUP[e.primaryMuscle] ?? "Other";

/** All completed workouts with derived PRs and per-exercise sessions. */
export function useTraining(): Training & { loaded: boolean } {
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const [activities, aes, sets] = await Promise.all([db.activities.toArray(), db.activityExercises.toArray(), db.sets.toArray()]);
    return { activities, aes, sets };
  }, []);
  return useMemo(() => {
    const t = buildTraining(data?.activities ?? [], data?.aes ?? [], data?.sets ?? [], settings.warmupsInPrs);
    return { ...t, loaded: data !== undefined };
  }, [data, settings.warmupsInPrs]);
}

export interface ActiveWorkout {
  activity: Activity;
  exercises: Array<{ ae: ActivityExercise; sets: WorkoutSet[] }>;
}

/** The workout currently in progress (at most one), or null. `undefined` while loading. */
export function useActiveWorkout(): ActiveWorkout | null | undefined {
  return useLiveQuery(async () => {
    const acts = (await db.activities.where("status").equals("in_progress").toArray()).filter((a) => alive(a) && a.type === "gym");
    const activity = acts.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (!activity) return null;
    const aes = (await db.activityExercises.where("activityId").equals(activity.id).toArray()).filter(alive).sort(byPosition);
    const sets = (await db.sets.where("activityId").equals(activity.id).toArray()).filter(alive).sort(byPosition);
    return { activity, exercises: aes.map((ae) => ({ ae, sets: sets.filter((s) => s.activityExerciseId === ae.id) })) };
  }, []);
}

export function useRest(): RestState | null {
  const row = useLiveQuery(() => db.meta.get("rest"), []);
  return (row?.value as RestState | undefined) ?? null;
}

export interface RoutineView {
  routine: Routine;
  items: RoutineExercise[];
  setCount: number;
}

export function useRoutines(): RoutineView[] | undefined {
  return useLiveQuery(async () => {
    const routines = (await db.routines.toArray()).filter(alive).sort(byPosition);
    const items = (await db.routineExercises.toArray()).filter(alive);
    return routines.map((routine) => {
      const mine = items.filter((i) => i.routineId === routine.id).sort(byPosition);
      return { routine, items: mine, setCount: mine.reduce((n, i) => n + i.warmupSets + i.workingSets, 0) };
    });
  }, []);
}

/** Last date each routine was done (by completed workouts started from it). */
export function lastDoneByRoutine(training: Training): Map<string, Date> {
  const out = new Map<string, Date>();
  for (const w of training.workouts) {
    const id = w.activity.routineId;
    if (id && !out.has(id)) out.set(id, w.start);
  }
  return out;
}

/* ---------- Running ---------- */

/** All completed runs, newest first. `undefined` while loading. */
export function useRuns(): RunView[] | undefined {
  const data = useLiveQuery(async () => {
    const [activities, runs] = await Promise.all([db.activities.toArray(), db.runs.toArray()]);
    return { activities, runs };
  }, []);
  return useMemo(() => (data ? buildRuns(data.activities, data.runs) : undefined), [data]);
}

/** The GPS track of one run, null when it has none. `undefined` while loading. */
export function useRunTrack(activityId: string): RunTrack | null | undefined {
  return useLiveQuery(async () => (await db.runTracks.where("activityId").equals(activityId).toArray()).find(alive) ?? null, [activityId]);
}

/* ---------- Nutrition ---------- */

/** All food entries (incl. deleted, filtered by the pure helpers). `undefined` while loading. */
export function useFoodEntries(): import("@fitness/shared").FoodEntry[] | undefined {
  return useLiveQuery(() => db.foodEntries.toArray(), []);
}
export function useFoods(): import("@fitness/shared").Food[] | undefined {
  return useLiveQuery(() => db.foods.toArray(), []);
}
export function useBodyWeights(): import("@fitness/shared").BodyWeight[] | undefined {
  return useLiveQuery(() => db.bodyWeights.toArray(), []);
}

/* ---------- Account and sync (M7/M8) ---------- */

/** The logged-in account on this device: undefined while loading, null when logged out. */
export function useAccount(): import("@fitness/shared").Account | null | undefined {
  return useLiveQuery(async () => ((await db.meta.get("account"))?.value as import("@fitness/shared").Account | undefined) ?? null, []);
}

export function useSessionExpired(): boolean {
  return useLiveQuery(async () => !!(await db.meta.get("sessionExpired"))?.value, []) ?? false;
}

export interface SyncView { state: "idle" | "syncing"; lastSyncAt: string | null; error: "offline" | "failed" | null; pending: number }

export function useSyncStatus(): SyncView {
  return useLiveQuery(async () => {
    const s = ((await db.meta.get("sync"))?.value as Omit<SyncView, "pending"> | undefined) ?? { state: "idle" as const, lastSyncAt: null, error: null };
    const entries = await db.outbox.toArray();
    return { ...s, pending: new Set(entries.map((e) => e.table + "|" + e.rowId)).size };
  }, []) ?? { state: "idle", lastSyncAt: null, error: null, pending: 0 };
}
