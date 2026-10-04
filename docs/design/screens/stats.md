# Statistics

Route `/stats`, reached via **More → Statistics** (desktop: sidebar). Added 2026-10-04 (v0.1.1). Code: `apps/web/src/features/stats/StatsScreen.tsx`, calculations in `apps/web/src/lib/stats.ts` (pure, unit-tested).

```
Statistics
[ Week | Month | Year | All ]            default: Month
┌ 12 Workouts │ 140 Work sets │ 13h 20m ┐
│ 18.4 t Volume │ 5 PRs │ 67m Avg.      │
└──────────────────────────────────────┘
WORKOUTS PER WEEK                         bar chart, last 12 weeks, tap a bar
SETS PER MUSCLE GROUP                     horizontal bars, all groups (0 shown)
MOST TRAINED                              top 5 exercises › exercise detail
RUNNING                                   runs · km in the period › Running
```

Rules:
- **Work sets** = completed sets that are not warm-ups. Volume = Σ weight × reps over work sets, shown in tonnes.
- Muscle groups use the exercise's **primary muscle** (`MUSCLE_TO_GROUP`). Groups with 0 sets stay visible on purpose: they show what is missing. "Other" only appears when it has sets.
- Top exercises: by number of sessions, then sets.
- The running row only appears when there are runs in the period.
