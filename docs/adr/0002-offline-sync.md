# ADR 0002: Offline-first sync with a custom outbox

- Status: **Accepted**
- Date: 2026-09-29

## Context
Workouts are logged on a phone in the gym, often with no reception. Logging must never wait for the network or lose data, and the data must end up on the server and on other devices (desktop for stats).

## Decision
Build our own sync: the **local Dexie database is the source of truth** plus an **outbox**, with **push/pull endpoints** on the Hono API.
- IDs are generated on the client (UUIDv7), so there are no ID collisions and no round-trip is needed to create rows.
- Last-write-wins per row, based on `updated_at`.
- Soft deletes (`deleted_at`) so deletes sync.
- The server's global `server_version` sequence acts as the pull cursor.

How it works: [architecture/sync.md](../architecture/sync.md).

## Alternatives considered

| Option | Why not (for now) |
|---|---|
| **PowerSync (self-hosted)** | Proven and handles edge cases, but it is an extra service on the VPS with its own config language, more moving parts, and self-hosted licensing to check. |
| **Zero (Rocicorp) / ElectricSQL** | Elegant real-time sync, but young and changing fast, with a bigger infrastructure footprint. Risky as a foundation. |
| **Online-only + short offline tolerance** | Simpler, but you would lose data when finishing a workout without reception. |

## Why custom fits this app
- The data is mostly **appended** (new workouts and sets) and rarely edited on two devices at the same time, so row-level last-write-wins is safe enough.
- It works perfectly for the frontend-first phase: the app is fully functional with only the local database, and the backend later becomes the sync target without UI changes.
- Full control and understanding. It is about 300–500 lines plus tests.

## Consequences
- We must write and test the sync code ourselves: outbox, push, pull, cursor, re-owning local data at first login.
- Every write must go through the single write path (`upsert`/`softDelete`); a direct Dexie write would never sync.
- Device clock drift can pick the "wrong" winner in rare conflicts. Accepted; server-side stamping is a possible fix later.
- If needs grow (collaboration, real-time), we can revisit PowerSync/Zero in a new ADR.
