# ADR 0003: Exercise catalog from free-exercise-db

- Status: **Accepted**
- Date: 2026-09-29

## Context
Logging is much faster when common exercises already exist. The user chose a large catalog over a small hand-curated list.

## Decision
Use **[free-exercise-db](https://github.com/yuhonas/free-exercise-db)**:
- 800+ exercises
- Licence: **Unlicense** (public domain), so bundling and modifying it is allowed
- Fields: id, name, force, level, mechanic, equipment, primaryMuscles, secondaryMuscles, instructions[], category, images[]

### Import
- The script `packages/shared/scripts/import-exercises.ts` (`npm run catalog:import`) downloads `dist/exercises.json`, maps it to our schema and writes `packages/shared/data/exercises.json` with a `catalogVersion`. That output **is committed**, and the app never fetches the dataset at runtime.
- Built-in IDs are **UUIDv5(fixed namespace, dataset id)**: deterministic, the same on every device and the server, never synced.
- The app seeds Dexie with the catalog on first start, and again whenever `catalogVersion` changes.

### Field mapping
| free-exercise-db | Ours |
|---|---|
| `primaryMuscles[0]` | `primary_muscle` |
| `secondaryMuscles` (+ remaining primaries) | `secondary_muscles` |
| `equipment` "body only" | `bodyweight` |
| `equipment` "e-z curl bar" | `barbell` |
| `equipment` "machine" / "cable" / "dumbbell" / "barbell" / "kettlebells" / "bands" | same names (`kettlebell`, `band`) |
| muscles | kept exactly (17 values) and grouped for filtering: see [exercises screen](../design/screens/exercises.md#muscle-groups) |
| `equipment` null / unknown | `other` |
| `category` strength, powerlifting, olympic weightlifting, strongman | `tracking_type = weight_reps` (`reps_only` if the equipment is bodyweight) |
| `category` stretching, cardio, plyometrics | `tracking_type = duration` |
| `level`, `instructions`, `images` | kept for the exercise detail page |
| `force`, `mechanic` | dropped for now |

### Images
- `npm run catalog:images` downloads the images into `apps/web/public/exercise-images/`. They are **gitignored**, and the Docker build runs the script.
- The service worker caches images **at runtime, on first view**. They are not precached at install, which would be too big.
- No hotlinking to GitHub in production.

## Alternatives considered
- **~80 hand-curated exercises**: less noise, but more manual work, and no instructions or images.
- **Empty catalog**: too slow to get started.
- **Paid APIs (e.g. ExerciseDB)**: licensing and cost, plus a network dependency. They conflict with offline-first.

## Consequences
- Some noise (very niche exercises) is handled with good search and filters. Hiding exercises can come later.
- Users can create custom exercises that sync like any other data.
