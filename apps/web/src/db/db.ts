import Dexie, { type EntityTable } from "dexie";
import type {
  Activity, ActivityExercise, Exercise, ExercisePref, Routine, RoutineExercise, UserSettings, WorkoutSet,
} from "@fitness/shared";

/** One pending change for the sync engine (M8). */
export interface OutboxEntry {
  seq?: number;
  table: SyncedTable;
  rowId: string;
  at: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class FitnessDb extends Dexie {
  exercises!: EntityTable<Exercise, "id">;
  exercisePrefs!: EntityTable<ExercisePref, "id">;
  routines!: EntityTable<Routine, "id">;
  routineExercises!: EntityTable<RoutineExercise, "id">;
  activities!: EntityTable<Activity, "id">;
  activityExercises!: EntityTable<ActivityExercise, "id">;
  sets!: EntityTable<WorkoutSet, "id">;
  settings!: EntityTable<UserSettings, "id">;
  outbox!: EntityTable<OutboxEntry, "seq">;
  meta!: EntityTable<MetaEntry, "key">;

  constructor(name = "fitness") {
    super(name);
    this.version(1).stores({
      exercises: "id, name, isCustom",
      exercisePrefs: "id, exerciseId",
      routines: "id, position",
      routineExercises: "id, routineId",
      activities: "id, status, startedAt",
      activityExercises: "id, activityId, exerciseId",
      sets: "id, activityId, activityExerciseId",
      settings: "id",
      outbox: "++seq, table",
      meta: "key",
    });
  }
}

export const SYNCED_TABLES = [
  "exercises", "exercisePrefs", "routines", "routineExercises", "activities", "activityExercises", "sets", "settings",
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

export let db = new FitnessDb();

/** Tests swap in a fresh database. */
export function setDb(next: FitnessDb): void {
  db = next;
}

/** User id for local-only mode. Replaced by the real account id on first login (M8). */
export const LOCAL_USER = "local";
