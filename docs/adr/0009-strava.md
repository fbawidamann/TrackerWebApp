# ADR 0009: Strava connection

Status: **accepted** (2026-10-04, requested by Florian)

## Context
Runs come from watches (Garmin, Apple Watch). Garmin's API is for business partners only and Apple Health is not
reachable from a web app. Strava has a free OAuth API that personal apps may use, and Garmin Connect / most watches
already sync to Strava. So Strava is the one door to "runs arrive by themselves".

## Decision
**Server side** (`apps/api/src/strava.ts`, `routes/strava.ts`):
- OAuth 2 web flow, scope **`activity:read_all`** only (read; nothing is ever written to Strava).
- The Strava API app's client id/secret live in `.env` (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`), never in the client.
  Without them the feature is off and the Profile card says "not set up on this server".
- Tokens are stored per user in the new table `strava_connections`, **encrypted with AES-256-GCM**
  (`STRAVA_TOKEN_KEY`, 32 bytes hex). A database dump alone does not reveal them. Deleting a user deletes the row.
- The OAuth `state` is **HMAC-signed, carries the user id, expires after 10 min and is single-use**. The callback
  therefore works without the session cookie: an iPhone home-screen app opens strava.com in an in-app browser
  that may not share the app's cookies. CSRF / replay / forged states are rejected.
- Access tokens (6 h) are refreshed 5 min before expiry and the new refresh token is saved (Strava rotates them).
  A refused refresh (user removed the app in Strava's settings) deletes the connection.
- `GET /api/strava/runs` returns up to **10 runs** (Run, TrailRun, VirtualRun; rides/walks are skipped) after the
  user's cursor, oldest first, with their GPS/HR/altitude streams, already in the GPX/FIT import shape.
  `POST /api/strava/ack {next}` moves the cursor on after the client saved them (only forward, never past now).
  First import reaches back 30 days.
- Rate limits: Strava allows the whole app 100 reads / 15 min and 1,000 / day; each run costs 1 streams request.
  Per user we allow 6 `/runs` calls per 15 min (≤ 60 Strava requests); 429 from Strava is passed on as a message.
- `POST /api/strava/disconnect` revokes at Strava (best effort) and deletes the tokens.
- No webhook (yet): it would need a public, unauthenticated endpoint and a subscription; polling on app open is
  enough for one user and keeps the attack surface small.

**Client side** (`apps/web/src/features/strava/`):
- Runs are saved with the normal `importRun` (`source: "strava"`, `stravaId`), so they sync to all devices like any
  run, get best efforts and PRs. Duplicate check: same `stravaId`, or a run starting within 60 s (the same run
  imported earlier as GPX/FIT).
- Auto import when the app opens or comes back to the foreground, at most every 15 min, silent on errors;
  a toast shows "3 new runs from Strava". "Sync now" on the card does it on demand.
- Profile card right below the stats (docs/design/screens/profile.md "Strava").

**Strava brand guidelines**: the connect button links to strava.com/oauth/authorize, the button says
"Connect with Strava" in Strava orange (#FC5200), we never use the Strava logo as our icon, and imported runs link
back with the text "View on Strava".

## Consequences
- One new table (migration `0001_strava_connections`), additive; existing data untouched.
- New Strava API apps start with an athlete capacity of 1 (only the owner can connect). For more users of this app,
  raise the capacity in Strava's API settings.
- Setting it up: create the API app at https://www.strava.com/settings/api with Authorization Callback Domain =
  `APP_DOMAIN`, put id/secret and a fresh `openssl rand -hex 32` key into `.env`, recreate the app container.
  Changing `STRAVA_TOKEN_KEY` later makes the stored tokens unreadable: users simply connect again.
