# Deployment instructions for Hermes

Hermes, this is Florian's fitness tracker app. Please deploy it on this VPS behind the **existing Traefik**, at:

**https://tracker.fbawidamannserver.cloud**

You know how Traefik runs on this server better than anyone, so adapt the Traefik-specific values (network, entrypoint, resolver, any middlewares) to match the setup here. Everything else is ready in the repo.

> **Status (2026-09-30):** the app container is live (thanks!). **Your current task is the "M7 update" right below:** it adds the database, accounts and sync. The rest of this file is the original first-time setup, kept for reference.

## M7 update: database, accounts, sync

What changes: a second container **`fitness-db`** (`postgres:17-alpine`, named volume **`fitness_pgdata`**, **no published port**) joins `fitness-app` in the same `docker-compose.yml`. The app now needs a login. There is no registration: the admin **`LegendFLOO`** creates all accounts. The Traefik labels are unchanged.

### 1. Pull and add the database password
```bash
cd /opt/fitness-tracker
git pull
grep -q '^DB_PASSWORD=.' .env || echo "DB_PASSWORD=$(openssl rand -hex 32)" >> .env   # hex = URL-safe; generate once, never change
chmod 600 .env
```
Keep `.env` as the only place the DB password lives. Changing it later needs a manual `ALTER USER` in Postgres, so don't rotate it casually.

### 2. Build and start
```bash
docker compose up -d --build
docker compose ps                         # fitness-db healthy, fitness-app healthy
docker logs fitness-app --tail 20         # "Fitness app listening on :3000 (… db: postgres)"
```
The tables are created automatically at app start (migrations in `/app/drizzle`).

### 3. Create the admin account `LegendFLOO` (once)
The password must have at least 8 characters, with a digit and a special character. It is **not stored anywhere** except as a hash in the database.

- **Preferred:** Florian runs it himself in an SSH session and types the password (hidden input):
  ```bash
  docker compose exec app node dist/cli.js create-admin LegendFLOO
  ```
- **If you do it:** generate a one-time password, pass it on stdin, tell it to Florian **once** in your report, and don't write it to any file or log. He then changes it in the app (Profile → Change password).
  ```bash
  PW="$(openssl rand -base64 12)!7"
  printf '%s' "$PW" | docker compose exec -T app node dist/cli.js create-admin LegendFLOO --password-stdin
  ```

Other commands (all via `docker compose exec app node dist/cli.js …`): `list-users`, `create-user <name>`, `reset-password <name>` (a forgotten password; also signs the user out everywhere), `enable-user <name>`.

### 4. Nightly backup (14 days)
```bash
mkdir -p /var/backups/fitness && chmod 700 /var/backups/fitness
cat > /usr/local/bin/fitness-backup <<'SH'
#!/bin/sh
set -eu
f=/var/backups/fitness/fitness-$(date +%F).dump
docker exec fitness-db pg_dump -U fitness -d fitness -Fc > "$f.tmp" && mv "$f.tmp" "$f"
find /var/backups/fitness -name 'fitness-*.dump' -mtime +13 -delete
SH
chmod 700 /usr/local/bin/fitness-backup
echo '30 3 * * * root /usr/local/bin/fitness-backup' > /etc/cron.d/fitness-backup
/usr/local/bin/fitness-backup && ls -la /var/backups/fitness      # run once now
```
If the VPS already has an off-site backup job, please include `/var/backups/fitness` in it.

### 5. Restore test (into a scratch database, not the real one)
```bash
f=$(ls -t /var/backups/fitness/fitness-*.dump | head -1)
docker exec fitness-db createdb -U fitness restore_test
docker exec -i fitness-db pg_restore -U fitness -d restore_test --no-owner < "$f"
docker exec fitness-db psql -U fitness -d restore_test -c 'select username, role from users;'
docker exec fitness-db dropdb -U fitness restore_test
```

### 6. Verify
```bash
curl -s https://tracker.fbawidamannserver.cloud/api/health          # {"ok":true}
docker port fitness-db                                              # must print nothing (no published port)
curl -s -o /dev/null -w "%{http_code}\n" https://tracker.fbawidamannserver.cloud/api/auth/me   # 401 (not logged in)
```
After the admin exists, a login over HTTPS must set the cookie `fitness_session` with `HttpOnly; Secure; SameSite=Lax`:
```bash
curl -si -X POST https://tracker.fbawidamannserver.cloud/api/auth/login \
  -H 'content-type: application/json' -H 'origin: https://tracker.fbawidamannserver.cloud' \
  -d '{"username":"LegendFLOO","password":"<password>"}' | grep -i set-cookie
```
(Skip this one if Florian set the password himself; he'll just log in on his iPhone.)

### M7: please don't
- **Never** run `docker compose down -v`, `docker volume rm fitness_pgdata` or `docker system prune --volumes`. The volume holds Florian's training data. `docker compose down` (without `-v`) and `up -d --build` are safe.
- Publish a port for `fitness-db`.

### M7: please report back
1. `docker compose ps` output and the app log line from step 2.
2. That the admin exists (`list-users`), plus the one-time password if you created it.
3. The backup file from step 4 and the result of the restore test.
4. The verification output from step 6.

## What you are deploying

- **One container, `fitness-app`**, built from the `Dockerfile` in the repo root. It's a Node 24 server (Hono) on port **3000** that serves:
  - the web app (static files, a PWA that works offline),
  - `/api/health` → `{"ok":true}`, the health check.
- Since M7 also **`fitness-db`** (Postgres 17, volume `fitness_pgdata`, no published port), see "M7 update" above.
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

### Changes made on the VPS (Hermes commits too, since 2026-10-04)
Hermes can also change the app on Florian's request and pushes to `main` as author **`Hermes (VPS)`** (deploy key with write access, repo-only). The pipeline is `/root/scripts/trackerwebapp-ship.sh ship "message"` on the VPS:
1. local checks in `node:24-alpine` (`npm ci`, lint, typecheck, test, build); stops on any failure, nothing is committed;
2. commit + push to `main`, then waits for the GitHub Actions **CI** run of that commit; no deploy unless it is green;
3. `pg_dump` backup to `/var/backups/fitness/predeploy-*.dump`, rebuild and restart **only** `fitness-app`;
4. health check (container healthy, site and `/api/health` 200); if it fails, the previous image is restored automatically.

So when working on the PC: **`git pull` before you start**, because `main` may have new commits from the VPS.

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
