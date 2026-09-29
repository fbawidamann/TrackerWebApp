# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Personal fitness tracker web app. Gym tracking comes first, running and swimming later, food tracking after that.
**The project is in the planning phase. No code is scaffolded yet.** All decisions are recorded in [docs/](docs/README.md). Read the relevant doc before proposing changes, and record new decisions there (new ADR in `docs/adr/` for major ones).

## Working mode (important)

- The user wants to **plan in detail together first** and to **implement a lot themselves with Claude's help**. Do not build whole features on your own initiative.
- Work in small steps: explain the approach and the files involved, let the user write the code, then review and help. Write code directly only when the user asks for it.
- Every decision made in conversation gets written into the matching doc under `docs/`, so the user and future sessions can see it.

## Stack (decided, see [ADR 0001](docs/adr/0001-tech-stack.md))

TypeScript everywhere, npm workspaces, Node 24:

```
apps/web         React + Vite, TanStack Router (file-based), Tailwind v4 + shadcn/ui, lucide icons,
                 React Hook Form + Zod, Recharts, vite-plugin-pwa, Dexie (IndexedDB)
apps/api         Hono (Node), Drizzle ORM, Better Auth (email + password)   (milestone M7)
packages/shared  Zod schemas + inferred types, ID helpers, unit formatting, metrics (e1RM, PRs)
docs/            requirements, architecture, ADRs, design, roadmap
```

Database: PostgreSQL 17. Deployment: Docker Compose on the user's own VPS (Caddy + api + postgres). CI: GitHub Actions.

## Commands (planned; replace with real scripts once M0 is scaffolded)

```
npm install
npm run dev -w apps/web              # Vite dev server
npm run lint | typecheck | test | build
npx vitest run path/to/file.test.ts  # single test file (inside a workspace)
npx vitest run -t "test name"        # single test by name
npm run catalog:import               # regenerate exercise catalog from free-exercise-db
npm run db:generate -w apps/api      # drizzle-kit migration (M7+)
```

## Architecture rules

- **Local-first.** The browser database (Dexie/IndexedDB) is the app's source of truth. UI components read with `useLiveQuery`. There is no TanStack Query and no repository/HTTP layer in the UI. The network is only used by the sync engine. Details: [docs/architecture/sync.md](docs/architecture/sync.md).
- **One write path.** Every write goes through the `upsert`/`softDelete` helpers (`apps/web/src/db/mutate.ts`), which set `updatedAt`/`userId` and append to the `outbox` in the same transaction. Never write to Dexie tables directly from components. Never hard-delete synced rows.
- **IDs are generated on the client**: UUIDv7 for user data; deterministic UUIDv5 for built-in exercises (never synced).
- **Zod schemas in `packages/shared` are the single source of truth** for entity shapes; derive types with `z.infer`.
- **Activity model:** a generic `activity` (type `gym | run | swim`) is the timeline spine. Type-specific data lives in child tables. New activity types add a type value plus child tables. They never add nullable columns to `activities`. Nutrition is a separate domain. See [docs/architecture/data-model.md](docs/architecture/data-model.md) and the `add-activity-type` skill.
- **SI units only in storage** (kg, m, s, UTC ISO timestamps). Format at display time via `packages/shared` helpers (`formatWeight` etc.). The UI shows kg only for now.
- **Derived, not stored:** PRs (heaviest weight only), e1RM (Epley), volume are computed from sets.

## Design rules (see [docs/design/ui-guidelines.md](docs/design/ui-guidelines.md))

The visual design ("Graphite A5") is **decided**. Colour tokens, type scale, formats, spacing and component specs are in the guidelines. Use those tokens and don't invent new colours or sizes. Key points:
- Dark by default (`#0A0C0F`), cobalt accent `#4F86F7`, light Hairline cards, IBM Plex Sans with tabular numbers, base size 17 px, uppercase 11 px labels.
- Plain and calm: no emojis, little text. **Readability is the top priority**, especially in workout history/detail.
- A number and its unit never wrap apart (`9 840 kg`).

## Project skills

- `.claude/skills/add-activity-type`: checklist for adding a new activity type (run, swim, …).
