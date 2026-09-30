# ADR 0001: Tech stack

- Status: **Accepted**
- Date: 2026-09-29

## Context
Personal fitness tracker. Gym tracking first, then running, swimming and food. It is built by one developer, used mostly on a phone in the gym (often with bad reception), and hosted on the user's own VPS. The frontend is built first.

Requirements that drive the choice:
- Strongly linked data: routines → exercises → sets, workouts → exercises → sets, later meals → foods.
- Progress queries over time: heaviest weight, estimated 1RM, weekly volume.
- Offline-first logging with sync ([ADR 0002](0002-offline-sync.md)).
- One developer: one language across the whole stack is worth a lot.

## Decision

TypeScript everywhere, in an npm-workspaces monorepo (`apps/web`, `apps/api`, `packages/shared`), on Node 24.

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React + Vite** | A logged-in, offline app needs no server rendering. Vite builds static files that the app container serves (see ADR 0004). React has the largest ecosystem for charts, drag-and-drop and similar. |
| Routing | **TanStack Router** (file-based) | Routes and URL parameters are type-checked. |
| UI | **Tailwind v4 + shadcn/ui**, lucide icons | Fast mobile-first styling. shadcn copies accessible components into our code, so we own and can restyle them (important for the non-generic look). |
| Forms | **React Hook Form + Zod** | Validation uses the same schemas as the DB and API. |
| Charts | **Recharts** | Simple React API; enough for line/bar progress charts. |
| PWA | **vite-plugin-pwa** | Installable on the phone; the app itself loads offline. |
| Local data | **Dexie (IndexedDB) + `useLiveQuery`** | The local DB is the source of truth, and `useLiveQuery` re-renders the UI when data changes. This replaces the originally proposed repository layer + TanStack Query, which only make sense when the UI reads from the network. |
| Shared | **Zod** schemas in `packages/shared` | One definition → TS types, form validation, API validation. |
| Backend | **Hono** on Node | Small, fast, TypeScript-first. Runs as one Docker container. |
| Database | **PostgreSQL 17** | Relational integrity, strong aggregation queries for progress, JSONB if flexible fields are ever needed. Runs well in Docker. |
| ORM | **Drizzle** + drizzle-kit | Queries are close to SQL and type-safe; migrations are readable SQL files. |
| Auth | **Better Auth** (email + password) | Self-hosted library inside the API; users/sessions live in our Postgres; httpOnly cookie sessions. Can add OAuth/passkeys later. |
| Tests | **Vitest**, Testing Library, **Playwright**, fake-indexeddb | Vite-native unit tests; E2E for the logging flow. |
| CI | **GitHub Actions** | lint → typecheck → test → build on every push/PR. |
| Deploy | **Docker Compose on the VPS** (superseded by ADR 0004: existing Traefik, 2 containers) | Nightly `pg_dump` backups. |

## Alternatives considered

- **Next.js**: server rendering adds complexity that works against an offline single-page app, and it needs a Node server for the frontend.
- **SvelteKit / Vue**: good, but the React ecosystem is bigger.
- **MongoDB**: a flexible schema, but the data is relational and progress queries are SQL-shaped. Postgres JSONB covers the flexible parts.
- **MySQL / SQLite on the server**: weaker JSON support and a smaller sync ecosystem (MySQL); SQLite is limited with several syncing devices.
- **Fastify / NestJS**: Fastify is equally valid but a bit more boilerplate; NestJS is too heavy for one developer.
- **Supabase (self-hosted)**: about 10 containers, and business logic would move into RLS policies. It doesn't fit custom sync.
- **Prisma**: its own schema language and generated client; complex aggregation queries are harder to write than in Drizzle.
- **Python backend (FastAPI)**: a second language means no shared types.
- **Auth.js / Lucia / Keycloak**: Auth.js is tied mostly to Next.js; Lucia is discontinued as a library; Keycloak is a whole extra server.

## Consequences
- The shared Zod schemas mean a field change happens in one place, and the compiler finds every usage.
- The frontend is fully usable before the backend exists (local-only mode).
- Postgres runs in Docker locally and on the VPS; backups are our own responsibility.

## Implementation changes (2026-09-30, while building phase 1)

The table above is the plan. These deliberate changes were made when implementing the frontend:

| Planned | Built | Why |
|---|---|---|
| Tailwind v4 + shadcn/ui | **Plain CSS with design tokens** (`apps/web/src/styles/app.css`) | The design was already fully specified as CSS tokens and components in the approved prototypes. Porting it 1:1 is exact and needs no extra dependencies or config |
| Recharts | **Small custom SVG chart** (`ui/LineChart.tsx`) | The spec needs one simple line chart with tap-to-select. About 100 lines instead of a large library |
| TanStack Router file-based routing | **TanStack Router with code-based routes** (`app/router.tsx`) | 14 routes, with no code generation step. Links are still type-checked |
| React Hook Form | **Plain React state** | The forms are tiny (name, a few chips) |
| Virtualised exercise list | **`content-visibility: auto`** on list rows | 876 rows render fast enough on the phone, with no extra library |

Versions used: React 19, Vite 8, Zod 4, Dexie 4, vite-plugin-pwa 1, Vitest 5, TypeScript 5.9.
