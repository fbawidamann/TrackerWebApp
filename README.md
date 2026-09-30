# Fitness Tracker

A personal, offline-first gym tracker (PWA). Log workouts on the phone, see progress and PRs, plan routines.
Everything is stored on the device (IndexedDB) and works offline; a small server keeps a copy and syncs phone and PC. Login with username + password; only the admin creates accounts.

## Run it

Requires Node 24.

```bash
npm install
npm run catalog:images   # once: downloads the exercise pictures (~100 MB, not in Git)
npm run build            # once, for the admin CLI
node apps/api/dist/cli.js create-admin LegendFLOO   # local admin account (PGlite in apps/api/.data)
npm run dev:api          # API on :3000 (second terminal)
npm run dev              # http://localhost:5173 (also shown with your network IP); /api goes to :3000
```

### On the iPhone
1. The PC and iPhone must be on the same Wi-Fi. Run `npm run dev` and open the **Network** address it prints (e.g. `http://192.168.1.20:5173`) in Safari.
2. Share → **Add to Home Screen** for a full-screen app icon.

Note: the offline mode (service worker) only works over HTTPS or on `localhost`. Over the local network the app runs fine, but it needs the PC to be reachable. Full offline use on the phone comes with hosting on the VPS (milestone M9).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run dev:api` | API server with a local PGlite database |
| `npm run build` | Production build (`apps/web/dist`, `apps/api/dist`) |
| `npm run preview` | Serve the production build |
| `npm test` | Unit and integration tests (shared logic, data layer, API, sync) |
| `npm run lint` / `npm run typecheck` | Code checks |
| `npm run catalog:import` | Regenerate the exercise catalog from free-exercise-db |
| `npm run catalog:images` | Download the exercise images into `apps/web/public/exercise-images` |

## Deploy
The app runs as two Docker containers (`app`, `db` = Postgres) behind Traefik on the VPS: see [`ForHermesInstruction.md`](ForHermesInstruction.md), `Dockerfile` and `docker-compose.yml`. Test the container server locally with `npm run build -w @fitness/web && npm run build -w @fitness/api`, then `STATIC_ROOT=../web/dist npm start -w @fitness/api` (port 3000).

## Docs
Planning, design specs and decisions live in [`docs/`](docs/README.md). Clickable design prototypes: [`docs/design/prototypes/`](docs/design/prototypes/README.md).
