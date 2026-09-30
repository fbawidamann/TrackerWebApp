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
The code is on GitHub: **https://github.com/fbawidamann/TrackerWebApp** (branch `main`).

```bash
git clone https://github.com/fbawidamann/TrackerWebApp.git /opt/fitness-tracker
```

If the repository is **private**, the clone needs read access. Preferred: create an SSH key on this server just for this repo, and ask Florian to add the **public** key as a read-only *Deploy key* (GitHub → repo → Settings → Deploy keys). Then clone via `git@github.com:fbawidamann/TrackerWebApp.git`.
```bash
ssh-keygen -t ed25519 -f ~/.ssh/fitness_deploy -N "" -C "fitness-tracker deploy"
cat ~/.ssh/fitness_deploy.pub          # send this line to Florian
# ~/.ssh/config:
#   Host github-fitness
#     HostName github.com
#     IdentityFile ~/.ssh/fitness_deploy
git clone git@github-fitness:fbawidamann/TrackerWebApp.git /opt/fitness-tracker
```
Never ask for or store Florian's GitHub password or personal tokens.

> **Status (2026-10-01): deployed and live.** Hermes' findings are now in the repo: Traefik on this VPS runs with `network_mode: host`, so the app publishes on `127.0.0.1:${APP_HOST_PORT}` and Traefik forwards to `loadbalancer.server.url=http://127.0.0.1:${APP_HOST_PORT}`. The entrypoints are `web,websecure`, and the middleware is `secure-headers@file`. `docker-compose.yml` and `.env.example` in the repo match the running setup. Steps 2–4 below were for the first deployment. For updates, see "Updating later".

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
git checkout -- docker-compose.yml   # only the first time: your local edit is now committed in the repo
git pull
docker compose up -d --build
docker image prune -f                # removes dangling old images only
```
`.env` stays as it is (it's git-ignored). If `.env.example` gains new variables, add them to `.env`.

## Please don't
- Change Traefik's own configuration, or touch other containers or their networks.
- Publish any port on a public interface. The app port is bound to `127.0.0.1` only, and only Traefik (host network) reaches it.
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
