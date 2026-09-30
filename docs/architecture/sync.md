# Offline-first storage and sync

Decision and alternatives: [ADR 0002](../adr/0002-offline-sync.md).

## Idea in one sentence
The app only ever reads and writes the **local browser database**, and a background sync engine exchanges changes with the server whenever there is a connection.

```
 UI components
   │ read: useLiveQuery        │ write: upsert() / softDelete()
   ▼                           ▼
 Dexie (IndexedDB) ── tables + outbox + meta(syncCursor)
   ▲                           │
   │ pull (apply newer rows)   │ push (outbox rows)
   └──────── sync engine ──────┘
                 │ HTTPS
                 ▼
        Hono API  /api/sync/push, /api/sync/pull
                 │
             PostgreSQL
```

## Local write
Every change runs inside **one Dexie transaction**:
1. Set `updatedAt = now()` (and `userId`) on the row and upsert it.
2. Append `{ table, id }` to the `outbox` table.

Deleting sets `deletedAt` (soft delete) and goes through the same path. Rows are never hard-deleted, because other devices need to learn about the delete.

## Push: `POST /api/sync/push`
- The client sends the current snapshot of every row referenced in the outbox (in batches).
- For each row, the server checks that it belongs to the user and validates it with the shared Zod schema. It then **upserts only if the incoming `updated_at` ≥ the stored `updated_at`** (last-write-wins per row), and assigns a new `server_version`.
- The response lists the accepted IDs, and the client removes those outbox entries.
- If the server rejects a row (validation error), it is reported and kept aside, so it doesn't block the queue.

## Pull: `GET /api/sync/pull?since=<cursor>`
- Returns all of the user's rows with `server_version > cursor`, across all tables, in pages.
- The client applies a row only if it is newer than the local copy (and not waiting in the outbox), then stores the new cursor in `meta`.

## When sync runs
App start, the browser `online` event, every 60 s while the app is visible, when the app comes back to the foreground, right after finishing a workout, after login, and **Sync now** in Profile. The order is always **push, then pull**. Only one sync runs at a time.

## Why last-write-wins is safe enough here
Sets and workouts are almost always created on one device and rarely edited on two devices at the same time. Conflicts are rare, and when one happens, the newest edit winning is acceptable.

Known limitation: device clocks can drift. That's acceptable for a personal app. If it ever becomes a problem, the server can stamp `updated_at` itself.

## Accounts, first login and logout (M7/M8)
- The app is **locked until the first login** on a device (`meta.account` missing → Login screen). After that it opens offline; the session cookie lasts 1 year (sliding).
- **First login:** all rows with `userId = "local"` are re-owned by the account and uploaded (they are already in the outbox). The first sync **pulls first**, so the account's settings replace this device's defaults.
- If a different user logs in on a device, the previous user's data is wiped first.
- **Logout:** sync; if changes are still waiting (offline), the user is warned. Then the session is ended, and the user's tables, outbox and sync meta are wiped. The catalog and device settings stay.
- A 401 during sync sets `meta.sessionExpired`: the Login screen appears, and the local data is kept and synced after the next login.
- Status for the Profile screen: `meta.sync` `{ state, lastSyncAt, error }` plus the outbox size. Rejected rows are kept in `meta.syncRejected`.
- Code: `apps/web/src/sync/engine.ts` (push/pull), `apps/web/src/sync/account.ts` (login/logout), `apps/api/src/routes/sync.ts`.

## Before the backend existed (milestones M1–M6)
- **Local-only mode**: no account, and rows use `userId = "local"`. The outbox fills up but is not sent.
- **First login (M8)**: all `"local"` rows are re-owned by the real user ID and pushed. After that, sync works normally.

## Built-in data
Built-in exercises ship with the app bundle and are seeded into Dexie when `meta.catalogVersion` changes. They are never synced.
