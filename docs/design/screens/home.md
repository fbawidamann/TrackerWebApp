# Screen: Home

Status: **decided and approved via prototype** (2026-09-29). The start screen: start or resume training, and see what happened recently.
Visual tokens and components: [../ui-guidelines.md](../ui-guidelines.md). Milestones: **M2** (start/resume), **M3** (routines), **M4/M5** (recent, PRs).
Clickable prototype: [Home screen prototype](https://claude.ai/artifact/FahzKjEeG69YN6VRV44GeR).

## Layout (phone)

```
┌──────────────────────────────────────┐
│ Tuesday                              │  title = weekday (28 px)
│ 29 September                         │  sub, muted
│ 2 of 3 workouts this week            │  goal line (tap → set goal)
│ ▬▬▬▬▬▬▬▬ ▬▬▬▬▬▬▬▬ ░░░░░░░░          │  one segment per goal workout
│                                      │
│ [      Start empty workout      ]    │  or the Resume card (see below)
│                                      │
│ ROUTINES                        All  │
│ ┌ card ────────────────────────────┐ │
│ │ Push Day                          │ │
│ │ 4 exercises · last Tue         ›  │ │  tap → preview sheet
│ │ Pull Day …                        │ │
│ └──────────────────────────────────┘ │
│ RECENT                      History  │
│ ┌ card: 3 workouts (no volume) ────┐ │  tap → workout detail
│ └──────────────────────────────────┘ │
│ LATEST PRS                           │
│ ┌ card: 3 records ─────────────────┐ │  tap → exercise detail
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ nav                                  │
└──────────────────────────────────────┘
```

There is no "This week" card and no greeting or filler text.

## Title and weekly goal
- **Username at the very top** (added 2026-10-01): a small line above the weekday (15 px, 600, `accent-text`), e.g. `LegendFLOO`. It shows the account username once logged in (M7). Before accounts exist it shows the Profile name, and is hidden while that is empty.
- The title is the **weekday** ("Tuesday"), with the date below ("29 September"). The year is only added if it isn't the current year.
- **Goal line**: `2 of 3 workouts this week` (14 px, muted, numbers in `text` colour).
  - Below it is a thin **segmented bar** with one segment per goal workout; completed workouts fill segments with `accent-fill`.
  - When the goal is reached: `3 of 3 workouts · goal reached`, with "goal reached" in `accent-text`.
  - Extra workouts go beyond the goal: `4 of 3 workouts` (the bar stays full).
- The week runs Monday to Sunday (`user_settings.week_start`). Only **completed** workouts count; a running one doesn't.
- Tapping the goal line opens a small sheet: **Weekly goal**, with chips 1–7 (default 3). This can also be set in Profile.

## Start / Resume
- **No workout running**: a full-width primary button, **Start empty workout**.
- **Workout running**: a **Resume card** replaces the button:
  ```
  ┌ card ──────────────────────────────┐
  │ PUSH DAY  ·  IN PROGRESS           │  label
  │ 34:12              5 of 13 sets    │  elapsed (live), progress
  │ [          Resume             ]    │  primary button
  └────────────────────────────────────┘
  ```
  The mini bar is hidden on Home, because the card replaces it.

## Routines
- Label `ROUTINES`, with an **All** link on the right that goes to the Routines screen (list and editor, planned separately).
- Shows up to **4 routines**, sorted by most recently done. Each row shows the name and `4 exercises · last Tue` (or `never done`), with a chevron.
- **Tapping a routine** opens the **preview sheet**:
  - Title: the routine name.
  - Sub: `last done Tuesday, 22 September` (or `not done yet`).
  - Exercise list: name, equipment (muted) and `4 sets` on the right.
  - Buttons: **Start workout** (primary) and **Edit routine** (secondary).
  - If a workout is already running, Start shows the existing "one workout at a time" sheet (Resume / Discard and start new).
- **No routines yet**: the card shows `No routines yet` and a ghost button **Create routine**.

## Recent
- Label `RECENT`, with a **History** link on the right.
- Shows the **3 latest completed workouts**. Each row has the name, and a meta line with the relative date and duration, e.g. `Today · 58 min`. There is no volume (decided 2026-09-30).
  - A medal icon appears when the workout set a PR.
  - Relative dates: `Today`, `Yesterday`, the weekday within the last 7 days, otherwise `22 Sep`.
- Tapping a row opens the **workout detail** (History).
- The section is hidden when there are no workouts yet.

## Latest PRs
- Label `LATEST PRS`, with no link.
- Shows the **3 newest records** (heaviest weight). Each row has a medal icon, the exercise name, the equipment (muted) and, on the right, the weight (`82.5 kg`) with the date below (`Today`), muted.
- Tapping a row opens the **exercise detail** (charts, PR history).
- The section is hidden when there are no PRs yet.
- PRs are derived, not stored (see [data model](../../architecture/data-model.md)). A PR event is a completed normal set whose weight beats every earlier session of that exercise.

## First use (empty state)
Title, date and goal line (`0 of 3 workouts this week`), the **Start empty workout** button, and the Routines card with **Create routine**. Recent and Latest PRs stay hidden until there is data. No onboarding text.

## Desktop (≥ 1024 px)
- The bottom nav becomes a **sidebar** on the left: the same five items with icons and labels, with the pill for the active item.
- Content is two columns (max width about 1040 px, gap 32 px):
  - **Left:** title, goal line, Start/Resume, Routines.
  - **Right:** Recent, Latest PRs.
- The routine preview opens as a centred dialog instead of a bottom sheet.

## States to design
| State | Differences |
|---|---|
| Normal | As in the layout above |
| Workout running | Resume card instead of Start; mini bar hidden |
| Goal reached / exceeded | "goal reached" in accent; bar full |
| First use | Recent + PRs hidden; Routines shows Create routine |
| Routine preview | Bottom sheet (phone) / dialog (desktop) |
| Goal sheet | Chips 1–7 |
