# Screen: Login + Account (Profile)

Status: **draft for prototype review** (2026-10-01). Backend decisions: [ADR 0005](../../adr/0005-backend-auth-and-sync.md) (to be written), plan M7/M8 in [roadmap](../../roadmap.md).
Prototype: [10-login-admin.html](../prototypes/10-login-admin.html) ([online](https://claude.ai/artifact/VdRJ6tfNa4bLbjCRhpw2zX)).

## Rules (decided)
- There is **no registration**. Accounts are created only by the admin (`LegendFLOO`).
- The app is **locked until the first login** on a device. After that it opens directly, also offline (session: 1 year, sliding).
- **Password rule:** at least 8 characters, with at least one digit and one special character.
- **First login on a device with local data:** that data is uploaded into the account.

## Login screen
A full screen with no bottom nav, centred in the upper third:

```
        [app icon]
        Fitness

  USERNAME
  [ LegendFLOO              ]
  PASSWORD
  [ ••••••••••          [eye] ]

  [          Log in           ]

  Accounts are created by the admin.     ← muted, 14 px
```
- Autofill-friendly: `autocomplete="username"` / `"current-password"`, so the iPhone keychain can fill both.
- The **eye** button shows or hides the password.
- **Log in** is disabled until both fields are filled. While waiting it shows `Logging in…`.
- **Errors** appear inline under the password field (`danger` colour, 14 px):
  - wrong credentials or disabled account → `Username or password is wrong` (deliberately the same message),
  - rate-limited → `Too many attempts. Try again in 15 min.`,
  - offline → `No connection. Connect to the internet to log in.`
- **After success:**
  - with local data → a short full-screen state `Uploading your data…` (e.g. `142 workouts`), then Home;
  - otherwise → `Loading your data…` (pull), then Home.

## Profile → Account section (replaces "Saved on this device")
```
ACCOUNT
┌ card ─────────────────────────────────┐
│ LegendFLOO                   [Admin]  │  username + role tag (admin only)
│ Synced 2 min ago                      │  sync status, muted
│───────────────────────────────────────│
│ Sync now                              │
│ Change password                    ›  │
│ Users                              ›  │  admin only
│ Log out                               │  danger colour
└───────────────────────────────────────┘
```
- **Sync status texts:**
  - `Synced just now` / `Synced 2 min ago` / `Synced yesterday, 18:40`
  - `Syncing…`
  - `Offline · 3 changes waiting`
  - `Sync failed · Try again` (with an accent link)
- **Sync now** starts a sync, and the status updates.
- **Change password** opens a sheet with `Current password`, `New password` and `Repeat new password`, plus a live rule checklist (8+ characters · a number · a special character). Each rule turns accent-coloured with a check when met. Save is enabled only when all rules are met and the two new passwords match.
- **Log out** opens a sheet:
  - Everything synced: `Log out?`, `Your data stays on the server and is removed from this device.` → **Log out** / Cancel.
  - Changes waiting and offline: `3 changes aren't uploaded yet` / `Without a connection they will be lost if you log out now.` → **Log out anyway** (danger) / Cancel.
