# Data model

The same model exists twice: in the browser (Dexie/IndexedDB) and on the server (PostgreSQL via Drizzle). The Zod schemas in `packages/shared` define it once for both.

## Conventions

- **IDs**: `uuid`, generated on the client.
  - User data uses **UUIDv7**. It is time-ordered, so it sorts well and indexes efficiently.
  - Built-in exercises use a **UUIDv5** derived from the free-exercise-db id, so it is identical on every device.
- **Common columns** on every synced table:
  - `id`
  - `user_id`: copied onto child tables too, so every access check is a simple `WHERE user_id = ?`
  - `created_at`, `updated_at`: UTC ISO timestamps
  - `deleted_at`: soft delete, `null` = alive
- **Server-only column**: `server_version bigint`, taken from a global sequence on every write and used as the sync cursor. See [sync.md](sync.md).
- **Units**: kg, meters, seconds. Conversion happens only when displaying.
- **Naming**: `snake_case` in Postgres, `camelCase` in TypeScript/Dexie (Drizzle maps them).

## Entities

```
exercises ─────────────┐
                       │
routines ─< routine_exercises (warm-up / working set counts, note)
                       │
activities ─< activity_exercises ─< sets
   (type = gym | run | swim …)
user_settings (1 per user)
```

### exercises
| Field | Type | Notes |
|---|---|---|
| name | text | |
| primary_muscle | enum | e.g. chest, quadriceps, lats … (from the catalog) |
| secondary_muscles | enum[] | |
| equipment | enum | barbell, dumbbell, machine, cable, bodyweight, kettlebell, band, other |
| tracking_type | enum | `weight_reps`, `reps_only`, `duration`, `weight_duration`, `distance_duration`; decides which inputs the set row shows |
| level | enum? | beginner / intermediate / expert |
| instructions | text[] | |
| images | text[] | relative paths |
| is_custom | bool | built-in rows: `user_id = null`, read-only, never synced |

### exercise_prefs
Per-user settings for **any** exercise, including built-in ones (which are read-only and never synced themselves):

| Field | Type | Notes |
|---|---|---|
| exercise_id | uuid | built-in or custom |
| hidden | bool | hidden from list and picker; history stays visible |

Synced like other user data. One row per user and exercise, created on first change.

### routines → routine_exercises
- **routines**: name, position (the user's manual order)
- **routine_exercises**: routine_id, exercise_id, position, warmup_sets (0–5), working_sets (1–10), note

Routines store **no target weights or reps** (decided 2026-09-30). Placeholders always come from the last session. The earlier `routine_sets` table was dropped.

### activities (timeline spine)
| Field | Type | Notes |
|---|---|---|
| type | enum | `gym` now; `run`, `swim` later |
| name | text | e.g. routine name or "Evening workout" |
| routine_id | uuid? | the routine it was started from |
| started_at / ended_at | timestamp | `ended_at` is null while in progress |
| status | enum | `in_progress`, `completed` |
| notes | text? | |

### activity_exercises → sets (gym)
- **activity_exercises**: activity_id, exercise_id, position, notes (no per-exercise rest time; the rest timer uses `user_settings.default_rest_seconds`)
- **sets**:

| Field | Type | Notes |
|---|---|---|
| activity_exercise_id | uuid | |
| position | int | order within the exercise |
| set_type | enum | `normal`, `warmup`, `drop`, `failure`; the UI starts with normal/warmup |
| weight_kg | numeric? | |
| reps | int? | |
| duration_s | int? | for duration-based exercises |
| distance_m | numeric? | |
| rpe | numeric? | in the schema, not in the MVP UI |
| completed_at | timestamp? | set is "done" when not null |

### user_settings
weight_unit (`kg`, `lb` later), default_rest_seconds (90), keep_screen_on (true), weekly_goal (1–7, default 3), week_start (monday).

Rest-timer state (`restStartedAt`, the set it belongs to) is local UI state in Dexie `meta`. It is not synced.

### Later
- **run/swim**: new child table (e.g. `cardio_details`: activity_id, distance_m, duration_s, pool_length_m?, laps?) and a new `activities.type` value. No new columns on `activities`.
- **food**: separate domain (`foods`, `meals`, `meal_entries`), not part of `activities`.

## Derived metrics (computed, never stored)
- **Heaviest-weight PR**: max `weight_kg` over the completed normal sets of an exercise. It is a PR when it beats every earlier session.
- **Best set reps**: max `reps` over completed normal sets per session (Reps chart).
- **e1RM** (Epley): `weight × (1 + reps / 30)`, reps ≤ 12 only. Shown only in the workout detail footer, not charted.
- **Last used / session count** per exercise (for list sorting): derived from completed activities.
- **Volume**: `weight × reps`, per set, per exercise per session, and per muscle group per week.

Why derived: nothing extra to keep in sync, and editing an old workout automatically corrects all PRs and charts.
