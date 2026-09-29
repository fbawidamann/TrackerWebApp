# Fitness Tracker

A personal, offline-first gym tracker (PWA). Log workouts on the phone, see progress and PRs, plan routines.
Everything is stored on the device (IndexedDB). Sync to a server comes later (see `docs/roadmap.md`).

## Run it

Requires Node 24.

```bash
npm install
npm run catalog:images   # once: downloads the exercise pictures (~100 MB, not in Git)
npm run dev              # http://localhost:5173 (also shown with your network IP)
```

### On the iPhone
1. The PC and iPhone must be on the same Wi-Fi. Run `npm run dev` and open the **Network** address it prints (e.g. `http://192.168.1.20:5173`) in Safari.
2. Share → **Add to Home Screen** for a full-screen app icon.

Note: the offline mode (service worker) only works over HTTPS or on `localhost`. Over the local network the app runs fine, but it needs the PC to be reachable. Full offline use on the phone comes with hosting on the VPS (milestone M9).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build (`apps/web/dist`) |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (shared logic + data layer) |
| `npm run lint` / `npm run typecheck` | Code checks |
| `npm run catalog:import` | Regenerate the exercise catalog from free-exercise-db |
| `npm run catalog:images` | Download the exercise images into `apps/web/public/exercise-images` |

## Docs
Planning, design specs and decisions live in [`docs/`](docs/README.md). Clickable design prototypes: [`docs/design/prototypes/`](docs/design/prototypes/README.md).
