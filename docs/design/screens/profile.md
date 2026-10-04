# Screen: Profile and Settings

Status: **decided and approved via prototype** (2026-09-30). Prototype: [09-profile.html](../prototypes/09-profile.html) ([online](https://claude.ai/artifact/EWqYPHDNhFYZh9FZD6mKQu)).
Visual tokens and components: [../ui-guidelines.md](../ui-guidelines.md). Milestones: **M2** (training/workout settings), **M6** (appearance, formats, backup), **M7** (account). Mobile first.

The user asked for **many personalization options**, so the app can be shaped to personal taste. Every setting has a sensible default, so nothing has to be set up before using the app.

## Layout

```
Florian                                  ← name (28 px), tap → rename
Training since March 2026                ← muted
┌ Workouts │ This year │ Streak ┐        ← 3 tiles: 142 · 96 · 6 weeks
┌ (⛓) Connect Strava ─────────────────┐  ← Strava card (logged-in only), see "Strava" below
│ • New runs appear by themselves …    │
│ [   Connect with Strava   ] (orange) │
└──────────────────────────────────────┘
ACCOUNT
┌ Saved on this device ───────────────┐  info row (see Account)
TRAINING
┌ Weekly goal                   3  ›  ┐
│ Week starts on           Monday  ›  │
│ Default sets                    3  › │
│ Weight step                2.5 kg › │
│ Warm-ups in PRs & charts      [off] │
└──────────────────────────────────────┘
WORKOUT SCREEN
┌ Rest timer                     [on] ┐
│ Rest time                    1:30 ›  │  hidden when the timer is off
│ Start automatically            [on]  │  hidden when the timer is off
│ Keep screen on                 [on]  │
│ Haptic tap on set complete     [on]  │
└──────────────────────────────────────┘
APPEARANCE
┌ Theme                     System  ›  ┐
│ Accent colour   ● ● ● ● ●            │  5 swatches inline
│ Text size      [Standard | Large]    │
│ Navigation labels [Always | Active]  │
│ History cards  [Names only | Detailed]│
└──────────────────────────────────────┘
LANGUAGE AND FORMATS
┌ Language     [English | Deutsch]     ┐  each language named in itself
│ Weight unit          [kg | lb]       │
│ Decimal separator  [82.5 | 82,5]     │
│ Date format        Tuesday, 29 Sep › │
│ Example: 82,5 kg · 29.09.2026        │  live example line (muted)
└──────────────────────────────────────┘
HOME
┌ Start screen        [Home | Workout] ┐
│ Weekly goal                    [on]  │
│ Routines                       [on]  │
│ Recent workouts                [on]  │
│ Latest PRs                     [on]  │
└──────────────────────────────────────┘
DATA
┌ Export backup                     ›  ┐
│ Import backup                     ›  │
└──────────────────────────────────────┘
ABOUT
┌ Version                        0.1.1 ┐
│ Exercise data   free-exercise-db  ↗  │
└──────────────────────────────────────┘
```

### Control patterns
- **Toggle** (switch) for on/off settings, inline on the right.
- **Segmented control** inline for settings with 2 options.
- **Value + chevron** for settings with more options. Tapping opens a bottom sheet with a radio list, and choosing applies immediately and closes it.
- Every change **applies immediately**, with no Save button. Rows are 52 px or taller and grouped in cards, and section labels use the uppercase label style.

## Header
- **Name**: tap it to rename (sheet with a text field, max 30 characters). Before the first use it shows `Your name` (muted).
- **Training since**: the month of the first workout (hidden when there are none).
- **Tiles**:
  - **Workouts**: all time.
  - **This year**.
  - **Streak**: consecutive weeks in which the weekly goal was reached. The current week counts once the goal is reached; `0 weeks` otherwise.

## Settings reference

| Section | Setting | Options (default **bold**) | Scope |
|---|---|---|---|
| Training | Weekly goal | 1–7 (**3**) | synced |
| Training | Week starts on | **Monday**, Sunday | synced |
| Training | Default sets | 1–5 (**3**): sets for an exercise added without history or routine | synced |
| Training | Weight step | **2.5**, 1.25, 1, 0.5 kg (lb: 5, 2.5, 2, 1): the smallest plate increment, used for lb rounding and future ± buttons. Input accepts any multiple of 0.25 kg / 0.5 lb, so dumbbell weights like 22 kg are always valid (changed while building, 2026-09-30) | synced |
| Training | Warm-ups in PRs & charts | **off**, on | synced |
| Workout screen | Rest timer | **on**, off (off hides the floating pill entirely) | synced |
| Workout screen | Rest time | 0:30–5:00 in 15 s steps (**1:30**) | synced |
| Workout screen | Start automatically | **on**, off (off: a small `Start rest` button appears on the last completed set's row) | synced |
| Workout screen | Keep screen on | **on**, off | this device |
| Workout screen | Vibrate on set complete | **on**, off (Vibration API. iOS Safari doesn't support it, so the row is hidden there) | this device |
| Appearance | Theme | **System**, Dark, Light | synced |
| Appearance | Accent colour | **Cobalt**, Teal, Amber, Rose, Violet | synced |
| Appearance | Text size | **Standard** (17 px base), Large (19 px base, every size +2 px) | this device |
| Appearance | Navigation labels | **Always**, Active tab only | synced |
| Appearance | History cards | **Names only**, Detailed (the earlier style A: `4 sets · best 82.5 kg` per exercise) | synced |
| Language and formats | Language | **English** or Deutsch. A new device starts with the language last used on it, else the browser's (German browser → Deutsch). Changes the whole UI and the built-in exercise names and instructions at once; weight unit, decimal separator and date format stay separate settings ([ADR 0007](../../adr/0007-german-language.md)) | synced |
| Language and formats | Weight unit | **kg**, lb (stored as kg; converted and rounded to the weight step for display) | synced |
| Language and formats | Decimal separator | **82.5**, 82,5 (input accepts both regardless) | synced |
| Language and formats | Date format | **Tuesday, 29 September**, 29.09.2026 | synced |
| Home | Start screen | **Home**, Workout | synced |
| Home | Show weekly goal / Routines / Recent workouts / Latest PRs | each **on**/off | synced |

"Synced" settings live in `user_settings` and follow the account to every device. "This device" settings are stored locally (Dexie `meta`) and are never synced.

## Account
- **Local-only phase (M1–M6)**: an info row with a phone icon: **Saved on this device**, with the sub-line `Back up with Export backup`. It's not tappable.
- **From M7**: it becomes **Sign in** (when logged out), or when logged in, the email, sync status (`Synced 2 min ago` / `Offline · 3 changes waiting`) and **Sign out**.

## Data
- **Export backup**: creates `fitness-backup-2026-09-30.json` and saves it with the browser's download / share sheet. It contains all user data plus the synced settings, in the format `{ app: "fitness-tracker", schemaVersion, exportedAt, data: { <table>: [...] } }`. A toast says "Backup saved".
- **Import backup**: a file picker for `.json`. The file is validated with the shared Zod schemas, and a preview appears: `Backup from 29 September 2026 · 142 workouts · 6 routines`.
  - Then a confirmation: "Replace all data on this device?" → **Replace** / Cancel.
  - Replace swaps all local data (through the normal write path, so it syncs later). There is no merge.
  - Invalid files show "This file isn't a valid backup".
- There's no "Delete all data" and no CSV export (not chosen).

## About
The app version, and a link to free-exercise-db (the catalog source, public domain).

## States to design
| State | What is shown |
|---|---|
| Default | As in the layout |
| No workouts yet | Header without "Training since", tiles show 0 |
| Rest timer off | Rest time + Start automatically rows hidden |
| Option sheet | Radio list (theme, weight step, rest time, date format, week start, default sets, weekly goal) |
| Import preview + confirm | Sheet with backup summary, Replace |


## Strava (added 2026-10-04, v0.1.1, [ADR 0009](../adr/0009-strava.md))

A card right **below the stats tiles**, so it's the first thing after your numbers. Only for logged-in accounts.

- **Not connected**: link icon in a Strava-orange tile · "Connect Strava" · "Bring your runs in automatically." ·
  three short points (runs arrive by themselves with route/pace/HR; Garmin, Apple Watch & co. via Strava; read-only) ·
  full-width orange button **Connect with Strava** · small note "You'll confirm on Strava. You can disconnect any time".
  Tap → Strava's consent page → back on a small "Strava is connected ✓" page with *Back to the app* →
  Profile shows a toast and fetches the runs right away.
- **Connected**: orange tile, "Strava" · green-dot line "Connected as Florian B · checked 5 min ago" ·
  two buttons **Sync now** | **Disconnect** (confirm sheet: imported runs stay).
- **Server without Strava keys**: "Not set up on this server yet", no button.
- New runs also come in automatically when the app opens / returns to the foreground (max every 15 min), with a
  toast "2 new runs from Strava". Imported runs say "Imported from Strava · **View on Strava**" (link) on their detail screen.
