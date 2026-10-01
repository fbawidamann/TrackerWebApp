# Data model

The model is defined once by the Zod schemas in `packages/shared`. The **browser** (Dexie/IndexedDB) stores it table by table. The **server** (PostgreSQL via Drizzle) does not repeat each table: it stores every synced row as JSONB in one generic `records` table, validated with the same schemas ([ADR 0005](../adr/0005-backend-auth-and-sync.md)).

## Server tables (apps/api/src/db/schema.ts)

| Table | Columns |
|---|---|
| `users` | `id` uuid, `username` (display form), `username_lower` unique, `password_hash` (scrypt), `role` `admin \| user`, `disabled_at`, `created_at`, `last_login_at`, `last_sync_at` |
| `sessions` | `id` = SHA-256 of the cookie token, `user_id` → users (cascade), `created_at`, `expires_at`, `last_used_at`, `user_agent` |
| `records` | `user_id` → users (cascade), `table_name`, `id`, `updated_at`, `deleted_at`, `server_version` (sequence `sync_version`), `data` jsonb. PK `(user_id, table_name, id)`, index `(user_id, server_version)` |

The browser entities below are what `records.data` holds.

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
- **Naming**: `camelCase` in the rows (also inside `records.data`); `snake_case` for the server's own columns.

## Entities

```
exercises ─────────────┐
                       │
routines ─< routine_exercises (warm-up / working set counts, note)
                       │
activities ─< activity_exercises ─< sets     (type = gym)
           ├─ runs (1 per run)                 (type = run)
           └─ run_tracks (0–1 per run)
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
| type | enum | `gym`, `run`; `swim` later |
| name | text | e.g. routine name, "Evening workout" or "Evening run" |
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

### runs → run_tracks (running)
Decisions in [ADR 0006](../adr/0006-running.md), screens in [running.md](../design/screens/running.md). A run is an `activities` row with `type = run`, `status = completed`, `routine_id = null` and `ended_at = started_at + elapsed time`.

**runs** (one per run, small, read by every list):

| Field | Type | Notes |
|---|---|---|
| activity_id | uuid | |
| distance_m | numeric | |
| moving_time_s | int | pauses removed; elapsed = `ended_at − started_at` |
| elevation_gain_m | numeric? | |
| avg_hr / max_hr | int? | bpm |
| source | enum | `manual`, `gpx`, `fit` |
| efforts | {metres: seconds} | fastest time per standard distance inside the run (`"1000"`, `"5000"` …), computed once at import |
| has_track | bool | |

**run_tracks** (0–1 per run, only for imported runs with GPS):

| Field | Type | Notes |
|---|---|---|
| activity_id | uuid | |
| polyline | text | lat/lon, Google polyline encoding (1e-5°) |
| t | int[] | seconds since start, parallel to the polyline points |
| ele | numeric[]? | metres, 0.1 m |
| hr | int[]? | bpm, 0 = no reading |

Downsampled to ~1 point per 5 s, max 10 000 points. Splits, pace/elevation/HR charts and the route are derived from it on display.

### user_settings
Synced per-user settings (full list and defaults in [profile.md](../design/screens/profile.md#settings-reference)):
display_name, language (en | de; first default from the browser language), weekly_goal (3), week_start (monday), default_sets (3), weight_step_kg (2.5), warmups_in_prs (false), rest_timer_enabled (true), default_rest_seconds (90), rest_autostart (true), theme (system), accent (cobalt), nav_labels (always), history_card_style (names), weight_unit (kg | lb), decimal_separator (point | comma), date_format (long | numeric), start_screen (home), home_show_goal / home_show_routines / home_show_recent / home_show_prs (true).

Device-only settings (Dexie `meta`, never synced): keep_screen_on (true), vibrate_on_complete (true), text_size (standard | large).

Rest-timer state (`restStartedAt`, the set it belongs to) is local UI state in Dexie `meta`. It is not synced.

### Later
- **swim**: a new child table (e.g. `swims`: activity_id, distance_m, moving_time_s, pool_length_m?, laps?) and a new `activities.type` value, like running. No new columns on `activities`.
- **food**: separate domain (`foods`, `meals`, `meal_entries`), not part of `activities`.

## Derived metrics (computed, never stored)
- **Heaviest-weight PR**: max `weight_kg` over the completed normal sets of an exercise. It is a PR when it beats every earlier session.
- **Best set reps**: max `reps` over completed normal sets per session (Reps chart).
- **e1RM** (Epley): `weight × (1 + reps / 30)`, reps ≤ 12 only. Shown only in the workout detail footer, not charted.
- **Running**: pace, splits, period totals, weekly distance and personal bests (fastest `efforts` value per distance over all runs). Only `runs.efforts` is stored, because it needs the full-resolution track ([ADR 0006](../adr/0006-running.md)).
- **Last used / session count** per exercise (for list sorting): derived from completed activities.
- **Volume**: `weight × reps`, per set, per exercise per session, and per muscle group per week.

Why derived: nothing extra to keep in sync, and editing an old workout automatically corrects all PRs and charts.
