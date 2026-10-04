# Statistics

Route `/stats`, reached via **More → Statistics** (desktop: sidebar). Added 2026-10-04 (v0.1.1), reworked the same day
(comparison, consistency, per-week muscle volume, strength trend, PRs). Code: `apps/web/src/features/stats/StatsScreen.tsx`
(+ `ConsistencyGrid.tsx`, `ui/Sparkline.tsx`), calculations in `apps/web/src/lib/stats.ts` (pure, unit-tested in
`lib/stats.test.ts`, render test in `features/stats/stats.test.tsx`).

Goal: answer the questions a lifter actually has, in this order: *Am I training more or less than before?* → *Am I
consistent?* → *Is the volume balanced?* → *Am I getting stronger?* No chart library; hand-written SVG/CSS.

```
Statistics
[ Week | Month | Year | All ]                         default: Month (kept for the session)
┌ 6           │ 92            │ 6 h 10 min   ┐
│ WORKOUTS    │ WORK SETS     │ TIME         │
│ +1          │ +14           │ +40 min      │  ← change vs the same stretch before (accent = up, muted = down)
├─────────────┼───────────────┼──────────────┤
│ 18.4 t      │ 3             │ 62 min       │
│ VOLUME      │ PRS           │ AVG. WORKOUT │
│ +12 %       │ ±0            │ −4 min       │
└──────────────────────────────────────────────┘
Changes vs the same days last month                   (hidden for "All")

CONSISTENCY                              LAST 12 WEEKS
┌ 5 wk        │ 9/11          │ 2.8          ┐  streak · weekly goal hit · avg per week
├──────────────────────────────────────────────┤
│ 3 workouts · This week · goal reached        │  readout of the selected week
│ Mo ▢ ▢ ■ ▢ ▣ ...  12 week columns × 7 days   │  tap a column = select the week
│    ▢ ■ ▢ ▢ ▢                                 │  ■ 1 workout, ▣ 2+, outline = future day
│ We ...                                       │  bar under a column = goal reached
│    ─ ─   ─ ─ ─                               │
│  7 Jul     4 Aug     1 Sep     29 Sep        │
│ ▬ Weekly goal: 3                             │
└──────────────────────────────────────────────┘

SETS PER MUSCLE GROUP                         PER WEEK
┌ Chest     ███████▌|        11   ›          ┐  row = button; tap opens the exercises behind it
│ Back      ██████  |        9.4  ›          │  | = 10 sets/week guideline marker
│ Shoulders ██      |  [low] 3.1  ›          │  "low" tag below 5 sets/week (main groups only)
│   ├ Overhead Press           4 sets ›      │  drill-down → exercise detail
│ Legs ...                                   │
└ Avg. work sets per week by main muscle. Line = 10 sets, a common guideline.

TOP EXERCISES
┌ Bench Press        ╱╲╱  101 kg  ›        ┐  sparkline = e1RM of the last 8 sessions
│ 6× · 22 sets           e1RM +4             │  change vs the comparison window
└──────────────────────────────────────────────┘
e1RM = estimated one-rep max from your best set (1–12 reps). Line: last sessions.

NEW PRS                                     3   (only when there are PRs in the period)
┌ (medal) Squat · 2 Oct · before 115 kg 120 kg ┐  → exercise detail; 5 shown, "Show all n"
RUNNING                                         (only when there are runs in the period)
```

## Rules

- **Work sets** = completed sets that are not warm-ups. Volume = Σ weight × reps over work sets, shown in tonnes.
- **Comparison ("so far" vs "so far")**: the period is compared with the *same stretch* of the previous period, up to
  the same point in time: Month on the 4th → 1st–4th of last month; Week on Sunday 15:00 → last Monday–Sunday 15:00;
  Year on 4 Oct → 1 Jan–4 Oct last year. Day of month is clamped (31 Mar ↔ 28 Feb). Comparing a running month with
  a full finished one would show "down" every month start. `All` has no comparison.
  Shown under each tile: counts as `+3` / `−2` / `±0`, durations as `+40 min`, volume as percent (or `+1.2 t` when the
  previous value was 0). Up = `accent-text`, down/equal = muted. **Never red**: fewer sets can be a planned deload.
  Avg. workout only gets a change when both windows have workouts. VoiceOver reads the change in words.
- **Consistency** always covers the last 12 weeks (independent of the period). *Streak* = weeks in a row reaching the
  weekly goal (Home/Profile setting); the running week counts once the goal is reached, otherwise it doesn't break the
  streak yet (same rule as Profile). *Weekly goal* (x/y) = finished weeks (last 12, not before the first workout) that
  reached the goal. *Avg. / week* over the same weeks.
- **Grid**: columns are weeks (oldest left), rows are days (week start from settings on top). Every column is a
  button (whole column is the tap target, ~180 px tall) with an aria-label like "This week: 3 workouts, goal reached".
- **Muscle groups** use the exercise's primary muscle (`MUSCLE_TO_GROUP`). Groups with 0 sets stay visible (they show
  what is missing; their row is not tappable); "Other" only appears when it has sets. When the period covers
  **≥ 2 weeks** (from the later of period start and the first workout) values are **sets per week**, with a marker at
  10 sets/week (common hypertrophy guideline) and a `low` tag under 5 sets/week for Chest/Back/Shoulders/Arms/Legs
  (not Core/Other). Shorter periods (Week, early in the month) show plain totals without tags: a per-week figure
  from a few days is noise. Rows are 46 px buttons; the drill-down lists the exercises (most sets first) → exercise detail.
- **Top exercises**: by number of sessions, then sets. Right side: best **e1RM** in the period (Epley, 1–12 reps, same
  formula as the exercise detail), rounded to whole kg/lb, change vs the comparison window, sparkline over the last
  8 sessions. Exercises without weight (planks) show no e1RM. Sparkline is hidden below 360 px width.
- **New PRs** = heaviest-weight PRs (same as History) set in the period, newest first, 5 shown + "Show all n".
- **States**: skeleton blocks while IndexedDB loads (static with reduced motion); "No workouts yet" card when there are
  none at all; "No workouts in this period yet" replaces the muscle/strength/PR sections while totals and consistency
  stay.
- The selected period is kept in `sessionStorage`, so going to an exercise and back keeps it; a fresh start opens on
  Month.
- Motion: only bar width and chevron rotation transitions, skeleton pulse; all off with *reduce motion*. Press
  feedback: rows and grid columns dim, no scaling.
- The running row only appears when there are runs in the period.
