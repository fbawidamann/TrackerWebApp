# ADR 0005: Backend auth and sync store

- Status: **Accepted**
- Date: 2026-10-01 (built as M7 + M8)
- Replaces the "Better Auth" line of [ADR 0001](0001-tech-stack.md). Implements [ADR 0002](0002-offline-sync.md) / [sync.md](../architecture/sync.md).

## Context
The frontend is local-first (Dexie, outbox). The server's jobs are to keep a safe copy of each user's data, share it between devices (iPhone + PC), and control who may log in. Decisions confirmed by Florian:

| Topic | Decision |
|---|---|
| Registration | None. Login with **username + password**. Only the admin **LegendFLOO** creates users (in the app or by CLI) |
| Login required | Before the first use on a device. After that the app opens offline without asking |
| Session | 1 year, sliding |
| Password rule | At least 8 characters, with a digit and a special character (`passwordSchema` in `packages/shared/src/api.ts`) |
| Forgotten password | Reset by server command (`cli.js reset-password`) or by the admin in the app |
| First admin | Created once on the VPS with `cli.js create-admin LegendFLOO`; the password is typed, not stored |
| Data from before the first login | Re-owned by the account and uploaded |
| Logout | Sync, then wipe the user's data from the device; warn if changes couldn't be uploaded |
| Backups | Nightly `pg_dump`, 14 days, on the VPS (host cron) |

## Decision 1: small custom session auth instead of Better Auth
Better Auth is built around e-mail sign-up. We need none of its features (no e-mail, no sign-up, no OAuth), and the admin-only, username-only model fits it awkwardly. The custom code is about 150 lines on `node:crypto`:

- **Passwords:** `scrypt` (N=2^15, r=8, p=1, random 16-byte salt), compared with `timingSafeEqual`. Unknown usernames are checked against a dummy hash, so the timing doesn't reveal whether a user exists.
- **Sessions:** 32 random bytes in the cookie `fitness_session` (HttpOnly, SameSite=Lax, Secure in production, Path=/, 1 year). Only the SHA-256 of the token is stored (`sessions.id`). The expiry is extended on use, at most once a day.
- **Brute force:** in-memory limiter: 5 failed logins per username + IP within 15 minutes → blocked for 15 minutes (HTTP 429). There is one generic error message.
- **CSRF:** SameSite=Lax cookie; mutating `/api` requests must be `application/json`; in production the `Origin` must be `https://<APP_DOMAIN>`.
- **Admin:** role `admin | user`. Disabling or deleting a user revokes their sessions immediately. The admin can't disable or delete themself. Deleting a user cascades to their sessions and records.
- Usernames: 3–30 characters `[A-Za-z0-9_.-]`, unique ignoring case (`username_lower`).

## Decision 2: one generic `records` table (JSONB)
```
records(user_id uuid → users, table_name text, id text, updated_at timestamptz, deleted_at timestamptz null,
        server_version bigint default nextval('sync_version'), data jsonb)
  PK (user_id, table_name, id), index (user_id, server_version)
```
- All logic (history, PRs, e1RM, charts) runs on the client. The server only has to store rows and hand them out in order, so it doesn't need a column per field.
- Each pushed row is validated with the **same Zod schema** as on the client (`SYNCED_TABLE_SCHEMAS`). `userId` is always overwritten with the session's user, and built-in exercises (`userId: null`) are rejected.
- **New entity types** (run, swim, food) need **no server migration**: add the schema to `SYNCED_TABLE_SCHEMAS` and they sync.
- There are no foreign keys between records, because sync may deliver children before parents.
- The trade-off: SQL reports over the data need JSONB queries. That's fine for a personal app, and it can change later if it's ever needed.

## Decision 3: protocol
- `POST /api/sync/push {changes: [{table, row}]}` (≤ 500): last-write-wins upsert, `updated_at` ≥ the stored one wins, each change gets a new `server_version`. Response: `{accepted, rejected}`.
- `GET /api/sync/pull?since=<cursor>` (≤ 1000 per page): `{rows, cursor, hasMore}` ordered by `server_version`.
- The client pushes, then pulls. On the **first sync after a login** it pulls first, and the account's settings replace the device defaults. Pulled rows never go into the outbox and never overwrite a row with pending local changes.

## Databases
Production uses **Postgres 17** (container `fitness-db`, via postgres.js). Local dev and tests use **PGlite** (in-process Postgres) when `DATABASE_URL` is unset, so no Docker is needed on the PC. PGlite allows only one process: stop the dev server before running `cli.js` locally. Migrations (drizzle-kit, `apps/api/drizzle/`) run automatically at server start.

## Consequences
- There is no dependency on an auth library; the security-relevant code is small and covered by tests (`apps/api/src/app.test.ts`).
- The sync is tested end to end: the real web sync engine (Dexie on fake-indexeddb) talks to the real Hono app (PGlite) as two devices (`apps/api/src/sync.integration.test.ts`).
- The login limiter is in memory, so it resets on restart. That's acceptable with one app container.
