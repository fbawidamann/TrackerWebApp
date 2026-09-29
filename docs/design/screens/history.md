# Screen: History (list, workout detail, edit, log past workout)

Status: **decided and approved via prototype** (2026-09-30). Prototype: [07-history.html](../prototypes/07-history.html) ([online](https://claude.ai/artifact/3UG3JA7QxC7TycbGFdN4C3)).
Visual tokens and components: [../ui-guidelines.md](../ui-guidelines.md). Milestone: **M4**. **Mobile first.** Desktop is low priority: a simple list-left / detail-right layout is enough.

Readability is the top priority on this screen: generous spacing, clear hierarchy, and no volume numbers.

## History list

```
┌──────────────────────────────────────┐
│ History                     [📅] [+] │  calendar icon, + = log past workout
│ [ Search exercise        ] [≡ 1]     │  search + filter button (as in Exercises)
│ (Push Day ×)                         │  active filter chips
│                                      │
│ THIS WEEK · 2 WORKOUTS               │  week header
│ ┌ card (see "Workout card") ───────┐ │
│ │ Push Day                    [PR] │ │  name (+ medal if PR)
│ │ Tuesday, 29 September · 58 min   │ │  date · duration, muted
│ │ Bench Press · Incline Press · …  │ │  exercise names, max 2 lines
│ │ ─────────────────────────────── │ │
│ │ [PR] Bench Press        82.5 kg  │ │  numbers only for PRs
│ └──────────────────────────────────┘ │
│ ┌ card: Pull Day … ────────────────┐ │
│ LAST WEEK · 3 WORKOUTS               │
│ 14–20 SEPTEMBER · 3 WORKOUTS         │
└──────────────────────────────────────┘
```

### Week sections
- Weeks run Monday to Sunday. Headers:
  - `THIS WEEK · 2 workouts`
  - `LAST WEEK · 3 workouts`
  - then the date range, `14–20 SEPTEMBER · 3 workouts`, or `28 SEPTEMBER – 4 OCTOBER` across months, adding the year when it isn't the current year.
- Weeks without workouts are skipped. The number of workouts is the only figure: no volume, no time.

### Workout card: style "Names only"
Chosen out of four styles on 2026-09-30. The per-exercise "sets · best" lines felt overwhelming with 5–6 exercises.

```
┌ card ─────────────────────────────────┐
│ Push Day                          [🏅] │  name + medal if any PR
│ Tuesday, 29 September · 58 min         │  date · duration (muted)
│                                        │
│ Bench Press · Incline Press · Triceps  │  exercise names, one muted text,
│ Pushdown · Lateral Raise               │  max 2 lines (ellipsis)
│ ────────────────────────────────────── │  faint divider, only if a PR
│ 🏅 Bench Press               82.5 kg   │  one line per PR exercise
└────────────────────────────────────────┘
```
(The 🏅 in the sketch stands for the lucide `award` icon. No emoji is used in the UI.)

- **Line 1**: the workout name (17 px, 600), with a **medal icon** on the right if the workout set a PR.
- **Line 2**: `Tuesday, 29 September · 58 min` (14 px, muted).
- **Exercise names**: all exercises as one text, joined with ` · `, 15 px, muted, clamped to **2 lines**. Cards stay roughly the same height no matter how many exercises there are.
- **PR lines**: numbers appear **only for PRs**. Below a faint `card-divider` line there is one line per PR exercise: the medal (15 px), the exercise name, and the weight on the right (600). If there are no PRs, there's no divider and no lines.
- **Search hit**: the matching exercise name inside the names text is shown in `accent-text` (500).
- Tapping the card opens the **workout detail**. No volume, no set counts in the list; all numbers are in the detail.
- The same card is used in the **calendar** day list.

### Search and filter (same pattern as Exercises)
- The **search** field searches exercise names and shows only workouts that contain a match. The matching exercise name is highlighted in `accent-text`.
- The **filter button** (sliders icon) opens a sheet with **ROUTINE** chips, multi-select: every routine plus **Freeform** (workouts not started from a routine). It has **Reset** and **Show 12 workouts** buttons.
- Active filters appear as removable chips under the search, and the filter button shows a count badge.
- **No results**: `No workouts found`.
- **No workouts at all**: `No workouts yet` and a **Start empty workout** button.

The list loads older weeks as you scroll (it's paged).

## Calendar
The **calendar icon** (lucide `calendar`, the 📅 in the sketch) in the History header opens a calendar view, added on 2026-09-30 at the user's request.

```
←            Calendar
┌ card ──────────────────────────────┐
│  ‹      September · 9 workouts   › │  month + count; › disabled for future months
│  M   T   W   T   F   S   S         │
│  1   2   3   4   5   6             │
│  •   •       •       •             │  small accent dot = trained that day
│ 28  29  30                         │  today = number in accent; selected = tinted square
│  •   •                             │
└────────────────────────────────────┘
TUESDAY, 29 SEPTEMBER
┌ workout card (same as in the list) ┐   tap → workout detail (back returns to calendar)
```

- It opens on the current month, with the **most recent training day** selected and that day's workouts shown below.
- Days with a workout show a **small dot** (`accent`) under the number. Days without workouts have muted numbers. Future days are disabled.
- **Tapping a day** selects it (tinted square) and lists its workouts below, using the same workout cards as the list. A day with no workout shows `No workout on this day`.
- ‹ › switch months; switching selects that month's latest training day. Weeks start on Monday.
- The calendar always shows **all** workouts and ignores the search and routine filter.
- Back from a workout detail opened here returns to the calendar.

## Workout detail

```
← back                                  ⋯
Push Day
Tuesday, 29 September · 17:35–18:33
From Push Day routine                      ← only if started from a routine (muted)
┌ Duration │ Sets │ PRs ┐                 ← three tiles, no volume
┌ card: Bench Press / Barbell ───────────┐
│ W   60 kg × 10                          │
│ 1   80 kg × 8                           │
│ 3   82.5 kg × 6                    [PR] │
│ Best 82.5 kg · e1RM 99 kg               │
└─────────────────────────────────────────┘
```

- Exercise cards follow the component spec in the UI guidelines: the name with the equipment on a second line, faint lines between sets, a light `W`, a medal on the PR set, the footer `Best … · e1RM …`, and the note (muted, italic) under the name.
- Tapping an exercise name opens its **exercise detail**.
- **Summary tiles**: **Duration · Sets · PRs**.

### ⋯ menu
| Action | Behaviour |
|---|---|
| **Edit workout** | Opens edit mode (below) |
| **Repeat workout** | Starts a new workout with the same exercises, set counts and set types. Inputs are empty with this workout as the grey placeholders. If a workout is already running, the "one workout at a time" sheet appears |
| **Save as routine** | Sheet with a name field (prefilled with the workout name) and **Save**. It creates a routine with the same exercises and set counts, then shows "Routine saved" |
| **Delete workout** | Confirmation: "Delete this workout?". If it set PRs, it adds "Its PRs will be removed." After deleting it goes back to the list, with a "Workout deleted · Undo" toast (5 s). Soft delete; PRs are recalculated |

## Edit mode
Reached from **Edit workout**. It reuses the **active workout layout and set table**, with these differences:
- **Header**: `Cancel` on the left, the title `Edit workout`, and `Save` (accent) on the right. There's no elapsed timer, rest timer or wake lock.
- **Details card** at the top: Name, **Date**, **Start time** and **Duration** (h + min).
  - The date can't be in the future.
  - The duration must be between 1 min and 12 h.
  - `ended_at = started_at + duration`.
- **Set table**: the same columns but **without the ✓ column**. Every set in a saved workout counts as completed.
  - Change kg/reps, and **+ Add set**.
  - Tap the set number for Warm-up / Normal / Delete, or swipe left to delete.
- **Exercise ⋯**: Replace exercise, Note, Reorder exercises, Remove exercise. **Add exercise** opens the picker.
- **Save**:
  - Empty fields take their placeholder, as with ✓ during logging. Fields with no placeholder are highlighted and saving stops.
  - PRs are recalculated for all affected exercises, then a "Saved" toast shows and it returns to the detail.
- **Cancel** with unsaved changes asks "Discard changes?" → *Discard* / *Keep editing*.

## Log past workout
The **+** in the History header opens edit mode for a new workout:
- Title `Log past workout`.
- A **Start from** row of chips: `Empty` (default) and every routine. Picking a routine fills in its exercises and set counts.
- Defaults:
  - Date: today.
  - Start time: the current time minus 1 h, rounded to 5 min.
  - Duration: 1 h.
  - Name: from the time of day (Morning / Afternoon / Evening workout) or the routine name.
- **Save** creates a completed workout, and it appears in the list at its date.

## Desktop (≥ 1024 px, low priority)
The list is on the left (about 400 px) and the detail on the right, like Exercises. Edit mode uses the right side.

## States to design
| State | What is shown |
|---|---|
| List | Week sections with workout cards |
| Calendar | Month grid with dots, selected day's workouts below |
| Search / filter active | Chips, badge, highlighted exercise lines |
| No results / no workouts | Short text (+ Start button when empty) |
| Detail | Tiles, exercise cards, ⋯ menu |
| Edit mode | Details card + set table without ✓, Cancel/Save |
| Log past workout | Edit mode + Start from chips |
| Delete | Confirm, then Undo toast |
