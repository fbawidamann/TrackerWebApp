# Screen: Active workout

Status: **decided and approved via prototype** (2026-09-29). The core screen of the app: logging sets in the gym.
Visual tokens and component styles: [../ui-guidelines.md](../ui-guidelines.md). Milestone: **M2** (routine parts in **M3**).
Clickable prototype: [Active workout prototype](https://claude.ai/artifact/8fUksA5BrRJ7BEkeS79xCo).

## Layout (top to bottom)

```
┌──────────────────────────────────────┐
│ Evening workout            [Finish]  │  title (tap → rename), primary button
│ 34:12                          [⋯]   │  elapsed time, workout menu
├──────────────────────────────────────┤
│ ┌ card ────────────────────────────┐ │
│ │ Bench Press                 [⋯]  │ │  exercise name
│ │ Barbell                          │ │  equipment, 2nd line, muted
│ │ SET  PREVIOUS   KG   REPS   ✓    │ │  uppercase labels
│ │ W    60 × 10   [60] [10]   [✓]   │ │  done → tinted row
│ │ 1    80 × 8    [80] [ 8]   [✓]   │ │
│ │ 2    80 × 8    [  ] [  ]   [ ]   │ │  empty, grey placeholders
│ │ + Add set                        │ │
│ └──────────────────────────────────┘ │
│ ┌ card: next exercise …            │ │  further exercise cards
│ [ Add exercise ]                     │
│                                      │
│  ( REST ▬▬▬▬▬▬░░░ 0:56   Skip )      │  floating pill, only after a set
├──────────────────────────────────────┤
│ Home History Workout Exercises Prof. │  bottom nav
└──────────────────────────────────────┘
```

There is **no separate "Next exercise" card**. All exercises are shown as full cards one below the other, so a preview card would only repeat the card below it (confirmed with the prototype).

## Workout tab when no workout is running
It shows **Start empty workout** and your routines with a **Manage** link. See [routines.md](routines.md#workout-tab-idle-no-workout-running).

## Starting a workout
- **Empty workout** (Home → "Start empty workout"): the name comes from the time of day: *Morning workout* (before 12:00), *Afternoon workout* (12–17), *Evening workout* (from 17:00). Tap the title to rename.
- **From a routine** (M3): the name is the routine name. One card is created per routine exercise, with the routine's number of sets.
- **Only one workout can be in progress.** Starting another while one is running asks: *Resume "Push Day"* / *Discard it and start new*.
- The workout is written to Dexie immediately (`activities.status = in_progress`, `startedAt = now`).

## Set table

### Columns
`SET · PREVIOUS · KG · REPS · ✓`
- **SET**: `W` for a warm-up, drawn lighter than the numbers (13 px, weight 500, accent blended towards muted). Otherwise `1, 2, 3…`, counting only non-warm-up sets.
- **PREVIOUS**: the same set position (same type) from the **last completed session** of this exercise, e.g. `80 × 8`. Shows `–` if there is none.
- **KG / REPS**: outlined inputs, **empty by default**, showing the previous values as grey placeholders. With no previous data, the row above is used; otherwise the fields stay empty.
  - Inputs use the phone keyboard: `inputmode="decimal"` for kg, `inputmode="numeric"` for reps. Enter/Next moves kg → reps → the next set's kg.
- The columns depend on the exercise's `tracking_type`: `reps_only` → REPS only; `duration` → TIME (mm:ss); `weight_duration` → KG + TIME.

### The ✓ (done) button
- **Empty fields take the grey placeholder values** (previous session or the row above; routines have no targets). Repeating last time is one tap, and you only type what changed.
- Only when there is no placeholder at all (e.g. an exercise never done before) does the button look inactive. Tapping it then briefly highlights the empty field.
- Tapping ✓ sets `completedAt`, tints the row, removes the input outlines and **starts the rest timer**.
- Tapping ✓ again un-completes the set (the tint goes away, the values stay).
- Validation:
  - kg: 0–999.75, in steps of 0.25 (a comma is accepted as the decimal separator on input).
  - reps: whole number, 1–999.

### Set actions
- **Tap the set number** → small menu: *Warm-up* / *Normal* / *Delete set*.
- **Swipe a row left** → *Delete*. A short "Set deleted · Undo" message follows. The red delete background is only rendered **while swiping**, so no red shows at the rounded corners at rest.
- **+ Add set** adds a row below. Its placeholders come from the previous session's matching set, or from the last row of this workout.

## Exercise card menu (⋯)
- **Replace exercise**: opens the exercise picker (single choice) and keeps the logged sets.
- **Note**: a short note for this exercise in this workout, shown muted under the name (e.g. "Seat height 4").
- **Reorder exercises**: enters reorder mode (below).
- **Remove exercise**: asks for confirmation if any set is done.

(Per-exercise rest time was dropped. The rest time is a single global setting.)

### Reorder mode
All cards collapse to a single line (name + drag handle). You drag to reorder, and **Done** returns to normal view. The same mode is also reachable from the workout menu.

## Workout menu (⋯ in the header)
*Reorder exercises* · *Discard workout* (confirmation: "Discard this workout? Logged sets will be deleted.").

## Adding exercises
**Add exercise** opens the exercise picker in **multi-select** mode: search, muscle and equipment filters, and ticks. The button reads **"Add 3"**. Each added exercise gets as many empty sets as its last session had (or 1 if there is none).

## Rest timer
- Starts automatically when a set is completed, using the global default (90 s, set in Settings).
- Shown as a **floating pill above the bottom nav**: `REST ▬▬░░ 0:56 Skip`. You can tap the time to add or subtract 15 s.
- **When it reaches zero, it doesn't vibrate or play a sound.** It turns into a muted count-up, `+0:12`, until the next set is completed or Skip is tapped.
- Completing another set restarts it.
- It is computed from the timestamp (`restStartedAt`), not counted in memory, so it stays correct after a reload or with the screen locked.

## Leaving the screen
Navigating elsewhere while a workout is running shows a **mini bar above the bottom nav** on every screen: `Push Day · 34:12 ›`. Tap it to return. If the rest timer is running, the mini bar shows it too (`Rest 0:41`).

## Screen stays on
While the active workout screen is open, the app requests a screen **wake lock** so the screen doesn't dim between sets. This can be turned off in Settings. It is re-requested when the tab becomes visible again, and silently ignored if the browser doesn't support it.

## Finishing
1. Tap **Finish**.
2. If there are unfinished sets: "**Discard 3 unfinished sets?**" → *Discard and finish* / *Keep logging*. Unfinished sets are soft-deleted, and exercises left with no sets are removed.
   - If **no** set is done at all: "Nothing logged. Discard workout?"
3. The workout is saved: `status = completed`, `endedAt = now`, and sync is triggered.
4. A **summary screen** shows:
   - The title, date and duration.
   - Tiles **Duration · Sets · PRs** (no volume, decided 2026-09-30).
   - **New PRs** with the medal icon: "Bench Press · 82.5 kg (was 80 kg)".
   - The exercises list, compact.
   - If the workout came from a routine and differs from it (exercises added/removed/reordered, or a different number of sets): "**Update Push Day with these changes?**" → *Update routine* / *Keep routine*.
   - A **Done** button → Home.

## Persistence and edge cases
- Every change is written to Dexie at once via `upsert()`, so nothing is lost on reload, if the app is killed, or offline. On app start, an `in_progress` activity opens the mini bar and resumes, and the elapsed time is computed from `startedAt`.
- Elapsed time is always `now − startedAt`, which is correct after sleep or reload.
- A workout left in progress for more than 12 h: on the next app start, ask "*Finish or discard the workout from yesterday?*"
- Deleting (sets, exercises, a discarded workout) is always a soft delete (`deletedAt`), because of sync.

## States to design
| State | What is shown |
|---|---|
| Empty workout, no exercises | Title, timer, a large **Add exercise** button and one short line of hint text |
| In progress | As in the layout above |
| Reorder mode | Collapsed cards with drag handles and a **Done** button |
| Rest running / over | Floating pill counting down / muted `+0:12` |
| Finish confirmation | Bottom-sheet dialog |
| Summary | Separate screen, see Finishing |
