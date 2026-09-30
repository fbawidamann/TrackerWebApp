# Screen: Users (admin)

Status: **draft for prototype review** (2026-10-01). Only visible to accounts with role `admin` (`LegendFLOO`). It's reached from Profile → Account → **Users**.
Prototype: [10-login-admin.html](../prototypes/10-login-admin.html) ([online](https://claude.ai/artifact/VdRJ6tfNa4bLbjCRhpw2zX)).

## List
```
←   Users                                 [+]
┌ card ────────────────────────────────────┐
│ LegendFLOO                      [Admin]  │
│ Last sync 2 min ago                      │
│──────────────────────────────────────────│
│ Anna                                  ›  │
│ Last sync yesterday · 38 workouts        │
│──────────────────────────────────────────│
│ Max                        [Disabled]  › │
│ Never logged in                          │
└──────────────────────────────────────────┘
```
- Sorted with the admin first, then A–Z.
- The meta line shows `Last sync …` (or `Never logged in`) and the number of workouts.
- Tapping a user (other than yourself) opens the **user menu**: *Reset password* · *Disable* / *Enable* · *Delete user* (danger).
- Your own row has no menu. Your password is changed under Profile → Change password.

## Create user (+)
A sheet with:
- **Username** (3–30 characters: letters, digits, `_ . -`, unique regardless of upper/lower case). Taken → `This username is taken`.
- **Password**, with the eye toggle and a **Generate** button that fills a strong random password and shows it in plain text so it can be passed on.
- A live rule checklist (8+ characters · a number · a special character).
- **Create** → the toast `Anna created`, and the new row appears.

## Reset password
A sheet with a new password (eye, Generate, rules) → **Save** → toast `Password changed · Anna has to log in again`. All of the user's sessions end.

## Disable / Enable
- **Disable** asks `Disable Anna? Anna can't log in until enabled again. Data stays.` → the user's sessions end, and the row gets a `Disabled` tag.
- **Enable** acts immediately, with a toast.

## Delete user
It asks `Delete Anna?` / `All of Anna's workouts, routines and settings are deleted from the server. This can't be undone.` → **Delete user** (danger). The row disappears, and a toast confirms it.
