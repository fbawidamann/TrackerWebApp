# Roadmap

The order is deliberate: the app is fully usable offline on one device after **M6**, then the backend, sync and deployment follow.

## Planning
- [x] Requirements and stack ([requirements.md](requirements.md), [ADR 0001](adr/0001-tech-stack.md))
- [x] Data model and sync design
- [x] Visual design: direction, tokens, formats, components ([design/ui-guidelines.md](design/ui-guidelines.md))
- [x] **Detailed frontend planning**: one spec + clickable prototype per screen → `docs/design/screens/`
  - [x] Active workout (incl. finish summary)
  - [x] Home
  - [x] Exercises (list, picker, detail with charts, custom exercises)
  - [x] History (list, calendar, workout detail, edit, log past workout)
  - [x] Routines (list, editor, starter routines)
  - [x] Profile / Settings (personalization, backup)
  - [x] Stats page (v0.1.1, 2026-10-04): `/stats` via More, see docs/design/screens/stats.md
  - [x] Login (no registration; the admin creates accounts) + admin Users screen (M7, [login.md](design/screens/login.md), [admin-users.md](design/screens/admin-users.md))

## Phase 1: Gym (frontend, local-only)
- [x] **M0: Scaffold**: npm workspaces monorepo, TypeScript, ESLint, Vitest, Vite + design-token CSS, TanStack Router, app shell (bottom nav / desktop sidebar, theme), CI workflow file
- [x] **M1: Data foundation**: shared Zod schemas, ID/unit/metric helpers, Dexie DB + outbox write path, exercise catalog import, Exercises screen (list, search, filter, detail)
- [x] **M2: Workout logging**: start empty workout, add exercises, set table with Previous, complete sets, simple rest timer, finish/discard, resume after reload
- [x] **M3: Routines**: create/edit routines, start from routine, save workout as routine
- [x] **M4: History**: list grouped by week, workout detail, edit past workouts
- [x] **M5: Progress**: exercise chart (heaviest weight / best set reps, 3M–All), heaviest-weight PRs, PR history, finish summary (the Stats page is deferred)
- [x] **M6: PWA and polish**: installable PWA, offline app shell, runtime image caching, JSON backup export/import, all Profile settings

Phase 1 frontend was built on 2026-09-30 (see ADR 0001 → Implementation changes). Not done yet: the desktop master–detail layouts (low priority), and pushing the CI workflow to GitHub (repo: github.com/fbawidamann/TrackerWebApp).

## Phase 1b: Backend and sync
- [x] **M7: Backend** (built 2026-09-30): Postgres 17 (PGlite locally), Drizzle schema + migrations, Hono API, custom session auth with username + password, admin user management, CLI ([ADR 0005](adr/0005-backend-auth-and-sync.md))
- [x] **M8: Sync** (built 2026-09-30): push/pull endpoints (generic `records` table), sync engine with outbox, re-own local data at first login, logout wipe
- [ ] **M9: Deploy**: Docker Compose on the VPS behind the existing Traefik ([ADR 0004](adr/0004-deployment.md)). **Done 2026-10-01:** the `app` container is live at https://tracker.fbawidamannserver.cloud (deployed by the VPS agent Hermes, built on the VPS). M7 update (db container, admin, nightly backups): instructions in `ForHermesInstruction.md`. Still open: automatic deploys

## Phase 2: Running and swimming
- [x] **Running** (built 2026-10-01): Running tab, GPX/FIT import, manual log/edit, run detail (route, charts, splits, best efforts), runs in History and calendar, sync ([running.md](design/screens/running.md), [ADR 0006](adr/0006-running.md))
- [ ] Swimming: plan in detail; follow the `add-activity-type` skill (placeholder screen `/swimming` with "In progress" exists since v0.1.1)

## Languages
- [x] **German** (built 2026-10-01): language setting in Profile, whole UI and the exercise catalog (names + instructions) translated ([ADR 0007](adr/0007-german-language.md))

## Phase 3: Food tracking
- [ ] Plan in detail (foods, meals, calories/macros; food database source?)
