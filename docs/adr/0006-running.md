# ADR 0006: Running — import from the watch, store totals + a downsampled track

- Status: **Accepted**
- Date: 2026-10-01 (built as Phase 2, running part)
- Screen spec: [running.md](../design/screens/running.md). Data: [data-model.md](../architecture/data-model.md#runs--runtracks-running).

## Context
Runs are recorded by a watch (Garmin) or a phone app (Strava). The tracker should keep every run, show progress (weekly distance, personal bests) and the details of one run (route, pace, splits), offline-first like the gym part. Requirements had "manual entry first, GPX import maybe".

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Recording | **No live GPS recording** in the app. Runs are imported (GPX, FIT) or logged by hand | A PWA can't record GPS reliably with the screen locked; the watch already does it well |
| File formats | **GPX** (parsed with `DOMParser`) and **FIT** (official `@garmin/fitsdk`, lazy-loaded) | GPX is the universal export (Strava, Garmin Connect); FIT is what Garmin watches write and has the device's own totals |
| FIT totals | The device's session totals (distance, timer time, ascent, HR) win over our own calculation | The watch measures with more sensors (barometer, footpod) |
| Storage | `activities` (type `run`) + child table **`runs`** (totals, efforts) + **`runTracks`** (the route) | Follows the activity model: no new columns on `activities`; the list screens only read the small `runs` rows |
| Track size | Downsampled to ~1 point per 5 s (max 10 000), lat/lon as **Google polyline** (1e-5°), parallel arrays `t`, `ele` (0.1 m), `hr` | A 1-hour run is ~15–25 kB instead of ~400 kB of GPX; small enough to sync as one row |
| Best efforts | Computed **once at import** and stored on the run (`efforts`) | They need the full-resolution track, which is not kept. Tracks are never edited, so they can't go stale (an exception to "derived, not stored") |
| Map | Route drawn as an **SVG line without map tiles** | Works offline, no tile provider or API key, the location never leaves the user's own server |
| Duplicates | Same start time ±1 min = same run | Importing a folder twice must be harmless |
| Editing | Imported runs: only name, date, notes. Manual runs: all fields | Measured data stays trustworthy |
| Sync | No server change: `runs` and `runTracks` are added to `SYNCED_TABLE_SCHEMAS` ([ADR 0005](0005-backend-auth-and-sync.md)). Pushes are split at ~1 MB per request | The generic `records` table needs no migration |

## Alternatives considered
- **Strava / Garmin Connect API sync**: automatic, but needs OAuth apps, tokens on the server and rate limits; can be added later on top of the same tables.
- **Map tiles (OpenStreetMap / Leaflet)**: prettier, but needs network, a tile policy and sends the location to a third party.
- **Store the raw GPX/FIT**: largest, and the app would have to re-parse it on every device.

## Consequences
- The app gets a sixth tab (Running).
- Swimming can follow the same pattern (a `swims` child table, FIT import of pool lengths).
- A future live-recording mode would write the same `runs`/`runTracks` rows.
