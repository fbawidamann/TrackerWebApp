---
name: add-activity-type
description: Checklist for adding a new activity type (e.g. running, swimming, cycling) to the fitness tracker across shared schemas, Dexie local DB, sync, API and Postgres. Use when the user wants to track a new kind of activity.
---

# Add a new activity type

Read `docs/architecture/data-model.md` and `docs/architecture/sync.md` first. The shared `activities` table stays generic, and type-specific data goes in its own child table. Remember the working mode in CLAUDE.md: since 2026-09-30 Claude writes the code, following the specs in `docs/`.

1. **Plan and document**: agree on fields with the user; update `docs/architecture/data-model.md` and `docs/requirements.md`; add an ADR if it involves a real decision (e.g. GPX import).
2. **Shared schema** (`packages/shared`)
   - Add the literal to the `activities.type` enum.
   - Create `<type>.ts` with the Zod schema for the child table (common synced columns, SI units only).
   - Add formatting/metric helpers (pace, per-100 m swim time, …) with tests.
3. **Local DB** (`apps/web/src/db`)
   - Add the table to the Dexie schema in a **new schema version** (never edit an existing version).
   - All writes go through `upsert`/`softDelete` so they reach the outbox.
4. **Sync**: register the new table in the push/pull table list (client and server).
5. **Server** (`apps/api`): nothing to migrate. Rows are stored in the generic `records` table ([ADR 0005](../../../docs/adr/0005-backend-auth-and-sync.md)); adding the schema to `SYNCED_TABLE_SCHEMAS` in `packages/shared/src/api.ts` is enough. Add the tables to the backup schema (optional arrays, so old backups still import). Running is the worked example ([ADR 0006](../../../docs/adr/0006-running.md)).
6. **Frontend** (`apps/web/src/features/<type>/`): routes, log form (mobile-first), detail view; include the type in the History timeline. Follow `docs/design/ui-guidelines.md`.
7. **Tests**: schema/helper unit tests, action tests (outbox, backup), and a case in `apps/api/src/sync.integration.test.ts`.
8. **Translations**: every new UI string goes into `apps/web/src/i18n/en.ts` and `de.ts` ([ADR 0007](../../../docs/adr/0007-german-language.md)).
9. Tick the item in `docs/roadmap.md`.
