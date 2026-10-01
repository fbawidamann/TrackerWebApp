# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Personal fitness tracker web app. Gym tracking comes first, running and swimming later, food tracking after that.
**Phase 1 (gym) is built**: frontend in `apps/web`, backend (accounts, sync) in `apps/api`, shared code in `packages/shared` (M0–M8 done, see [roadmap](docs/roadmap.md)). All decisions are recorded in [docs/](docs/README.md). Read the relevant doc before proposing changes, and record new decisions there (new ADR in `docs/adr/` for major ones).

## Working mode (important)

- Planning happened together first. Since 2026-09-30, **Claude writes and builds the code** (the user asked for this explicitly), following the specs in `docs/` exactly.
- The specs in `docs/design/screens/*.md` and `docs/design/ui-guidelines.md` are the source of truth for behaviour and look. The prototypes in `docs/design/prototypes/` show the intended result.
- Every new decision made in conversation gets written into the matching doc under `docs/`, so the user and future sessions can see it.

## Stack (decided, see [ADR 0001](docs/adr/0001-tech-stack.md))

TypeScript everywhere, npm workspaces, Node 24:

```
apps/web         React 19 + Vite 8, TanStack Router (code-based, src/app/router.tsx), plain CSS with design tokens
                 (src/styles/app.css), custom SVG chart, Dexie + dexie-react-hooks, vite-plugin-pwa
apps/api         Hono (Node) serving /api + the built frontend; Drizzle ORM (postgres.js in prod, PGlite locally),
                 custom session auth (username + password, admin-created users), sync endpoints, CLI; esbuild bundle
packages/shared  Zod 4 schemas + types, IDs (uuid v7/v5), formatting (settings-aware), metrics (PRs, e1RM),
                 exercise catalog JSON (data/) + import script (scripts/)
docs/            requirements, architecture, ADRs, design specs, prototypes, roadmap
```

Database: PostgreSQL 17. Deployment: Docker Compose on the user's own VPS behind their existing **Traefik** (2 containers: `app` = Hono serving API + built frontend, `db` = Postgres). See ADR 0004. CI: GitHub Actions.

## Commands (run from repo root)

```
npm install
npm run catalog:images               # once: exercise pictures into apps/web/public/exercise-images (gitignored)
npm run dev                          # Vite dev server (--host, so the iPhone can open it on the LAN); proxies /api → :3000
npm run dev:api                      # API on :3000 with PGlite in apps/api/.data (no Docker needed)
node apps/api/dist/cli.js create-admin <name>   # after "npm run build"; also create-user, reset-password, enable-user, list-users
                                     # (PGlite = one process: stop dev:api first)
npm run lint | typecheck | test | build
npx vitest run src/db/actions.test.ts         # single test file (run inside apps/web or packages/shared)
npx vitest run -t "detects heaviest-weight"   # single test by name
npm run catalog:import               # regenerate packages/shared/data/exercises.json from free-exercise-db
npm run catalog:version              # after editing data/exercises.de.json (devices re-seed; a test checks it)
npm run icons -w @fitness/web        # regenerate PWA icons
```

## Deployment

`Dockerfile` + `docker-compose.yml` (root) build the `app` container (+ `db` = postgres:17, volume `fitness_pgdata`, no port) behind the VPS's existing Traefik; settings in `.env` (template `.env.example`). The VPS agent "Hermes" deploys it following `ForHermesInstruction.md`. Keep that file in sync when the deployment changes.

## Code map (apps/api/src)

- `app.ts` Hono app (middleware: session, CSRF, no-store; static files) · `index.ts` server entry · `cli.ts` admin commands.
- `db/schema.ts` users, sessions, records (generic JSONB sync store) · `db/client.ts` postgres.js or PGlite + migrations (`apps/api/drizzle/`, `npm run db:generate -w @fitness/api`).
- `auth/` password (scrypt), session (cookie, sliding 1 year), rateLimit · `routes/` auth, admin, sync · `users.ts` user management.
- Tests: `app.test.ts` (API), `sync.integration.test.ts` (the real web sync engine against the real API, two devices).

## Code map (apps/web/src)

- `db/db.ts` Dexie schema · `db/mutate.ts` the single write path · `db/actions.ts` every domain action (workouts, routines, exercises, settings, backup) · `db/seed.ts` catalog + settings seeding.
- `data/hooks.ts` live queries (`useSettings`, `useCatalog`, `useTraining`, `useActiveWorkout`, `useRoutines`, `useRest`). `lib/training.ts` derives history, per-exercise sessions and PRs from raw rows (pure, tested).
- `features/<screen>/` one folder per screen spec; `features/workout/SetTable.tsx` is the set table shared by live logging and history edit mode; `features/exercises/ExerciseBrowser.tsx` is shared by the Exercises tab and the picker.
- `ui/` Sheet/MenuSheet/ConfirmSheet/RadioSheet/TextSheet, Toast (with Undo), Overlay, ReorderList, LineChart, icons. `app/` router, Layout (login gate, nav, mini bar), theme (accent/text size/theme on `<html>`).
- `i18n/` en.ts (source dictionary) + de.ts (typed `Dict`), `useT()` in components, `tr()`/`currentLanguage()` elsewhere. Every UI string goes into both files. German catalog: `packages/shared/data/exercises.de.json` by slug, seeded in the chosen language ([ADR 0007](docs/adr/0007-german-language.md)).
- `sync/engine.ts` push/pull + triggers · `sync/account.ts` login (re-own local data), logout (wipe) · `api/client.ts` fetch wrapper · `db/owner.ts` current userId for writes. `features/auth/` Login, `features/admin/` Users (admin only), `features/profile/AccountSection.tsx`.

## Architecture rules

- **Local-first.** The browser database (Dexie/IndexedDB) is the app's source of truth. UI components read with `useLiveQuery`. There is no TanStack Query and no repository/HTTP layer in the UI. The network is only used by the sync engine. Details: [docs/architecture/sync.md](docs/architecture/sync.md).
- **One write path.** Every write goes through the `upsert`/`softDelete` helpers (`apps/web/src/db/mutate.ts`), which set `updatedAt`/`userId` and append to the `outbox` in the same transaction. Never write to Dexie tables directly from components. Never hard-delete synced rows.
- **IDs are generated on the client**: UUIDv7 for user data; deterministic UUIDv5 for built-in exercises (never synced).
- **Zod schemas in `packages/shared` are the single source of truth** for entity shapes; derive types with `z.infer`.
- **Activity model:** a generic `activity` (type `gym | run | swim`) is the timeline spine. Type-specific data lives in child tables. New activity types add a type value plus child tables. They never add nullable columns to `activities`. Nutrition is a separate domain. See [docs/architecture/data-model.md](docs/architecture/data-model.md) and the `add-activity-type` skill.
- **SI units only in storage** (kg, m, s, UTC ISO timestamps). Format at display time via `packages/shared` helpers (`formatWeight`, dates, decimals), which read the user's settings (kg/lb, decimal comma, date format). Never format numbers or dates inline in components.
- **Derived, not stored:** PRs (heaviest weight only), e1RM (Epley) are computed from sets in `lib/training.ts`. No volume anywhere in the UI.
- **Settings:** synced ones live in the `settings` table (`useSettings`), device-only ones (keep screen on, vibration, text size) in `meta` (`useDeviceSettings`). The rest timer state is in `meta` too and is computed from timestamps.

## Design rules (see [docs/design/ui-guidelines.md](docs/design/ui-guidelines.md))

The visual design ("Graphite A5") is **decided**. Colour tokens, type scale, formats, spacing and component specs are in the guidelines. Use those tokens and don't invent new colours or sizes. Key points:
- Dark by default (`#0A0C0F`), cobalt accent `#4F86F7` (default; the user can pick one of 5 accents, so always use the `accent*` tokens), light Hairline cards, IBM Plex Sans with tabular numbers, base size 17 px, uppercase 11 px labels.
- Plain and calm: no emojis, little text. **Readability is the top priority**, especially in workout history/detail.
- A number and its unit never wrap apart (`9 840 kg`).

## Project skills

- `.claude/skills/add-activity-type`: checklist for adding a new activity type (run, swim, …).
