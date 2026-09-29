# Roadmap

The order is deliberate: the app is fully usable offline on one device after **M6**, then the backend, sync and deployment follow.

## Planning
- [x] Requirements and stack ([requirements.md](requirements.md), [ADR 0001](adr/0001-tech-stack.md))
- [x] Data model and sync design
- [x] Visual design: direction, tokens, formats, components ([design/ui-guidelines.md](design/ui-guidelines.md))
- [ ] **Detailed frontend planning**: one spec + clickable prototype per screen → `docs/design/screens/`
  - [x] Active workout (incl. finish summary)
  - [x] Home
  - [ ] Exercises (list, picker, detail with charts, custom exercises)
  - [ ] History (list, workout detail, edit)
  - [ ] Routines (list, editor)
  - [ ] Profile / Settings
  - [ ] Stats (desktop)
  - [ ] Login / Register (M7)

## Phase 1: Gym (frontend, local-only)
- [ ] **M0: Scaffold**: monorepo, TypeScript, ESLint/Prettier, Vitest, Vite + Tailwind + shadcn, TanStack Router, app shell (bottom nav / sidebar, theme), GitHub Actions CI
- [ ] **M1: Data foundation**: shared Zod schemas, ID/unit/metric helpers, Dexie DB + outbox write path, exercise catalog import, Exercises screen (list, search, filter, detail)
- [ ] **M2: Workout logging**: start empty workout, add exercises, set table with Previous, complete sets, simple rest timer, finish/discard, resume after reload
- [ ] **M3: Routines**: create/edit routines, start from routine, save workout as routine
- [ ] **M4: History**: list grouped by week, workout detail, edit past workouts
- [ ] **M5: Progress**: exercise charts (heaviest weight, e1RM, volume), heaviest-weight PRs, finish summary, stats page
- [ ] **M6: PWA and polish**: installable, offline app shell, image caching, JSON/CSV export, settings

## Phase 1b: Backend and sync
- [ ] **M7: Backend**: Postgres (Docker), Drizzle schema + migrations, Hono API, Better Auth (email + password), login/register screens
- [ ] **M8: Sync**: push/pull endpoints, sync engine, re-own local data at first login
- [ ] **M9: Deploy**: Docker Compose on the VPS (Caddy, api, postgres), nightly backups, deploy from GitHub Actions

## Phase 2: Running and swimming
- [ ] Plan in detail (manual entry; GPX import?); follow the `add-activity-type` skill

## Phase 3: Food tracking
- [ ] Plan in detail (foods, meals, calories/macros; food database source?)
