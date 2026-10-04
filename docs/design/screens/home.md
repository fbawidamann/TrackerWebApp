# Screen: Home

Status: **decided and approved via prototype** (2026-09-29). The start screen: start or resume training, and see what happened recently.
Visual tokens and components: [../ui-guidelines.md](../ui-guidelines.md). Milestones: **M2** (start/resume), **M3** (routines), **M4/M5** (recent, PRs).
Clickable prototype: [Home screen prototype](https://claude.ai/artifact/FahzKjEeG69YN6VRV44GeR).

## Layout (phone)

Reworked 2026-10-04 (Home redesign): the week is visible at a glance, the next routine is one tap away, runs
count on Home too, and every number answers "am I on track?".

```
┌──────────────────────────────────────┐
│ LegendFLOO                           │  username (accent)
│ Sunday                               │  title = weekday (28 px)
│ 4 October                            │  sub, muted
│ ┌ card: This week ─────────────────┐ │
│ │ THIS WEEK                1 to go │ │  label · state (accent when reached)
│ │ 2 of 3 workouts · 1 run          │ │  goal line (whole top part: tap → goal sheet)
│ │ ▬▬▬▬▬▬▬ ▬▬▬▬▬▬▬ ░░░░░░░          │ │  one segment per goal workout
│ │ MO TU WE TH FR SA SU             │ │
│ │ (28)29 (30) 1  2  3 [4]          │ │  filled = gym workout, ring = today
│ │     ^ runner icon                │ │  runner icon under a day with a run
│ │ Goal reached 3 weeks in a row    │ │  only from 2 weeks
│ └──────────────────────────────────┘ │
│ [      + Start workout          ]    │  or the Resume card (see below)
│ ┌ card: Up next ───────────────────┐ │
│ │ UP NEXT                           │ │  tap text → preview sheet
│ │ Pull Day              [▶ Start]   │ │  Start chip → starts it directly
│ │ Back · Arms · last Thu            │ │
│ └──────────────────────────────────┘ │
│ ROUTINES                        All  │  the other routines (max 3)
│ RECENT                      History  │  workouts AND runs, icon tile per kind
│ LATEST PRS                           │  weight + "+2.5 kg" gain
├──────────────────────────────────────┤
│ nav                                  │
└──────────────────────────────────────┘
```

There is no greeting or filler text. (The earlier "no This week card" rule is replaced by the This week card above,
which merges the goal line and the day strip, so it costs no extra height.)

## This week card (added 2026-10-04)
- Hairline card, 16 px padding. Top part is one button (goal line + segments) that opens the **Weekly goal** sheet.
- Header row: label `THIS WEEK` / `DIESE WOCHE` left, state right: `1 to go` / `noch 1` (muted), or `goal reached`
  in `accent-text`.
- Goal line: `2 of 3 workouts`, plus ` · 1 run` when runs were logged this week. Runs never count towards the goal
  (the goal is gym workouts, as before), they are shown so a running day doesn't look like a rest day.
- **Day strip** Mon–Sun (follows `week_start`): 2-letter weekday label, date in a 34 px circle.
  Gym workout that day = `accent-fill` circle with `on-accent` digits. Today = 2 px accent ring (with a 2 px gap
  when filled) and an accent weekday label. Future days are muted. A run adds a 14 px runner icon below the day.
  VoiceOver reads each day as e.g. "Today, Wednesday: 1 workout and 1 run" (visually hidden text, `aria-current="date"`).
- **Streak**: `Goal reached 3 weeks in a row` (accent, 13 px) when the goal was reached at least 2 weeks in a row.
  The current week counts once its goal is reached; while it is still open the streak of the weeks before stays
  shown, so it never "breaks" on a Monday morning. Computed in `goalStreak()` (`apps/web/src/lib/home.ts`).
- While the training data loads, the card is dimmed (no jump from 0 to the real number).

## Up next (added 2026-10-04)
- Shown under **+ Start workout** when routines exist and no workout is running (and Routines is enabled on Home).
- The routine due next is the one **done longest ago** among routines done at least once, so a rotation
  (Push → Pull → Legs) comes round by itself; when none was done yet, the first by position. (`nextRoutine()`)
- Meta: up to 3 main muscle groups (by exercise count) · `last Thu` / `never done`. Without known exercises:
  `4 exercises`.
- Two buttons side by side (never nested): the text part opens the preview sheet, the **▶ Start** chip
  (accent text on 14 % accent, pill, 44 px high) starts the routine immediately (same "one workout at a time" check).
- The Routines list below then shows the **other** routines (max 3), so nothing is listed twice; the section is
  hidden when Up next is the only routine.

## Title and weekly goal
- **Username at the very top** (added 2026-10-01): a line above the weekday (20 px, 600, `accent-text`; enlarged from 15 px on 2026-10-04 so the name is easier to read, still smaller than the 28 px weekday title), e.g. `LegendFLOO`. It shows the account username once logged in (M7). Before accounts exist it shows the Profile name, and is hidden while that is empty.
- The title is the **weekday** ("Tuesday"), with the date below ("29 September"). The year is only added if it isn't the current year.
- **Goal line**: `2 of 3 workouts this week` (14 px, muted, numbers in `text` colour).
  - Below it is a thin **segmented bar** with one segment per goal workout; completed workouts fill segments with `accent-fill`.
  - When the goal is reached: `3 of 3 workouts · goal reached`, with "goal reached" in `accent-text`.
  - Extra workouts go beyond the goal: `4 of 3 workouts` (the bar stays full).
- The week runs Monday to Sunday (`user_settings.week_start`). Only **completed** workouts count; a running one doesn't.
- Tapping the goal line opens a small sheet: **Weekly goal**, with chips 1–7 (default 3). This can also be set in Profile.

## Start / Resume
- **No workout running**: a full-width primary button, **+ Start workout**.
- **Workout running**: a **Resume card** replaces the button:
  ```
  ┌ card ──────────────────────────────┐
  │ PUSH DAY  ·  IN PROGRESS           │  label
  │ 34:12              5 of 13 sets    │  elapsed (live), progress
  │ ▬▬▬▬▬▬▬▬▬▬░░░░░░░░░░░░░░░░░░       │  thin progress bar (4 px, accent-fill; added 2026-10-04)
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
- Shows the **3 latest completed activities: gym workouts and runs mixed** (since 2026-10-04), newest first. Each row starts with a 34 px `raised` icon tile (barbell / runner) so the kind is clear at a glance.
  - Workout meta: relative date · duration · completed work sets, e.g. `Today · 58 min · 16 sets`. There is no volume (decided 2026-09-30).
  - Run meta: relative date · distance · pace, e.g. `Yesterday · 10.02 km · 5:12 /km`; tap opens the run detail.
  - A medal icon appears when the workout set a PR.
  - Relative dates: `Today`, `Yesterday`, the weekday within the last 7 days, otherwise `22 Sep`.
- Tapping a row opens the **workout detail** (History) or the **run detail** (Running).
- The section is hidden when there are no workouts yet.

## Latest PRs
- Label `LATEST PRS`, with no link.
- Shows the **3 newest records** (heaviest weight). Each row has a medal icon, the exercise name, a meta line `Today · Barbell` (muted) and, on the right, the weight (`82.5 kg`) with the **gain over the previous best** below (`+2.5 kg`, accent; since 2026-10-04 – the gain is the motivating part, the date moved into the meta line).
- Tapping a row opens the **exercise detail** (charts, PR history).
- The section is hidden when there are no PRs yet.
- PRs are derived, not stored (see [data model](../../architecture/data-model.md)). A PR event is a completed normal set whose weight beats every earlier session of that exercise.

## First use (empty state)
Title, date and This week card (`0 of 3 workouts`, `3 to go`, empty day strip with today ringed), the **+ Start workout** button, and the Routines card with **Create routine**. Recent and Latest PRs stay hidden until there is data. No onboarding text.

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
| Loading | This week card dimmed; Routines shows a 2-line skeleton instead of jumping in |
| Runs this week | ` · 1 run` in the goal line, runner icons in the day strip, runs in Recent |
| Streak ≥ 2 weeks | Streak line in the This week card |
| Workout running | Resume card (with progress bar) instead of Start and Up next; mini bar hidden |
| Goal reached / exceeded | "goal reached" in accent; bar full |
| First use | Recent + PRs hidden; Routines shows Create routine |
| Routine preview | Bottom sheet (phone) / dialog (desktop) |
| Goal sheet | Chips 1–7 |

## Motion and iPhone feel (added 2026-10-04)
- Sections fade/rise in once (320 ms, 40 ms stagger) when Home opens; none with *reduce motion*.
- The clock ticks every second only while the Resume card shows (otherwise once a minute + on resume), to save battery.
- Press feedback as everywhere: the Up next text dims, the Start chip scales; list rows only dim.
- Code: `features/home/HomeScreen.tsx`, `WeekCard.tsx`, `UpNextCard.tsx`, logic in `lib/home.ts` (tests: `lib/home.test.ts`, `features/home/home.test.tsx`).
