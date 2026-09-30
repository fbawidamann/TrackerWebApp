# Fitness Tracker "app" container: Hono serving /api + the built frontend; data in the "db" (Postgres) container.
# See docs/adr/0004-deployment.md and docs/adr/0005-backend-auth-and-sync.md

# ---------- build ----------
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci

# Exercise images (~100 MB) are downloaded here, not stored in Git.
# This layer stays cached until the catalog changes.
COPY packages/shared packages/shared
RUN npm run catalog:images

COPY . .
RUN npm run build -w @fitness/web && npm run build -w @fitness/api

# ---------- production dependencies of the server only ----------
FROM node:24-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace=@fitness/api --include-workspace-root=false

# ---------- runtime ----------
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 STATIC_ROOT=/app/public
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/web/dist ./public
# SQL migrations, applied automatically at start (found as ../drizzle next to dist)
COPY --from=build /repo/apps/api/drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "dist/index.js"]
