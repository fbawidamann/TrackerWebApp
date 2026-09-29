import { z } from "zod";

/* ---------- Enums ---------- */

export const EQUIPMENT = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band", "other"] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const TRACKING_TYPES = ["weight_reps", "reps_only", "duration", "weight_duration", "distance_duration"] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export const MUSCLES = [
  "chest", "lats", "middle back", "lower back", "traps", "shoulders", "neck",
  "biceps", "triceps", "forearms", "quadriceps", "hamstrings", "glutes", "calves",
  "abductors", "adductors", "abdominals",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Other"] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_TO_GROUP: Record<Muscle, MuscleGroup> = {
  chest: "Chest",
  lats: "Back", "middle back": "Back", "lower back": "Back", traps: "Back",
  shoulders: "Shoulders", neck: "Shoulders",
  biceps: "Arms", triceps: "Arms", forearms: "Arms",
  quadriceps: "Legs", hamstrings: "Legs", glutes: "Legs", calves: "Legs", abductors: "Legs", adductors: "Legs",
  abdominals: "Core",
};

export const LEVELS = ["beginner", "intermediate", "expert"] as const;
export const SET_TYPES = ["normal", "warmup", "drop", "failure"] as const;
export type SetType = (typeof SET_TYPES)[number];
export const ACTIVITY_TYPES = ["gym"] as const;
export const ACTIVITY_STATUS = ["in_progress", "completed"] as const;

/* ---------- Common columns ---------- */

const isoDate = z.string().min(1);

export const syncedBase = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  createdAt: isoDate,
  updatedAt: isoDate,
  deletedAt: isoDate.nullable(),
});
export type SyncedBase = z.infer<typeof syncedBase>;

/* ---------- Entities ---------- */

export const exerciseSchema = syncedBase.extend({
  userId: z.string().min(1).nullable(),
  slug: z.string().nullable(),
  name: z.string().min(1).max(60),
  primaryMuscle: z.enum(MUSCLES),
  secondaryMuscles: z.array(z.enum(MUSCLES)),
  equipment: z.enum(EQUIPMENT),
  trackingType: z.enum(TRACKING_TYPES),
  level: z.enum(LEVELS).nullable(),
  instructions: z.array(z.string()),
  images: z.array(z.string()),
  isCustom: z.boolean(),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const exercisePrefSchema = syncedBase.extend({
  exerciseId: z.string().min(1),
  hidden: z.boolean(),
});
export type ExercisePref = z.infer<typeof exercisePrefSchema>;

export const routineSchema = syncedBase.extend({
  name: z.string().min(1).max(40),
  position: z.number(),
});
export type Routine = z.infer<typeof routineSchema>;

export const routineExerciseSchema = syncedBase.extend({
  routineId: z.string().min(1),
  exerciseId: z.string().min(1),
  position: z.number(),
  warmupSets: z.number().int().min(0).max(5),
  workingSets: z.number().int().min(1).max(10),
  note: z.string().max(120),
});
export type RoutineExercise = z.infer<typeof routineExerciseSchema>;

export const activitySchema = syncedBase.extend({
  type: z.enum(ACTIVITY_TYPES),
  name: z.string().min(1).max(40),
  routineId: z.string().nullable(),
  startedAt: isoDate,
  endedAt: isoDate.nullable(),
  status: z.enum(ACTIVITY_STATUS),
  notes: z.string(),
});
export type Activity = z.infer<typeof activitySchema>;

export const activityExerciseSchema = syncedBase.extend({
  activityId: z.string().min(1),
  exerciseId: z.string().min(1),
  position: z.number(),
  note: z.string().max(120),
});
export type ActivityExercise = z.infer<typeof activityExerciseSchema>;

export const workoutSetSchema = syncedBase.extend({
  activityId: z.string().min(1),
  activityExerciseId: z.string().min(1),
  position: z.number(),
  setType: z.enum(SET_TYPES),
  weightKg: z.number().min(0).max(1000).nullable(),
  reps: z.number().int().min(0).max(999).nullable(),
  durationS: z.number().int().min(0).nullable(),
  distanceM: z.number().min(0).nullable(),
  rpe: z.number().min(0).max(10).nullable(),
  completedAt: isoDate.nullable(),
});
export type WorkoutSet = z.infer<typeof workoutSetSchema>;

/* ---------- Settings ---------- */

export const ACCENTS = ["cobalt", "teal", "amber", "rose", "violet"] as const;
export type Accent = (typeof ACCENTS)[number];
export const WEIGHT_STEPS_KG = [2.5, 1.25, 1, 0.5] as const;

export const userSettingsSchema = z.object({
  id: z.literal("user"),
  userId: z.string().min(1),
  updatedAt: isoDate,
  displayName: z.string().max(30),
  weeklyGoal: z.number().int().min(1).max(7),
  weekStart: z.enum(["monday", "sunday"]),
  defaultSets: z.number().int().min(1).max(5),
  weightStepKg: z.union([z.literal(2.5), z.literal(1.25), z.literal(1), z.literal(0.5)]),
  warmupsInPrs: z.boolean(),
  restTimerEnabled: z.boolean(),
  restSeconds: z.number().int().min(15).max(600),
  restAutostart: z.boolean(),
  theme: z.enum(["system", "dark", "light"]),
  accent: z.enum(ACCENTS),
  navLabels: z.enum(["always", "active"]),
  historyCardStyle: z.enum(["names", "detailed"]),
  weightUnit: z.enum(["kg", "lb"]),
  decimalSeparator: z.enum(["point", "comma"]),
  dateFormat: z.enum(["long", "numeric"]),
  startScreen: z.enum(["home", "workout"]),
  homeShowGoal: z.boolean(),
  homeShowRoutines: z.boolean(),
  homeShowRecent: z.boolean(),
  homeShowPrs: z.boolean(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const DEFAULT_USER_SETTINGS: Omit<UserSettings, "userId" | "updatedAt"> = {
  id: "user",
  displayName: "",
  weeklyGoal: 3,
  weekStart: "monday",
  defaultSets: 3,
  weightStepKg: 2.5,
  warmupsInPrs: false,
  restTimerEnabled: true,
  restSeconds: 90,
  restAutostart: true,
  theme: "system",
  accent: "cobalt",
  navLabels: "always",
  historyCardStyle: "names",
  weightUnit: "kg",
  decimalSeparator: "point",
  dateFormat: "long",
  startScreen: "home",
  homeShowGoal: true,
  homeShowRoutines: true,
  homeShowRecent: true,
  homeShowPrs: true,
};

export const deviceSettingsSchema = z.object({
  keepScreenOn: z.boolean(),
  vibrateOnComplete: z.boolean(),
  textSize: z.enum(["standard", "large"]),
});
export type DeviceSettings = z.infer<typeof deviceSettingsSchema>;
export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = { keepScreenOn: true, vibrateOnComplete: true, textSize: "standard" };

/* ---------- Backup ---------- */

export const BACKUP_SCHEMA_VERSION = 1;
export const backupSchema = z.object({
  app: z.literal("fitness-tracker"),
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: isoDate,
  data: z.object({
    exercises: z.array(exerciseSchema),
    exercisePrefs: z.array(exercisePrefSchema),
    routines: z.array(routineSchema),
    routineExercises: z.array(routineExerciseSchema),
    activities: z.array(activitySchema),
    activityExercises: z.array(activityExerciseSchema),
    sets: z.array(workoutSetSchema),
    settings: z.array(userSettingsSchema),
  }),
});
export type Backup = z.infer<typeof backupSchema>;
