import {
  BACKUP_SCHEMA_VERSION, backupSchema, bestEfforts, builtinExerciseId, cumulativeDistances, DEFAULT_DEVICE_SETTINGS,
  DEFAULT_USER_SETTINGS, downsampleTrack, encodePolyline, manualEfforts, runNameForTime, summarizeTrack, workoutNameForTime,
  type Activity, type ActivityExercise, type Backup, type DeviceSettings, type Exercise, type Routine,
  type RoutineExercise, type Run, type RunTrack, type SetType, type TrackPoint, type TrackSummary, type UserSettings,
  type WorkoutSet,
} from "@fitness/shared";
import { currentLanguage, tr } from "@/i18n";
import { db, LOCAL_USER, SYNCED_TABLES, type SyncedTable } from "./db";
import { alive, baseRow, patch, restore, softDelete, upsert, write } from "./mutate";

const iso = (d: Date = new Date()) => d.toISOString();
const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/* ================= Settings ================= */

export async function getSettings(): Promise<UserSettings> {
  return (await db.settings.get("user")) ?? { ...DEFAULT_USER_SETTINGS, userId: LOCAL_USER, updatedAt: iso() };
}

export async function updateSettings(changes: Partial<Omit<UserSettings, "id" | "userId" | "updatedAt">>): Promise<void> {
  if (!(await db.settings.get("user"))) await upsert("settings", { ...DEFAULT_USER_SETTINGS, userId: LOCAL_USER, updatedAt: iso() });
  await patch("settings", "user", changes);
}

export async function getDeviceSettings(): Promise<DeviceSettings> {
  const row = await db.meta.get("device");
  return { ...DEFAULT_DEVICE_SETTINGS, ...((row?.value as Partial<DeviceSettings>) ?? {}) };
}

export async function updateDeviceSettings(changes: Partial<DeviceSettings>): Promise<void> {
  const current = await getDeviceSettings();
  await db.meta.put({ key: "device", value: { ...current, ...changes } });
}

/* ================= Rest timer (device-local UI state) ================= */

export interface RestState {
  startedAt: number;
  duration: number;
}

export async function startRest(seconds: number): Promise<void> {
  await db.meta.put({ key: "rest", value: { startedAt: Date.now(), duration: seconds } satisfies RestState });
}
export async function adjustRest(deltaSeconds: number): Promise<void> {
  const row = await db.meta.get("rest");
  const r = row?.value as RestState | undefined;
  if (!r) return;
  await db.meta.put({ key: "rest", value: { ...r, duration: Math.max(15, r.duration + deltaSeconds) } });
}
export async function stopRest(): Promise<void> {
  await db.meta.delete("rest");
}

/* ================= Lookups ================= */

export async function getActiveWorkout(): Promise<Activity | undefined> {
  const list = await db.activities.where("status").equals("in_progress").toArray();
  return list.filter((a) => alive(a) && a.type === "gym").sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

/** Completed sets of the last completed session of an exercise (optionally before a date, excluding one activity). */
export async function lastSessionSets(exerciseId: string, before?: string, excludeActivityId?: string): Promise<WorkoutSet[]> {
  const aes = (await db.activityExercises.where("exerciseId").equals(exerciseId).toArray()).filter(alive);
  if (!aes.length) return [];
  const acts = new Map((await db.activities.bulkGet([...new Set(aes.map((a) => a.activityId))])).filter((a): a is Activity => !!a).map((a) => [a.id, a]));
  const candidates = aes
    .map((ae) => ({ ae, act: acts.get(ae.activityId) }))
    .filter((x): x is { ae: ActivityExercise; act: Activity } =>
      !!x.act && alive(x.act) && x.act.status === "completed" && x.act.id !== excludeActivityId && (!before || x.act.startedAt < before))
    .sort((a, b) => b.act.startedAt.localeCompare(a.act.startedAt));
  const latest = candidates[0];
  if (!latest) return [];
  const sets = await db.sets.where("activityExerciseId").equals(latest.ae.id).toArray();
  return sets.filter((s) => alive(s) && s.completedAt !== null).sort(byPosition);
}

function newSetRow(activityId: string, activityExerciseId: string, position: number, setType: SetType): WorkoutSet {
  return { ...baseRow(), activityId, activityExerciseId, position, setType, weightKg: null, reps: null, durationS: null, distanceM: null, rpe: null, completedAt: null };
}

/** Set types for an exercise added without a routine: the last session's structure, or N normal sets. */
async function defaultSetTypes(exerciseId: string): Promise<SetType[]> {
  const last = await lastSessionSets(exerciseId);
  if (last.length) return last.map((s) => s.setType);
  const n = (await getSettings()).defaultSets;
  return Array.from({ length: n }, () => "normal" as const);
}

/* ================= Active workout ================= */

export async function startWorkout(opts: { routineId?: string; repeatActivityId?: string } = {}): Promise<string> {
  const started = new Date();
  let name = workoutNameForTime(started, currentLanguage());
  let plan: Array<{ exerciseId: string; note: string; types: SetType[] }> = [];
  let routineId: string | null = null;

  if (opts.routineId) {
    const routine = await db.routines.get(opts.routineId);
    if (routine) {
      name = routine.name;
      routineId = routine.id;
      const items = (await db.routineExercises.where("routineId").equals(routine.id).toArray()).filter(alive).sort(byPosition);
      plan = items.map((i) => ({
        exerciseId: i.exerciseId,
        note: i.note,
        types: [...Array<SetType>(i.warmupSets).fill("warmup"), ...Array<SetType>(i.workingSets).fill("normal")],
      }));
    }
  } else if (opts.repeatActivityId) {
    const src = await db.activities.get(opts.repeatActivityId);
    if (src) {
      name = src.name;
      routineId = src.routineId;
      const aes = (await db.activityExercises.where("activityId").equals(src.id).toArray()).filter(alive).sort(byPosition);
      for (const ae of aes) {
        const sets = (await db.sets.where("activityExerciseId").equals(ae.id).toArray()).filter(alive).sort(byPosition);
        plan.push({ exerciseId: ae.exerciseId, note: ae.note, types: sets.map((s) => s.setType) });
      }
    }
  }

  const activity: Activity = { ...baseRow(), type: "gym", name, routineId, startedAt: iso(started), endedAt: null, status: "in_progress", notes: "" };
  await write(async () => {
    await upsert("activities", activity);
    for (const [i, p] of plan.entries()) {
      const ae: ActivityExercise = { ...baseRow(), activityId: activity.id, exerciseId: p.exerciseId, position: i, note: p.note };
      await upsert("activityExercises", ae);
      for (const [j, t] of p.types.entries()) await upsert("sets", newSetRow(activity.id, ae.id, j, t));
    }
  });
  await stopRest();
  return activity.id;
}

export async function addExercises(activityId: string, exerciseIds: string[]): Promise<void> {
  const existing = (await db.activityExercises.where("activityId").equals(activityId).toArray()).filter(alive);
  let pos = existing.reduce((m, a) => Math.max(m, a.position), -1) + 1;
  const plans = await Promise.all(exerciseIds.map(async (id) => ({ id, types: await defaultSetTypes(id) })));
  await write(async () => {
    for (const p of plans) {
      const ae: ActivityExercise = { ...baseRow(), activityId, exerciseId: p.id, position: pos++, note: "" };
      await upsert("activityExercises", ae);
      for (const [j, t] of p.types.entries()) await upsert("sets", newSetRow(activityId, ae.id, j, t));
    }
  });
}

export async function addSet(activityExerciseId: string): Promise<void> {
  const ae = await db.activityExercises.get(activityExerciseId);
  if (!ae) return;
  const sets = (await db.sets.where("activityExerciseId").equals(ae.id).toArray()).filter(alive);
  const pos = sets.reduce((m, s) => Math.max(m, s.position), -1) + 1;
  await upsert("sets", newSetRow(ae.activityId, ae.id, pos, "normal"));
}

export async function updateSet(setId: string, changes: Partial<Pick<WorkoutSet, "weightKg" | "reps" | "durationS" | "setType" | "completedAt">>): Promise<void> {
  await patch("sets", setId, changes);
}

export async function deleteSet(setId: string): Promise<() => Promise<void>> {
  await softDelete("sets", setId);
  return () => restore("sets", [setId]);
}

export async function replaceExercise(activityExerciseId: string, exerciseId: string): Promise<void> {
  await patch("activityExercises", activityExerciseId, { exerciseId });
}

export async function setExerciseNote(activityExerciseId: string, note: string): Promise<void> {
  await patch("activityExercises", activityExerciseId, { note: note.slice(0, 120) });
}

/** Soft-deletes an exercise and its sets. Returns an undo function. */
export async function removeActivityExercise(activityExerciseId: string): Promise<() => Promise<void>> {
  const sets = (await db.sets.where("activityExerciseId").equals(activityExerciseId).toArray()).filter(alive).map((s) => s.id);
  await write(async () => {
    await softDelete("activityExercises", activityExerciseId);
    await softDelete("sets", sets);
  });
  return async () => write(async () => {
    await restore("activityExercises", [activityExerciseId]);
    await restore("sets", sets);
  });
}

export async function reorder(tableName: "activityExercises" | "routines" | "routineExercises", idsInOrder: string[]): Promise<void> {
  await write(async () => {
    for (const [i, id] of idsInOrder.entries()) await patch(tableName, id, { position: i });
  });
}

export async function renameActivity(activityId: string, name: string): Promise<void> {
  if (name.trim()) await patch("activities", activityId, { name: name.trim().slice(0, 40) });
}

/** Soft-deletes a workout with all its exercises and sets. Returns an undo function. */
export async function deleteWorkout(activityId: string): Promise<() => Promise<void>> {
  const aes = (await db.activityExercises.where("activityId").equals(activityId).toArray()).filter(alive).map((a) => a.id);
  const sets = (await db.sets.where("activityId").equals(activityId).toArray()).filter(alive).map((s) => s.id);
  await write(async () => {
    await softDelete("activities", activityId);
    await softDelete("activityExercises", aes);
    await softDelete("sets", sets);
  });
  return async () => write(async () => {
    await restore("activities", [activityId]);
    await restore("activityExercises", aes);
    await restore("sets", sets);
  });
}

export async function discardWorkout(activityId: string): Promise<void> {
  await deleteWorkout(activityId);
  await stopRest();
}

/** Drops unfinished sets and empty exercises, then marks the workout completed. */
export async function finishWorkout(activityId: string): Promise<void> {
  const aes = (await db.activityExercises.where("activityId").equals(activityId).toArray()).filter(alive);
  const sets = (await db.sets.where("activityId").equals(activityId).toArray()).filter(alive);
  await write(async () => {
    await softDelete("sets", sets.filter((s) => s.completedAt === null).map((s) => s.id));
    const keep = new Set(sets.filter((s) => s.completedAt !== null).map((s) => s.activityExerciseId));
    await softDelete("activityExercises", aes.filter((a) => !keep.has(a.id)).map((a) => a.id));
    await patch("activities", activityId, { status: "completed", endedAt: iso() });
  });
  await stopRest();
}

/* ================= Routines ================= */

export interface RoutineItemInput {
  id?: string;
  exerciseId: string;
  warmupSets: number;
  workingSets: number;
  note: string;
}

async function writeRoutineItems(routineId: string, items: RoutineItemInput[]): Promise<void> {
  const existing = (await db.routineExercises.where("routineId").equals(routineId).toArray()).filter(alive);
  const keepIds = new Set(items.map((i) => i.id).filter(Boolean));
  await softDelete("routineExercises", existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id));
  for (const [i, it] of items.entries()) {
    const prev = it.id ? existing.find((e) => e.id === it.id) : undefined;
    const row: RoutineExercise = {
      ...(prev ?? baseRow()),
      routineId, exerciseId: it.exerciseId, position: i,
      warmupSets: Math.min(5, Math.max(0, it.warmupSets)),
      workingSets: Math.min(10, Math.max(1, it.workingSets)),
      note: it.note.slice(0, 120),
    };
    await upsert("routineExercises", row);
  }
}

export async function saveRoutine(routineId: string | null, name: string, items: RoutineItemInput[]): Promise<string> {
  return write(async () => {
    let routine: Routine | undefined = routineId ? await db.routines.get(routineId) : undefined;
    if (!routine) {
      const all = (await db.routines.toArray()).filter(alive);
      routine = { ...baseRow(), name: name.trim().slice(0, 40), position: all.reduce((m, r) => Math.max(m, r.position), -1) + 1 };
    }
    routine = { ...routine, name: name.trim().slice(0, 40) };
    await upsert("routines", routine);
    await writeRoutineItems(routine.id, items);
    return routine.id;
  });
}

export async function getRoutineItems(routineId: string): Promise<RoutineItemInput[]> {
  const rows = (await db.routineExercises.where("routineId").equals(routineId).toArray()).filter(alive).sort(byPosition);
  return rows.map((r) => ({ id: r.id, exerciseId: r.exerciseId, warmupSets: r.warmupSets, workingSets: r.workingSets, note: r.note }));
}

export async function renameRoutine(routineId: string, name: string): Promise<void> {
  if (name.trim()) await patch("routines", routineId, { name: name.trim().slice(0, 40) });
}

export async function duplicateRoutine(routineId: string): Promise<void> {
  const r = await db.routines.get(routineId);
  if (!r) return;
  const items = (await getRoutineItems(routineId)).map(({ id: _drop, ...rest }) => rest);
  await write(async () => {
    const all = (await db.routines.toArray()).filter(alive).sort(byPosition);
    // Place the copy directly below the original.
    const ordered = all.map((x) => x.id);
    const newRoutineId = await saveRoutine(null, (r.name + " (copy)").slice(0, 40), items);
    ordered.splice(ordered.indexOf(r.id) + 1, 0, newRoutineId);
    await reorder("routines", ordered);
  });
}

export async function deleteRoutine(routineId: string): Promise<() => Promise<void>> {
  const items = (await db.routineExercises.where("routineId").equals(routineId).toArray()).filter(alive).map((i) => i.id);
  await write(async () => {
    await softDelete("routines", routineId);
    await softDelete("routineExercises", items);
  });
  return async () => write(async () => {
    await restore("routines", [routineId]);
    await restore("routineExercises", items);
  });
}

/** Routine items as they were done in a workout (warm-up and working set counts). */
async function itemsFromActivity(activityId: string): Promise<RoutineItemInput[]> {
  const aes = (await db.activityExercises.where("activityId").equals(activityId).toArray()).filter(alive).sort(byPosition);
  const sets = (await db.sets.where("activityId").equals(activityId).toArray()).filter(alive);
  return aes.map((ae) => {
    const mine = sets.filter((s) => s.activityExerciseId === ae.id);
    const warm = mine.filter((s) => s.setType === "warmup").length;
    return { exerciseId: ae.exerciseId, warmupSets: Math.min(5, warm), workingSets: Math.min(10, Math.max(1, mine.length - warm)), note: ae.note };
  });
}

export async function saveWorkoutAsRoutine(activityId: string, name: string): Promise<string> {
  return saveRoutine(null, name, await itemsFromActivity(activityId));
}

export async function updateRoutineFromWorkout(routineId: string, activityId: string): Promise<void> {
  const r = await db.routines.get(routineId);
  if (!r) return;
  const current = await getRoutineItems(routineId);
  const next = await itemsFromActivity(activityId);
  // Keep existing notes for exercises that stay, unless the workout set a new one.
  const merged = next.map((n) => ({ ...n, note: n.note || current.find((c) => c.exerciseId === n.exerciseId)?.note || "" }));
  await saveRoutine(routineId, r.name, merged);
}

/** Describes how a finished workout differs from its routine, or "" when identical. */
export async function routineChanges(routineId: string, activityId: string): Promise<string> {
  const def = await getRoutineItems(routineId);
  const done = await itemsFromActivity(activityId);
  const defIds = def.map((d) => d.exerciseId), ids = done.map((d) => d.exerciseId);
  const t = tr().routines;
  const parts: string[] = [];
  const added = ids.filter((id) => !defIds.includes(id)).length;
  const removed = defIds.filter((id) => !ids.includes(id)).length;
  if (added) parts.push(t.changedAdded(added));
  if (removed) parts.push(t.changedRemoved(removed));
  if (ids.filter((i) => defIds.includes(i)).join() !== defIds.filter((i) => ids.includes(i)).join()) parts.push(t.changedOrder);
  if (done.some((d) => { const x = def.find((y) => y.exerciseId === d.exerciseId); return x && (x.warmupSets !== d.warmupSets || x.workingSets !== d.workingSets); })) parts.push(t.changedSets);
  return parts.join(" · ");
}

type StarterItem = [slug: string, warmup: number, sets: number];
/** Starter routine sets; names come from the dictionary (`routines.starter`), so they are created in the user's language. */
export type StarterKey = "ppl" | "full" | "ul";
export type StarterRoutineKey = "push" | "pull" | "legs" | "full" | "upper" | "lower";
export const STARTERS: Record<StarterKey, Array<[StarterRoutineKey, StarterItem[]]>> = {
  ppl: [
    ["push", [["Barbell_Bench_Press_-_Medium_Grip", 1, 3], ["Standing_Military_Press", 0, 3], ["Incline_Dumbbell_Press", 0, 3], ["Side_Lateral_Raise", 0, 3], ["Triceps_Pushdown", 0, 3]]],
    ["pull", [["Bent_Over_Barbell_Row", 0, 3], ["Pullups", 0, 3], ["Wide-Grip_Lat_Pulldown", 0, 3], ["Face_Pull", 0, 3], ["Dumbbell_Bicep_Curl", 0, 3]]],
    ["legs", [["Barbell_Squat", 1, 3], ["Romanian_Deadlift", 0, 3], ["Leg_Press", 0, 3], ["Lying_Leg_Curls", 0, 3], ["Standing_Calf_Raises", 0, 3]]],
  ],
  full: [
    ["full", [["Barbell_Squat", 1, 3], ["Barbell_Bench_Press_-_Medium_Grip", 0, 3], ["Bent_Over_Barbell_Row", 0, 3], ["Standing_Military_Press", 0, 2], ["Romanian_Deadlift", 0, 2], ["Plank", 0, 2]]],
  ],
  ul: [
    ["upper", [["Barbell_Bench_Press_-_Medium_Grip", 1, 3], ["Bent_Over_Barbell_Row", 0, 3], ["Standing_Military_Press", 0, 3], ["Wide-Grip_Lat_Pulldown", 0, 3], ["Dumbbell_Bicep_Curl", 0, 2], ["Triceps_Pushdown", 0, 2]]],
    ["lower", [["Barbell_Squat", 1, 3], ["Romanian_Deadlift", 0, 3], ["Leg_Press", 0, 3], ["Lying_Leg_Curls", 0, 3], ["Standing_Calf_Raises", 0, 3]]],
  ],
};

export async function addStarter(key: StarterKey): Promise<void> {
  const names = tr().routines.starterRoutine;
  for (const [routine, items] of STARTERS[key]) {
    await saveRoutine(null, names[routine], items.map(([slug, w, s]) => ({ exerciseId: builtinExerciseId(slug), warmupSets: w, workingSets: s, note: "" })));
  }
}

/* ================= Exercises ================= */

export type CustomExerciseInput = Pick<Exercise, "name" | "equipment" | "primaryMuscle" | "trackingType">;

export async function createCustomExercise(input: CustomExerciseInput): Promise<string> {
  const row: Exercise = {
    ...baseRow(), slug: null, name: input.name.trim().slice(0, 60), primaryMuscle: input.primaryMuscle, secondaryMuscles: [],
    equipment: input.equipment, trackingType: input.trackingType, level: null, instructions: [], images: [], isCustom: true,
  };
  await upsert("exercises", row);
  return row.id;
}

export async function updateCustomExercise(id: string, input: CustomExerciseInput): Promise<void> {
  await patch("exercises", id, { ...input, name: input.name.trim().slice(0, 60) });
}

export async function deleteCustomExercise(id: string): Promise<void> {
  await softDelete("exercises", id);
}

export async function setExerciseHidden(exerciseId: string, hidden: boolean): Promise<void> {
  const existing = (await db.exercisePrefs.where("exerciseId").equals(exerciseId).toArray())[0];
  if (existing) await patch("exercisePrefs", existing.id, { hidden, deletedAt: null });
  else await upsert("exercisePrefs", { ...baseRow(), exerciseId, hidden });
}

export async function exerciseUsageCount(exerciseId: string): Promise<number> {
  const aes = (await db.activityExercises.where("exerciseId").equals(exerciseId).toArray()).filter(alive);
  return new Set(aes.map((a) => a.activityId)).size;
}

/* ================= Edit / log past workout ================= */

export interface DraftSet { id: string | null; setType: SetType; weightKg: number | null; reps: number | null; durationS: number | null }
export interface DraftExercise { id: string | null; exerciseId: string; note: string; sets: DraftSet[] }
export interface WorkoutDraft {
  activityId: string | null;
  name: string;
  routineId: string | null;
  startedAt: Date;
  durationMin: number;
  exercises: DraftExercise[];
}

export async function loadDraft(activityId: string): Promise<WorkoutDraft | null> {
  const a = await db.activities.get(activityId);
  if (!a) return null;
  const aes = (await db.activityExercises.where("activityId").equals(a.id).toArray()).filter(alive).sort(byPosition);
  const sets = (await db.sets.where("activityId").equals(a.id).toArray()).filter(alive).sort(byPosition);
  const start = new Date(a.startedAt);
  const end = a.endedAt ? new Date(a.endedAt) : new Date();
  return {
    activityId: a.id, name: a.name, routineId: a.routineId, startedAt: start,
    durationMin: Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)),
    exercises: aes.map((ae) => ({
      id: ae.id, exerciseId: ae.exerciseId, note: ae.note,
      sets: sets.filter((s) => s.activityExerciseId === ae.id).map((s) => ({ id: s.id, setType: s.setType, weightKg: s.weightKg, reps: s.reps, durationS: s.durationS })),
    })),
  };
}

/** Saves an edited (or newly logged) completed workout. All sets count as completed. */
export async function saveDraft(d: WorkoutDraft): Promise<string> {
  const end = new Date(d.startedAt.getTime() + d.durationMin * 60000);
  return write(async () => {
    const prev = d.activityId ? await db.activities.get(d.activityId) : undefined;
    const activity: Activity = {
      ...(prev ?? baseRow()), type: "gym", name: d.name.trim().slice(0, 40) || workoutNameForTime(d.startedAt, currentLanguage()),
      routineId: d.routineId, startedAt: iso(d.startedAt), endedAt: iso(end), status: "completed", notes: prev?.notes ?? "",
    };
    await upsert("activities", activity);
    const oldAes = prev ? (await db.activityExercises.where("activityId").equals(prev.id).toArray()).filter(alive) : [];
    const oldSets = prev ? (await db.sets.where("activityId").equals(prev.id).toArray()).filter(alive) : [];
    const keepAes = new Set(d.exercises.map((e) => e.id).filter(Boolean));
    const keepSets = new Set(d.exercises.flatMap((e) => e.sets.map((s) => s.id)).filter(Boolean));
    await softDelete("activityExercises", oldAes.filter((a) => !keepAes.has(a.id)).map((a) => a.id));
    await softDelete("sets", oldSets.filter((s) => !keepSets.has(s.id)).map((s) => s.id));
    for (const [i, ex] of d.exercises.entries()) {
      if (!ex.sets.length) continue;
      const prevAe = ex.id ? oldAes.find((a) => a.id === ex.id) : undefined;
      const ae: ActivityExercise = { ...(prevAe ?? baseRow()), activityId: activity.id, exerciseId: ex.exerciseId, position: i, note: ex.note };
      await upsert("activityExercises", ae);
      for (const [j, s] of ex.sets.entries()) {
        const prevSet = s.id ? oldSets.find((x) => x.id === s.id) : undefined;
        await upsert("sets", {
          ...(prevSet ?? newSetRow(activity.id, ae.id, j, s.setType)),
          activityId: activity.id, activityExerciseId: ae.id, position: j, setType: s.setType,
          weightKg: s.weightKg, reps: s.reps, durationS: s.durationS, completedAt: prevSet?.completedAt ?? iso(end),
        });
      }
    }
    return activity.id;
  });
}

/* ================= Running (docs/design/screens/running.md) ================= */

export interface ManualRunInput {
  activityId: string | null;
  name: string;
  startedAt: Date;
  distanceM: number;
  movingTimeS: number;
  elevationGainM: number | null;
  avgHr: number | null;
  notes: string;
}

/** A run read from a GPX/FIT file, before it is saved. `totals` are the device's own numbers (FIT), preferred over ours. */
export interface ParsedRunFile {
  source: "gpx" | "fit" | "strava";
  name: string | null;
  startedAt: Date;
  points: TrackPoint[];
  totals: Partial<TrackSummary>;
  /** Strava activity id (Strava imports only): exact duplicate check and "View on Strava". */
  stravaId?: string;
}

async function runOf(activityId: string): Promise<Run | undefined> {
  return (await db.runs.where("activityId").equals(activityId).toArray()).find(alive);
}

/**
 * Creates or edits a run. Imported runs keep their measured numbers; only name, notes and date change.
 */
export async function saveRun(input: ManualRunInput): Promise<string> {
  return write(async () => {
    const prevAct = input.activityId ? await db.activities.get(input.activityId) : undefined;
    const prevRun = prevAct ? await runOf(prevAct.id) : undefined;
    const name = input.name.trim().slice(0, 40) || runNameForTime(input.startedAt, currentLanguage());
    const notes = input.notes.trim().slice(0, 1000);
    if (prevAct && prevRun && prevRun.source !== "manual") {
      const shift = input.startedAt.getTime() - new Date(prevAct.startedAt).getTime();
      await patch("activities", prevAct.id, {
        name, notes, startedAt: iso(input.startedAt),
        endedAt: prevAct.endedAt ? iso(new Date(new Date(prevAct.endedAt).getTime() + shift)) : null,
      });
      return prevAct.id;
    }
    const activity: Activity = {
      ...(prevAct ?? baseRow()), type: "run", name, routineId: null, notes, status: "completed",
      startedAt: iso(input.startedAt), endedAt: iso(new Date(input.startedAt.getTime() + input.movingTimeS * 1000)),
    };
    await upsert("activities", activity);
    await upsert("runs", {
      ...(prevRun ?? baseRow()), activityId: activity.id, source: "manual", hasTrack: false,
      distanceM: input.distanceM, movingTimeS: input.movingTimeS, elevationGainM: input.elevationGainM,
      avgHr: input.avgHr, maxHr: prevRun?.maxHr ?? null, efforts: manualEfforts(input.distanceM, input.movingTimeS),
    } satisfies Run);
    return activity.id;
  });
}

/** Saves an imported run with its track. A run starting within a minute of an existing one is a duplicate. */
export async function importRun(file: ParsedRunFile): Promise<{ activityId: string; duplicate: boolean }> {
  const start = file.startedAt.getTime();
  if (file.stravaId) {
    const same = (await db.runs.toArray()).find((r) => alive(r) && r.stravaId === file.stravaId);
    if (same) return { activityId: same.activityId, duplicate: true };
  }
  // Same start within a minute = the same run (e.g. the FIT file was imported before and now it comes from Strava).
  const runs = (await db.activities.toArray()).filter((a) => alive(a) && a.type === "run");
  const dup = runs.find((a) => Math.abs(new Date(a.startedAt).getTime() - start) < 60_000);
  if (dup) return { activityId: dup.id, duplicate: true };

  const summary = summarizeTrack(file.points);
  const totals = { ...summary, ...Object.fromEntries(Object.entries(file.totals).filter(([, v]) => v !== null && v !== undefined)) } as TrackSummary;
  const dist = cumulativeDistances(file.points);
  const track = downsampleTrack(file.points);
  const hasEle = track.some((p) => p.ele !== null), hasHr = track.some((p) => p.hr !== null);

  return write(async () => {
    const activity: Activity = {
      ...baseRow(), type: "run", name: (file.name?.trim().slice(0, 40)) || runNameForTime(file.startedAt, currentLanguage()), routineId: null,
      startedAt: iso(file.startedAt), endedAt: iso(new Date(start + totals.elapsedS * 1000)), status: "completed", notes: "",
    };
    await upsert("activities", activity);
    await upsert("runs", {
      ...baseRow(), activityId: activity.id, source: file.source, hasTrack: track.length > 1,
      distanceM: Math.round(totals.distanceM), movingTimeS: Math.round(totals.movingTimeS),
      elevationGainM: totals.elevationGainM, avgHr: totals.avgHr, maxHr: totals.maxHr,
      // Without GPS (treadmill FIT) only the device totals exist: count the run as a whole, like a manual one.
      efforts: file.points.length > 1 ? bestEfforts(dist, file.points.map((p) => p.t)) : manualEfforts(totals.distanceM, totals.movingTimeS),
      ...(file.stravaId ? { stravaId: file.stravaId } : {}),
    } satisfies Run);
    if (track.length > 1) {
      await upsert("runTracks", {
        ...baseRow(), activityId: activity.id,
        polyline: encodePolyline(track.map((p) => [p.lat, p.lon])),
        t: track.map((p) => Math.round(p.t)),
        ele: hasEle ? track.map((p) => Math.round((p.ele ?? 0) * 10) / 10) : null,
        hr: hasHr ? track.map((p) => Math.round(p.hr ?? 0)) : null,
      } satisfies RunTrack);
    }
    return { activityId: activity.id, duplicate: false };
  });
}

/** Soft-deletes a run with its totals and track. Returns an undo function. */
export async function deleteRun(activityId: string): Promise<() => Promise<void>> {
  const runs = (await db.runs.where("activityId").equals(activityId).toArray()).filter(alive).map((r) => r.id);
  const tracks = (await db.runTracks.where("activityId").equals(activityId).toArray()).filter(alive).map((r) => r.id);
  await write(async () => {
    await softDelete("activities", activityId);
    await softDelete("runs", runs);
    await softDelete("runTracks", tracks);
  });
  return async () => write(async () => {
    await restore("activities", [activityId]);
    await restore("runs", runs);
    await restore("runTracks", tracks);
  });
}

/* ================= Backup ================= */

export async function exportBackup(): Promise<string> {
  const all = async <T extends { deletedAt?: string | null }>(t: SyncedTable) => ((await db.table(t).toArray()) as T[]);
  const data: Backup["data"] = {
    exercises: (await all<Exercise>("exercises")).filter((e) => e.isCustom),
    exercisePrefs: await all("exercisePrefs"),
    routines: await all("routines"),
    routineExercises: await all("routineExercises"),
    activities: await all("activities"),
    activityExercises: await all("activityExercises"),
    sets: await all("sets"),
    settings: await all("settings"),
    runs: await all("runs"),
    runTracks: await all("runTracks"),
    foods: await all("foods"),
    foodEntries: await all("foodEntries"),
    bodyWeights: await all("bodyWeights"),
  } as Backup["data"];
  const backup: Backup = { app: "fitness-tracker", schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: iso(), data };
  return JSON.stringify(backup);
}

export type ParsedBackup = { ok: true; backup: Backup; workouts: number; runs: number; routines: number; exportedAt: Date } | { ok: false };

export function parseBackup(text: string): ParsedBackup {
  try {
    const result = backupSchema.safeParse(JSON.parse(text));
    if (!result.success) return { ok: false };
    const b = result.data;
    return {
      ok: true, backup: b, exportedAt: new Date(b.exportedAt),
      workouts: b.data.activities.filter((a) => a.deletedAt === null && a.status === "completed" && a.type === "gym").length,
      runs: b.data.activities.filter((a) => a.deletedAt === null && a.status === "completed" && a.type === "run").length,
      routines: b.data.routines.filter((r) => r.deletedAt === null).length,
    };
  } catch {
    return { ok: false };
  }
}

/** Replaces all user data with the backup. Goes through the outbox so it syncs later. */
export async function importBackup(b: Backup): Promise<void> {
  await write(async () => {
    const custom = (await db.exercises.toArray()).filter((e) => e.isCustom).map((e) => e.id);
    await db.exercises.bulkDelete(custom);
    for (const t of SYNCED_TABLES) if (t !== "exercises") await db.table(t).clear();
    for (const t of SYNCED_TABLES) {
      const rows = b.data[t] as Array<{ id: string }>;
      await db.table(t).bulkPut(rows);
      await db.outbox.bulkAdd(rows.map((r) => ({ table: t, rowId: r.id, at: iso() })));
    }
  });
  await stopRest();
}
