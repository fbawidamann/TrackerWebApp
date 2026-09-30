# ADR 0004: Deployment behind the existing Traefik, two containers

- Status: **Accepted**
- Date: 2026-10-01

## Context
The user's VPS already runs **Traefik** as the reverse proxy, handling HTTPS certificates and routing domains to containers. ADR 0001 had planned Caddy for exactly that job, which would now be redundant. The app must be served over HTTPS so that the PWA (service worker) works offline on the iPhone.

## Decision
Two containers in one Docker Compose project, attached to Traefik:

```
Internet ─► Traefik (existing, HTTPS) ─► app  :3000  ─► db :5432
                                          │              (internal network only)
                                          ├─ /api/*   → Hono API
                                          └─ /*       → built frontend (static files, SPA fallback)
```

| Container | Image | Contents | Exposed |
|---|---|---|---|
| **app** | built from this repo (multi-stage Dockerfile) | Hono (Node 24) serving the API under `/api` **and** the built `apps/web/dist` (including exercise images) as static files | Only to Traefik, via labels (`Host(<domain>)`, certresolver) |
| **db** | `postgres:17` | Database, data in a named volume | **Not** exposed; reachable only on the private Compose network |

Backups: a nightly `pg_dump` from the host (cron → `docker exec db pg_dump`) into a backup folder, keeping 14 days.

## Why one app container instead of separate frontend + API containers
- **Same origin:** frontend and API share a domain, so there's no CORS, and the login cookie (httpOnly) just works.
- **One image, one deploy.** The frontend is only static files, and Hono serves them in a few lines (`serveStatic` + fallback to `index.html`).
- **Less to run** on a small VPS.

The trade-off is that the frontend and API are always deployed together. That's fine for one developer.

## Order
The **app** container can go live **before the backend exists** (M9 before M7): it then serves only the static frontend, which gives HTTPS and real offline use on the iPhone right away. The **db** container and the `/api` routes are added with M7.

## Actual VPS setup (found by Hermes at first deploy, 2026-10-01)
- Traefik runs with **`network_mode: host`**, so there is no Traefik Docker network. The `app` container publishes its port on **`127.0.0.1:${APP_HOST_PORT}`** only (e.g. 63255), and the router uses `loadbalancer.server.url=http://127.0.0.1:${APP_HOST_PORT}`.
- Entrypoints: `web,websecure` (HTTP → HTTPS redirect with 301). Middleware: `secure-headers@file` (HSTS, X-Frame-Options, nosniff), the same as the other sites on the VPS. Let's Encrypt uses the HTTP-01 challenge on port 80.
- **For M7:** the `db` service stays on the default Compose network with **no published port**. `app` reaches it as `db:5432`, because `app` itself is not in host network mode. Protect the database volume from any cleanup commands.

## Consequences
- There is no Caddy in the stack.
- Compose settings live in `.env` on the VPS (template: `.env.example`).
- The exercise images (~100 MB) are baked into the app image at build time (`npm run catalog:images` in the Dockerfile), not committed to Git.
