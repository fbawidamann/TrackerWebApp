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
export const ACTIVITY_TYPES = ["gym", "run"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const RUN_SOURCES = ["manual", "gpx", "fit", "strava"] as const;
export type RunSource = (typeof RUN_SOURCES)[number];
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

/* ---------- Running (docs/design/screens/running.md) ---------- */

const hr = z.number().int().min(20).max(255);

/** One per run activity: the totals. Manual runs have only these; imported runs also have a track. */
export const runSchema = syncedBase.extend({
  activityId: z.string().min(1),
  distanceM: z.number().min(0).max(1_000_000),
  /** Moving time (pauses removed). Elapsed time is activity.endedAt − startedAt. */
  movingTimeS: z.number().int().min(0).max(7 * 86_400),
  elevationGainM: z.number().min(0).max(20_000).nullable(),
  avgHr: hr.nullable(),
  maxHr: hr.nullable(),
  source: z.enum(RUN_SOURCES),
  /**
   * Fastest time (s) per standard distance within this run, keyed by metres ("1000", "5000" …).
   * Computed once at import: tracks are never edited, so it can't go stale (docs/architecture/data-model.md).
   */
  efforts: z.record(z.string(), z.number().min(0)),
  hasTrack: z.boolean(),
  /** Strava activity id for runs imported from Strava (docs/adr/0009-strava.md): dedupe + "View on Strava". Optional: older rows have none. */
  stravaId: z.string().regex(/^\d{1,20}$/).nullable().optional(),
});
export type Run = z.infer<typeof runSchema>;

const MAX_TRACK_POINTS = 12_000;

/**
 * The GPS route of an imported run, downsampled to about one point per 5 s.
 * `polyline` = lat/lon in the Google polyline encoding (1e-5°), the arrays are parallel to it.
 */
export const runTrackSchema = syncedBase.extend({
  activityId: z.string().min(1),
  polyline: z.string().max(MAX_TRACK_POINTS * 12),
  /** Seconds since the start. */
  t: z.array(z.number().int().min(0)).max(MAX_TRACK_POINTS),
  /** Metres above sea level, rounded to 0.1 m. */
  ele: z.array(z.number()).max(MAX_TRACK_POINTS).nullable(),
  /** Heart rate in bpm, 0 = no reading. */
  hr: z.array(z.number().int().min(0).max(255)).max(MAX_TRACK_POINTS).nullable(),
});
export type RunTrack = z.infer<typeof runTrackSchema>;

/* ---------- Nutrition (docs/design/screens/nutrition.md, docs/adr/0010-nutrition.md) ----------
   Separate domain, not part of activities. Values per 100 g (or 100 ml); entries keep a snapshot of what was eaten. */

export const FOOD_SOURCES = ["own", "off"] as const;
export const FOOD_UNITS = ["g", "ml"] as const;
export type FoodUnit = (typeof FOOD_UNITS)[number];

const macro = z.number().min(0).max(100);

/** A food: own or copied from Open Food Facts on first use. Values per 100 g / 100 ml. */
export const foodSchema = syncedBase.extend({
  name: z.string().min(1).max(80),
  brand: z.string().max(60).nullable(),
  barcode: z.string().regex(/^\d{6,14}$/).nullable(),
  source: z.enum(FOOD_SOURCES),
  unit: z.enum(FOOD_UNITS),
  kcal: z.number().min(0).max(1000),
  protein: macro,
  carbs: macro,
  fat: macro,
  /** One portion in g/ml (e.g. 1 egg = 60), from the product or set by the user. */
  portion: z.number().min(0.1).max(5000).nullable(),
});
export type Food = z.infer<typeof foodSchema>;

/**
 * One logged food. `name`, `kcal`, `protein`, `carbs`, `fat` are a **snapshot for the eaten amount** (decided
 * 2026-10-04): editing the food later never changes past days.
 */
export const foodEntrySchema = syncedBase.extend({
  foodId: z.string().min(1).nullable(),
  eatenAt: z.string().min(1),
  amount: z.number().min(0.1).max(10_000),
  unit: z.enum(FOOD_UNITS),
  name: z.string().min(1).max(80),
  kcal: z.number().min(0).max(20_000),
  protein: z.number().min(0).max(2_000),
  carbs: z.number().min(0).max(2_000),
  fat: z.number().min(0).max(2_000),
});
export type FoodEntry = z.infer<typeof foodEntrySchema>;

export const bodyWeightSchema = syncedBase.extend({
  measuredAt: z.string().min(1),
  kg: z.number().min(20).max(400),
});
export type BodyWeight = z.infer<typeof bodyWeightSchema>;

/* ---------- Settings ---------- */

export const ACCENTS = ["cobalt", "teal", "amber", "rose", "violet"] as const;
export type Accent = (typeof ACCENTS)[number];
export const WEIGHT_STEPS_KG = [2.5, 1.25, 1, 0.5] as const;
/** UI languages (docs/adr/0007-german-language.md). */
export const LANGUAGES = ["en", "de"] as const;
export type Language = (typeof LANGUAGES)[number];

export const userSettingsSchema = z.object({
  id: z.literal("user"),
  userId: z.string().min(1),
  updatedAt: isoDate,
  displayName: z.string().max(30),
  // Added with German (2026-10-01); rows saved before have no value and count as English.
  language: z.enum(LANGUAGES).default("en"),
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
  // Nutrition (docs/design/screens/nutrition.md, added 2026-10-04). Defaults, so rows saved before stay valid.
  homeShowNutrition: z.boolean().default(true),
  /** Own daily kcal target; null = use the suggestion from body data. */
  kcalTarget: z.number().int().min(800).max(8000).nullable().default(null),
  /** Surplus added to the suggested maintenance kcal (muscle gain). */
  kcalSurplus: z.number().int().min(-1000).max(1000).default(250),
  /** Protein per kg bodyweight (1.5–2.2 usual), used when no own gram target is set. */
  proteinPerKg: z.number().min(1).max(3).default(1.8),
  /** Own protein target in g/day; null = weight × proteinPerKg. */
  proteinTargetG: z.number().int().min(20).max(500).nullable().default(null),
  /** Planned bodyweight change in kg/week (muscle gain ≈ +0.25). */
  weightGainTarget: z.number().min(-1.5).max(1.5).default(0.25),
  sex: z.enum(["male", "female"]).nullable().default(null),
  birthYear: z.number().int().min(1900).max(2100).nullable().default(null),
  heightCm: z.number().int().min(100).max(250).nullable().default(null),
  /** 1 (desk, little movement) … 5 (very active job + training). */
  activityLevel: z.number().int().min(1).max(5).default(3),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const DEFAULT_USER_SETTINGS: Omit<UserSettings, "userId" | "updatedAt"> = {
  id: "user",
  displayName: "",
  language: "en",
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
  homeShowNutrition: true,
  kcalTarget: null,
  kcalSurplus: 250,
  proteinPerKg: 1.8,
  proteinTargetG: null,
  weightGainTarget: 0.25,
  sex: null,
  birthYear: null,
  heightCm: null,
  activityLevel: 3,
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
    // Added with running; optional so older backups still import.
    runs: z.array(runSchema).default([]),
    runTracks: z.array(runTrackSchema).default([]),
    // Added with nutrition (2026-10-04); optional so older backups still import.
    foods: z.array(foodSchema).default([]),
    foodEntries: z.array(foodEntrySchema).default([]),
    bodyWeights: z.array(bodyWeightSchema).default([]),
  }),
});
export type Backup = z.infer<typeof backupSchema>;
