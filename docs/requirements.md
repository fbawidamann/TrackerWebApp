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

### History (details in [design/screens/history.md](design/screens/history.md))
- Workouts grouped by week (`THIS WEEK · 2 workouts`). Each card shows the name, date, duration and a PR medal, then the exercise names as one calm line (max 2 lines). Numbers appear only for PRs (`Bench Press  82.5 kg`).
- **No volume shown anywhere** in the workout UI (list, detail, Home, finish summary).
- Search by exercise name, and filter by routine (including Freeform).
- A calendar (icon in the History header) marks training days with a small blue dot. Tapping a day shows that day's workouts.
- Workout detail actions: Edit, Repeat, Save as routine, Delete (with Undo).
- Edit mode uses the logging layout without ✓ and can change the name, date, start time, duration and notes.
- Workouts can be logged afterwards ("Log past workout").

### Routines (details in [design/screens/routines.md](design/screens/routines.md))
- A routine is an ordered list of exercises, each with a number of warm-up and working sets (− / + steppers) and an optional note. There are **no target weights or reps**.
- The Routines screen is reached from Home "All" and the Workout tab "Manage" (no own nav tab). It's in your own order (Change order → drag).
- Tapping a routine opens the preview (Start / Edit). The ⋯ menu has Rename, Duplicate, Share (copy as text) and Delete (with Undo).
- With no routines, 3 starter sets are offered: Push/Pull/Legs, Full Body, Upper/Lower.
- A finished workout can be saved as a new routine.

### Prefill ("Previous")
- The **Previous** column shows the same set of the **last completed session** of that exercise, e.g. `80 kg × 8`.
- Empty inputs show that value as a grey **placeholder**. Completing the set with ✓ takes the placeholder as the real value.
- A routine decides how many warm-up and working sets are created. Routines have no target values.

### Personal records
- Only one PR type: **heaviest weight** per exercise (completed, normal sets only).
- PRs are detected when a workout is finished and shown in the finish summary. History marks them with a badge.
- Exercise charts show **heaviest weight** and **best set reps** per session (one chart with a Weight/Reps switch, range 3M/6M/1Y/All). There are no e1RM or volume charts.
- e1RM (Epley) appears only as a small figure in the workout detail footer (`Best 82.5 kg · e1RM 99 kg`). It never counts as a PR.

### Rest timer
- Low priority for the user. Keep it simple: it starts after a set is ticked off and uses one global default (90 s, set in Settings). **There is no per-exercise override.**
- When it reaches zero there is no sound or vibration; it counts up (`+0:12`).

### Logging rules (details in [design/screens/active-workout.md](design/screens/active-workout.md))
- Tapping ✓ on a set with empty kg/reps **uses the grey "previous" values**. You only type what changed. If there are no previous values, the fields must be typed.
- Only one workout can be in progress at a time. The screen stays on during a workout (can be turned off in Settings).
- Finishing asks before discarding unfinished sets, then shows a summary with new PRs. A workout started from a routine that was changed offers to update the routine.

### Exercises (details in [design/screens/exercises.md](design/screens/exercises.md))
- Built-in catalog of 800+ exercises from free-exercise-db (see [ADR 0003](adr/0003-exercise-catalog.md)), with instructions and images. Images appear only on the exercise detail page.
- The list shows your exercises first, then all exercises. Search is always visible. A filter button opens sorting (recently used, A–Z, muscle group, most used) and filters (muscle group, equipment, show hidden).
- Exercise detail tabs: Progress (chart + PR history), History (past sessions), About (images, muscles, instructions).
- Custom exercises: name, equipment, primary muscle, type. They can be edited and deleted (history stays).
- Any exercise can be hidden from the list and picker.

### Units
- Stored as kg. The UI shows **kg only** for now. A lb setting exists in the data model and will be added later.

## Design
Dark by default + light theme. Plain and calm, not "AI style". Readability first. Details in [design/ui-guidelines.md](design/ui-guidelines.md).

## Later phases (not planned in detail yet)
- Running and swimming: manual entry first (distance, duration, laps/pool length); GPX import maybe.
- Food tracking: foods, meals, calories/macros. A separate domain from activities.
- Body measurements (bodyweight etc.): not in the MVP.
