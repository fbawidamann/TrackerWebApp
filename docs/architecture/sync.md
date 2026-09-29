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
App start, the browser `online` event, every 60 s while the app is visible, and right after finishing a workout. The order is always **push, then pull**.

## Why last-write-wins is safe enough here
Sets and workouts are almost always created on one device and rarely edited on two devices at the same time. Conflicts are rare, and when one happens, the newest edit winning is acceptable.

Known limitation: device clocks can drift. That's acceptable for a personal app. If it ever becomes a problem, the server can stamp `updated_at` itself.

## Before the backend exists (milestones M1–M6)
- **Local-only mode**: no account, and rows use `userId = "local"`. The outbox fills up but is not sent.
- **First login (M8)**: all `"local"` rows are re-owned by the real user ID and pushed. After that, sync works normally.

## Built-in data
Built-in exercises ship with the app bundle and are seeded into Dexie when `meta.catalogVersion` changes. They are never synced.
