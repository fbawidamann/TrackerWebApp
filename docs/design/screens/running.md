# Screen: Running

Status: **built** (2026-10-01, Phase 2). No separate HTML prototype: it reuses the existing components (stat tiles, cards, list rows, the chart style of the exercise detail) from [ui-guidelines.md](../ui-guidelines.md).
Decisions: [ADR 0006](../../adr/0006-running.md). Data: `runs` and `runTracks` in [data-model.md](../../architecture/data-model.md#runs--runtracks-running). Mobile first.

Running is its own tab. Runs are **logged after the fact**: either imported from a watch file (GPX or FIT) or typed in by hand. There is no live GPS recording in the app (a phone browser can't record reliably with the screen off; the watch does that job).

## Navigation
- Reached via **More → Running** on phones (since v0.1.1, see ui-guidelines "Bottom navigation"); icon = runner.
- Routes: `/running` (tab), `/running/new` (log), `/running/$activityId` (detail), `/running/$activityId/edit` (edit). Log and edit hide the nav.
- Runs also appear in **History** and its **Calendar** (see below). The gym parts of the app (Home weekly goal, workouts count, PRs, Workout tab) stay gym-only.

## Running tab

```
Running                                         ← title
[ Log run ]  [ Import file ]                    ← primary + secondary, equal width
[ Week | Month | Year | All ]                   ← segmented, default Week
┌ 24.30 km   │  2:05:12  │  3      ┐           ← Distance · Time · Runs
│ 5:09 /km   │  184 m    │  10.02 km │          ← Avg pace · Elevation · Longest
└──────────────────────────────────┘
WEEKLY DISTANCE
┌ 24.30 km  3 runs · This week      ┐           ← readout of the selected bar
│ ▂ ▅ ▃ ▇ ▂ ▅ ▆ ▃ ▅ ▇ ▄ █          │           ← 12 weeks, newest right, selected bar full accent
└──────────────────────────────────┘
PERSONAL BESTS
┌ ◆ 5K           22 Sep   23:41   ┐           ← time + pace per km below
│ ◆ 10K          14 Sep   49:58   │
└──────────────────────────────────┘
ALL RUNS
┌ Evening run   Today · 52:14     10.02 km › ┐  ← name, relative day · moving time | distance, pace
│                                 5:12 /km   │
└────────────────────────────────────────────┘
Show more                                       ← 20 more at a time
```

- **Period totals** start at the beginning of the current week (`week_start` setting), month or year. Time and pace use **moving time**.
- **Weekly distance**: bars of the last 12 weeks including empty ones. Tap or drag selects a bar; the readout shows its distance, run count and week label (`This week`, `14–20 September`). The y-axis uses round steps (1, 2, 5, 10, 20, 50, 100 km).
- **Personal bests**: the fastest time per standard distance over all runs: **400 m, 1K, 1 mile, 5K, 10K, Half marathon, Marathon**. Only distances someone has run appear. Tap → the run that set it.
- **Empty state**: `No runs yet` and the hint `Import a GPX or FIT file from your watch, Garmin Connect or Strava.`

## Import
- **Import file** opens the file picker (`.gpx`, `.fit`, several files at once).
- **GPX**: track points with time (required), elevation, heart rate (any `…:hr` extension, e.g. Garmin `gpxtpx:hr`). The track name becomes the run name.
- **FIT**: read with the official Garmin SDK (`@garmin/fitsdk`, loaded only when a FIT file is picked). The **device's own totals** (distance, timer time, ascent, avg/max HR) win over our calculation, because the watch measured them better. Treadmill files without GPS import their totals only.
- **Duplicates**: a file whose start is within 1 minute of an existing run is not imported again; the app opens the existing run.
- One file → `Run imported` (or `This run was already imported`) and the detail opens. Several files → one summary toast: `3 runs imported · 1 already there · 1 failed`.
- Errors (toast): `Choose a .gpx or .fit file`, `This file has no GPS track`, `This file has no timestamps, so pace can't be calculated`, `This isn't a FIT file`, `This FIT file has no distance or GPS data`.

### How the numbers are computed (`packages/shared/src/running.ts`)
| Value | Rule |
|---|---|
| Distance | Haversine sum over the track points |
| Moving time | Sum of segments faster than 0.8 m/s; gaps over 60 s never count |
| Elevation gain | Ascent with 3 m hysteresis (filters GPS/barometer noise) |
| Avg / max HR | Over readings > 0 |
| Splits | Per km, elapsed time inside each km; the last split is partial; a tail under 50 m joins the previous split |
| Best efforts | Fastest sliding window per standard distance inside the run (elapsed time); manual runs only count at a matching distance (±1 %), e.g. a typed-in 5.00 km |
| Pace | Seconds per km = moving time / distance. Shown as `5:12 /km` |

## Run detail

```
‹                                         ⋯
Evening run                                     ← title
Tuesday, 29 September · 18:04                   ← date · start time
┌ route drawn as a line (no map tiles)  ┐       ← start = ring, finish = filled dot
┌ 10.02 km │ 52:14 │ 5:12 /km           ┐       ← Distance · Moving time · Avg pace
│ 84 m     │ 152 bpm │ 171 bpm          │       ← Elevation · Avg HR · Max HR (each only if known)
PACE           readout: avg 5:12 /km            ← charts vs distance; tap/drag shows value · km
ELEVATION      readout: +84 m
HEART RATE     readout: avg 152 bpm
SPLITS                                          ← Km · Pace · bar (faster = longer) · Elev
BEST EFFORTS                                    ← ◆ when it is the all-time best
notes
Imported from FIT                               ← source line, muted
```

- **Route**: drawn as an SVG line from the stored track, without map tiles. It works offline and sends the location to no third party ([ADR 0006](../../adr/0006-running.md)).
- **Charts** (pace inverted so faster is higher; elevation with a faint area; heart rate): one shared selection. Tapping any chart puts a marker on the route and on the other charts at the same distance. Outliers (2 %/98 %) are clipped so a GPS glitch doesn't flatten the chart.
- **Splits**: the fastest full split is accent-coloured. Bars are relative to the slowest split.
- Without a track (manual runs) only the stat card, best efforts and notes show. A **Elapsed** tile appears when there is no HR and pauses took longer than 30 s.
- **⋯ menu**: **Edit run**, **Delete run** (confirmation `Delete this run?`, then `Run deleted · Undo`, soft delete of the run, its totals and track).

## Log / edit run

Full-screen form with **Cancel / title / Save** (like the workout editor):

| Field | Rule |
|---|---|
| Name | Max 40 characters; empty = `Morning run` / `Afternoon run` / `Evening run` from the start time |
| Date, Start time | Native pickers; date not in the future. Default: one hour ago, rounded to 5 min |
| Distance (km) | Required. `10.5` or `10,5`, up to 1000 km |
| Time | Required. `52:14`, `1:02:03`, or plain minutes (`45`) |
| Pace | Live, read-only: `5:12 /km` |
| Elevation (m), Avg heart rate | Optional whole numbers (HR 20–250) |
| Notes | Max 1000 characters |

- Invalid required fields get the red `need` outline; Save does nothing until they are fixed.
- **Imported runs**: only name, date/time and notes can change; the measured numbers come from the file (`Distance, time and heart rate come from the imported file and can't be changed.`). Moving the date shifts the whole run.
- Cancel with changes → `Discard changes?` sheet.

## History
- Runs appear in the History list between workouts, newest first, as a card in the same style: runner icon + name (medal if it holds a personal best), `date · moving time`, then `10.02 km   5:12 /km   84 m`. Tap → run detail.
- Week headers count both: `THIS WEEK · 2 workouts · 1 run`.
- **Exercise search** hides runs (they have no exercises). The **Filter** sheet lists **Runs** next to the routines and Freeform; the button reads `Show 12 results`.
- **Calendar**: run days get the same dot; the month line counts `5 workouts · 3 runs`; the day list shows run cards. Empty day: `No training on this day`.

## States
| State | What is shown |
|---|---|
| No runs | Running tab: buttons + empty card |
| Importing | Import button disabled, `Importing…` |
| Manual run | Detail without route, charts, splits |
| Run not found (deleted on another device) | `Run not found.` with Back |
