import { z } from "zod";
import {
  activityExerciseSchema, activitySchema, exercisePrefSchema, exerciseSchema, routineExerciseSchema, routineSchema,
  runSchema, runTrackSchema, userSettingsSchema, workoutSetSchema,
} from "./schemas";

/* ---------- Accounts (docs/design/screens/login.md, admin-users.md) ---------- */

/** 3–30 characters: letters, digits, _ . - (unique regardless of case). */
export const usernameSchema = z.string().trim().regex(/^[A-Za-z0-9_.-]{3,30}$/, "3–30 characters: letters, numbers, _ . -");

/** At least 8 characters, with at least one digit and one special character. */
export const passwordSchema = z.string()
  .min(8, "At least 8 characters")
  .max(200, "At most 200 characters")
  .regex(/\d/, "At least one number")
  .regex(/[^A-Za-z0-9]/, "At least one special character");

export function passwordRules(pw: string): { length: boolean; number: boolean; special: boolean } {
  return { length: pw.length >= 8, number: /\d/.test(pw), special: /[^A-Za-z0-9]/.test(pw) };
}

export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

export const loginRequestSchema = z.object({ username: z.string().trim().min(1).max(60), password: z.string().min(1).max(200) });
export const changePasswordRequestSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema });

export const accountSchema = z.object({ userId: z.string(), username: z.string(), role: z.enum(ROLES) });
export type Account = z.infer<typeof accountSchema>;

export const adminUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.enum(ROLES),
  disabled: z.boolean(),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
  workouts: z.number().int(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const createUserRequestSchema = z.object({ username: usernameSchema, password: passwordSchema });
export const updateUserRequestSchema = z.object({ password: passwordSchema.optional(), disabled: z.boolean().optional() })
  .refine((v) => v.password !== undefined || v.disabled !== undefined, "Nothing to change");

/* ---------- Sync (docs/architecture/sync.md) ---------- */

/** Every table that syncs, with the schema its rows must match. Built-in exercises (userId null) never sync. */
export const SYNCED_TABLE_SCHEMAS = {
  exercises: exerciseSchema,
  exercisePrefs: exercisePrefSchema,
  routines: routineSchema,
  routineExercises: routineExerciseSchema,
  activities: activitySchema,
  activityExercises: activityExerciseSchema,
  sets: workoutSetSchema,
  settings: userSettingsSchema,
  runs: runSchema,
  runTracks: runTrackSchema,
} as const;
export type SyncTable = keyof typeof SYNCED_TABLE_SCHEMAS;
export const SYNC_TABLES = Object.keys(SYNCED_TABLE_SCHEMAS) as SyncTable[];

export const SYNC_PUSH_MAX = 500;
export const SYNC_PULL_MAX = 1000;

const syncRowSchema = z.object({ id: z.string().min(1).max(100), updatedAt: z.string().min(1) }).passthrough();

export const pushRequestSchema = z.object({
  changes: z.array(z.object({ table: z.enum(SYNC_TABLES as [SyncTable, ...SyncTable[]]), row: syncRowSchema })).max(SYNC_PUSH_MAX),
});
export type PushRequest = z.infer<typeof pushRequestSchema>;

export interface PushResponse {
  accepted: Array<{ table: SyncTable; id: string }>;
  rejected: Array<{ table: SyncTable; id: string; reason: string }>;
}

export interface PullResponse {
  rows: Array<{ table: SyncTable; row: Record<string, unknown> }>;
  cursor: string;
  hasMore: boolean;
}

/* ---------- Strava (docs/adr/0009-strava.md) ---------- */

export interface StravaStatus {
  /** False when the server has no Strava API app configured (STRAVA_CLIENT_ID/SECRET missing). */
  available: boolean;
  connected: boolean;
  athleteName: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
}

/** One Strava run, already converted to the shape of a GPX/FIT import. Dates are ISO strings. */
export interface StravaRun {
  stravaId: string;
  name: string;
  startedAt: string;
  /** Seconds since start; empty for runs without GPS (treadmill). */
  points: Array<{ lat: number; lon: number; t: number; ele: number | null; hr: number | null }>;
  totals: { distanceM: number; movingTimeS: number; elapsedS: number; elevationGainM: number | null; avgHr: number | null; maxHr: number | null };
}

export interface StravaRunsResponse {
  runs: StravaRun[];
  /** Pass back with POST /api/strava/ack after the runs are saved, so the next call continues after them. */
  next: number;
  hasMore: boolean;
}

export const stravaAckSchema = z.object({ next: z.number().int().min(0).max(4_102_444_800) });
