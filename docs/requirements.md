# Requirements

Status: agreed on 2026-09-29.

## Product

| Topic | Decision |
|---|---|
| Users | Just me for now, but multi-user ready: accounts exist and every row has a `user_id` |
| Scope order | 1. Gym → 2. Running + swimming → 3. Food tracking |
| Language | English UI only |
| Devices | Phone in the gym (mobile-first, installable as a PWA); desktop mainly for stats and history |
| Offline | Offline-first: logging must work fully without reception, and data syncs when online |
| Login | Email + password (more methods possible later) |
| Hosting | Own VPS with Docker Compose |
| Code hosting / CI | GitHub + GitHub Actions |

## Gym tracking

### Workouts
- Start a workout **from a routine** (template) or as an **empty/freeform** workout.
- Add, remove and reorder exercises during a workout.
- Each exercise has a set table: `Set | Previous | kg | Reps | ✓`.
- An in-progress workout survives a page reload or the app being closed.
- Past workouts can be viewed and edited.

### Home (details in [design/screens/home.md](design/screens/home.md))
- The title is the date. A weekly goal line shows e.g. "2 of 3 workouts this week" (goal 1–7, default 3).
- A Start button, or a Resume card while a workout is running.
- Routines (tap → preview → Start), the 3 most recent workouts, and the 3 latest PRs.

### Routines
- Create and edit routines: an ordered list of exercises with planned sets (optional target reps/weight).
- A finished workout can be saved as a new routine.

### Prefill ("Previous")
- The **Previous** column shows the same set of the **last completed session** of that exercise, e.g. `80 kg × 8`.
- Empty inputs show that value as a grey **placeholder**. Completing the set with ✓ takes the placeholder as the real value.
- Routine target sets decide how many sets are created, and their targets are used when there is no previous data.

### Personal records
- Only one PR type: **heaviest weight** per exercise (completed, normal sets only).
- PRs are detected when a workout is finished and shown in the finish summary. History marks them with a badge.
- Charts additionally show estimated 1RM (Epley) and volume trends, but these do **not** count as PRs.

### Rest timer
- Low priority for the user. Keep it simple: it starts after a set is ticked off and uses one global default (90 s, set in Settings). **There is no per-exercise override.**
- When it reaches zero there is no sound or vibration; it counts up (`+0:12`).

### Logging rules (details in [design/screens/active-workout.md](design/screens/active-workout.md))
- Tapping ✓ on a set with empty kg/reps **uses the grey "previous" values**. You only type what changed. If there are no previous values, the fields must be typed.
- Only one workout can be in progress at a time. The screen stays on during a workout (can be turned off in Settings).
- Finishing asks before discarding unfinished sets, then shows a summary with new PRs. A workout started from a routine that was changed offers to update the routine.

### Exercises
- Built-in catalog of 800+ exercises from free-exercise-db (see [ADR 0003](adr/0003-exercise-catalog.md)), with instructions and images.
- Users can create custom exercises.
- Search and filter by muscle group and equipment.

### Units
- Stored as kg. The UI shows **kg only** for now. A lb setting exists in the data model and will be added later.

## Design
Dark by default + light theme. Plain and calm, not "AI style". Readability first. Details in [design/ui-guidelines.md](design/ui-guidelines.md).

## Later phases (not planned in detail yet)
- Running and swimming: manual entry first (distance, duration, laps/pool length); GPX import maybe.
- Food tracking: foods, meals, calories/macros. A separate domain from activities.
- Body measurements (bodyweight etc.): not in the MVP.
