---
name: add-activity-type
description: Checklist for adding a new activity type (e.g. running, swimming, cycling) to the fitness tracker across shared schemas, Dexie local DB, sync, API and Postgres. Use when the user wants to track a new kind of activity.
---

# Add a new activity type

Read `docs/architecture/data-model.md` and `docs/architecture/sync.md` first. The shared `activities` table stays generic, and type-specific data goes in its own child table. Remember the working mode in CLAUDE.md: plan the steps with the user and let them implement, unless they ask you to write the code.

1. **Plan and document**: agree on fields with the user; update `docs/architecture/data-model.md` and `docs/requirements.md`; add an ADR if it involves a real decision (e.g. GPX import).
2. **Shared schema** (`packages/shared`)
   - Add the literal to the `activities.type` enum.
   - Create `<type>.ts` with the Zod schema for the child table (common synced columns, SI units only).
   - Add formatting/metric helpers (pace, per-100 m swim time, …) with tests.
3. **Local DB** (`apps/web/src/db`)
   - Add the table to the Dexie schema in a **new schema version** (never edit an existing version).
   - All writes go through `upsert`/`softDelete` so they reach the outbox.
4. **Sync**: register the new table in the push/pull table list (client and server).
5. **Postgres** (`apps/api`): Drizzle table with `activity_id` FK (cascade), `user_id`, the common columns and `server_version`; `npm run db:generate -w apps/api`, review the SQL, then migrate.
6. **Frontend** (`apps/web/src/features/<type>/`): routes, log form (mobile-first), detail view; include the type in the History timeline. Follow `docs/design/ui-guidelines.md`.
7. **Tests**: schema/helper unit tests, and an E2E test for logging one activity offline.
8. Tick the item in `docs/roadmap.md`.
