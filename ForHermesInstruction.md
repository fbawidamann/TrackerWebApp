# Deployment instructions for Hermes

Hermes, this is Florian's fitness tracker app. Please deploy it on this VPS behind the **existing Traefik**, at:

**https://tracker.fbawidamannserver.cloud**

You know how Traefik runs on this server better than anyone, so adapt the Traefik-specific values (network, entrypoint, resolver, any middlewares) to match the setup here. Everything else is ready in the repo.

## What you are deploying

- **One container, `fitness-app`**, built from the `Dockerfile` in the repo root. It's a Node 24 server (Hono) on port **3000** that serves:
  - the web app (static files, a PWA that works offline),
  - `/api/health` → `{"ok":true}`, the health check.
- There is **no database yet.** A Postgres container will be added later (milestone M7), in the same `docker-compose.yml`, on a private network. Nothing to do for that now.
- The app must be served over **HTTPS**, because the offline mode (service worker) only works there.

Files in the repo root that matter to you:

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build: installs, downloads ~1,750 exercise images (~100 MB) from GitHub, builds, runs as user `node` |
| `docker-compose.yml` | The `app` service with Traefik labels; joins the external Traefik network |
| `.env.example` | Template for `.env` (domain, Traefik network, entrypoint, cert resolver) |

## Steps

### 1. Get the code onto the server
Florian gives you the code either as a **git URL** (then `git clone <url> /opt/fitness-tracker`) or as a **copied folder** at `/opt/fitness-tracker`. If neither is there yet, stop and ask him. Don't invent a source.

### 2. Read the existing Traefik setup (read-only)
Find these values, but do **not** change the Traefik configuration:
- **Network:** the Docker network Traefik uses to reach containers (`docker inspect <traefik-container>` → Networks, or look at another service it routes to).
- **HTTPS entrypoint name:** e.g. `websecure` or `https` (static config or command args of the Traefik container).
- **Cert resolver:** Florian says it is `letsencrypt`. Please confirm it exists.
- **Provider settings:** if `exposedByDefault=false`, the label `traefik.enable=true` (already in the compose file) is what's needed.
- **Conventions on this host:** if other services use extra labels (e.g. an HTTP→HTTPS redirect middleware, a security-headers middleware, a specific `tls.domains` wildcard), follow the same pattern. You may add matching labels to `docker-compose.yml`.

### 3. DNS
Make sure `tracker.fbawidamannserver.cloud` resolves to this server's public IP (`dig +short tracker.fbawidamannserver.cloud`). If it doesn't, tell Florian which A record to add, and wait. Let's Encrypt fails without it.

### 4. Configure
```bash
cd /opt/fitness-tracker
cp .env.example .env
# edit .env: APP_DOMAIN, TRAEFIK_NETWORK, TRAEFIK_ENTRYPOINT, TRAEFIK_CERTRESOLVER to match step 2
docker compose config    # must show the right labels and the external network, with no errors
```

### 5. Build and start
```bash
docker compose up -d --build
```
The first build takes several minutes, because it downloads npm packages and ~100 MB of exercise images from `raw.githubusercontent.com`. Later builds reuse the cached layers.

### 6. Verify
```bash
docker ps --filter name=fitness-app                                # STATUS should become "(healthy)"
docker logs fitness-app                                            # "Fitness app listening on :3000 ..."
curl -s https://tracker.fbawidamannserver.cloud/api/health         # {"ok":true}
curl -sI https://tracker.fbawidamannserver.cloud/ | head -5          # 200, valid certificate
curl -sI https://tracker.fbawidamannserver.cloud/sw.js | grep -i cache-control   # no-cache
curl -s -o /dev/null -w "%{http_code}\n" https://tracker.fbawidamannserver.cloud/history   # 200 (app routes fall back to the app)
```
Also check that `http://` redirects to `https://` the same way it does for the other services here.

## Updating later
```bash
cd /opt/fitness-tracker
git pull                      # or Florian copies the new folder
docker compose up -d --build
docker image prune -f         # removes dangling old images only
```

## Please don't
- Change Traefik's own configuration, or touch other containers or their networks.
- Publish port 3000 (or any port) on the host. Only Traefik may reach the container.
- Commit `.env` anywhere, or put secrets into the repo.
- Run `docker system prune -a --volumes`, or delete any volumes. Later the database volume will hold Florian's data.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Traefik 404 for the domain | Router not picked up: wrong network, `traefik.enable` ignored, or wrong entrypoint name. Check the Traefik logs and dashboard |
| 502 / 504 Bad Gateway | Container not on Traefik's network, or `traefik.docker.network` doesn't match. The service port must be 3000 |
| Certificate error / staging cert | DNS not pointing here yet, wrong resolver name, or the ACME challenge can't reach port 80/443 |
| Build fails at `catalog:images` | No outbound access to `raw.githubusercontent.com`. Retry, or check the firewall/proxy |
| Container `unhealthy` | `docker logs fitness-app`. The health check calls `http://127.0.0.1:3000/api/health` inside the container |

## Please report back to Florian
1. The final `.env` values (domain, network, entrypoint, resolver). They're not secret.
2. Any labels you added to `docker-compose.yml` and why, so they can be put back into the repo.
3. The output of the verification commands in step 6.
4. Anything about this server's Traefik setup that the next deployment (the Postgres database, M7) should know.
