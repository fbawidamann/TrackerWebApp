# Screen: Routines (list, preview, editor)

Status: **decided and approved via prototype** (2026-09-30). Prototype: [08-routines.html](../prototypes/08-routines.html) ([online](https://claude.ai/artifact/BH5EUAkSuhrs2UHtafCSrj)).
Visual tokens and components: [../ui-guidelines.md](../ui-guidelines.md). Milestone: **M3**. Mobile first.

A routine is a **template**: an ordered list of exercises, each with a **number of warm-up and working sets** and an optional **note**. It does **not** store target weights or reps. When a workout is started from a routine, the grey placeholders come from your last session of each exercise.

## Where routines appear
| Place | What |
|---|---|
| **Home** → Routines card | Up to 4 routines, most recently done first. **All** opens the Routines screen |
| **Workout tab** (no workout running) | `Start empty workout`, then **ROUTINES** (all, in your own order) with a **Manage** link to the Routines screen |
| **Routines screen** | The full list in your own order; create, edit, reorder, and so on |
| Workout finish summary | "Update Push Day with these changes?" ([active-workout.md](active-workout.md)) |
| History workout ⋯ | "Save as routine" ([history.md](history.md)) |

There's no Routines tab in the bottom nav.

## Workout tab, idle (no workout running)
```
Workout
[        Start empty workout        ]
ROUTINES                       Manage
┌ card ──────────────────────────────┐
│ Push Day                            │  tap → preview sheet
│ 5 exercises · 16 sets · last Tue  › │
│ …                                   │
└─────────────────────────────────────┘
```

## Routines screen
```
←  Routines                         [+]
┌ card ──────────────────────────────┐
│ Push Day                       [⋯] │  name (17/500)
│ 5 exercises · 16 sets · last Tue    │  meta (13, muted)
│ Pull Day                       [⋯] │
│ …                                   │
└─────────────────────────────────────┘
            Change order                ← ghost button → reorder mode
```
- Reached from Home **All** or Workout **Manage**. The back arrow returns to where you came from.
- Rows are in **your own order**, which is stored in `routines.position`.
  - The meta line shows `5 exercises · 16 sets · last Tue` (or `never done`). The set count includes warm-ups.
- **Tapping a row** opens the **preview sheet**, the same as on Home: the name, `last done …`, the exercise list with set counts, and the buttons **Start workout** and **Edit routine**. Start follows the "one workout at a time" rule.
- **+** opens the editor for a new routine.
- **Change order** switches to reorder mode: rows collapse to name + drag handle, with **Done** in the header (the same pattern as reordering exercises in a workout).

### Row ⋯ menu
| Action | Behaviour |
|---|---|
| **Rename** | Sheet with a name field and Save |
| **Duplicate** | Creates `Push Day (copy)` directly below, and opens nothing |
| **Share** | Copies the routine as plain text to the clipboard, then shows the toast "Copied". The format is below |
| **Delete** | Confirmation: "Delete Push Day? Past workouts stay in History." Then a toast "Routine deleted · Undo" (5 s). Soft delete |

Share text format:
```
Push Day
1. Bench Press (Barbell) · 1 warm-up + 3 sets
2. Incline Press (Dumbbell) · 3 sets
   Note: Seat 3
…
```

### Empty state: starter routines
With no routines, the screen (and Home's Routines card) shows:
```
No routines yet
┌ card ──────────────────────────────┐
│ Push / Pull / Legs          [Add]  │  3 routines
│ Full Body                   [Add]  │  1 routine
│ Upper / Lower               [Add]  │  2 routines
└─────────────────────────────────────┘
[        Create routine        ]
```
**Add** creates the routines, which are fully editable afterwards. Contents (warm-up + working sets):

| Starter | Routines |
|---|---|
| **Push / Pull / Legs** | *Push*: Bench Press (Barbell) 1+3, Overhead Press (Barbell) 3, Incline Press (Dumbbell) 3, Lateral Raise (Dumbbell) 3, Triceps Pushdown (Cable) 3 · *Pull*: Bent-over Row (Barbell) 3, Pull-up 3, Lat Pulldown (Cable) 3, Face Pull (Cable) 3, Biceps Curl (Dumbbell) 3 · *Legs*: Squat (Barbell) 1+3, Romanian Deadlift (Barbell) 3, Leg Press (Machine) 3, Leg Curl (Machine) 3, Calf Raise (Machine) 3 |
| **Full Body** | Squat (Barbell) 1+3, Bench Press (Barbell) 3, Bent-over Row (Barbell) 3, Overhead Press (Barbell) 2, Romanian Deadlift (Barbell) 2, Plank 2 |
| **Upper / Lower** | *Upper*: Bench Press (Barbell) 1+3, Bent-over Row (Barbell) 3, Overhead Press (Barbell) 3, Lat Pulldown (Cable) 3, Biceps Curl (Dumbbell) 2, Triceps Pushdown (Cable) 2 · *Lower*: Squat (Barbell) 1+3, Romanian Deadlift (Barbell) 3, Leg Press (Machine) 3, Leg Curl (Machine) 3, Calf Raise (Machine) 3 |

## Routine editor
A full screen, opened by **+**, **Edit routine**, or after "Save as routine" when you want changes.

```
Cancel        Edit routine          Save
NAME
[ Push Day                              ]
┌ card ──────────────────────────────┐
│ Bench Press                    [⋯] │
│ Barbell                             │
│ Last: 82.5 kg × 6                   │  muted, from last session (if any)
│ Seat 3                              │  note, muted italic (if any)
│ WARM-UP                   − 1 +     │  stepper 0–5
│ SETS                      − 3 +     │  stepper 1–10
└─────────────────────────────────────┘
┌ card: Incline Press … ─────────────┐
[          Add exercise              ]
```
- **Name** is required, max 40 characters.
- **Exercise card**:
  - The name with the equipment on a second line.
  - A `Last: 82.5 kg × 6` line: the heaviest normal set of the last session, or `Last: 12 reps` for reps-only. It's hidden if never done.
  - The note, if any.
  - Two **steppers**: **Warm-up** (0–5, default 0) and **Sets** (1–10, default 3).
  - Steppers have 40 px round − / + buttons, and the number sits between them in 18 px.
  - − is disabled at the minimum and + at the maximum.
- **Exercise ⋯**: *Note* (a sheet with a text field, max 120 characters) · *Replace exercise* · *Reorder exercises* (the reorder mode pattern) · *Remove exercise*.
- **Add exercise** opens the exercise picker in multi-select mode. New exercises get Warm-up 0 and Sets 3.
- **Save** is enabled once there's a name and at least 1 exercise. It returns to where the editor was opened from, with the toast "Routine saved".
- **Cancel** with changes asks "Discard changes?" → *Discard* / *Keep editing*.

## How routines feed workouts
- **Starting** creates one exercise card per routine exercise, with `warm-up` sets first, then `working` sets, all empty. The routine note shows under the exercise name (as the exercise note, editable in the workout).
- **Placeholders** come from the last session of each exercise, never from the routine.
- **"Update routine?"** after finishing compares exercises (added, removed, order) and the number of warm-up / working sets.

## States to design
| State | What is shown |
|---|---|
| Routines list | Cards in your own order, ⋯ per row |
| Reorder mode | Collapsed rows + handles, Done |
| Empty | Starter routines + Create routine |
| Preview sheet | Same as Home |
| Editor new / edit | Name, exercise cards with steppers |
| Discard / Delete confirmations | Bottom sheets, Undo toast after delete |
| Workout tab idle | Start button + routines + Manage |
