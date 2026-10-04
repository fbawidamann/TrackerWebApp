# UI guidelines

Status: **visual design decided** (2026-09-29). Screen-by-screen layouts and flows are planned next.
Mockups used for the decisions: [look & feel](https://claude.ai/artifact/68ZJkjLgBcNUwkBMdSs7Xg) → [Graphite variants](https://claude.ai/artifact/DxjpLfDMHzW6mH1Qc95KtN) → [A5 detail picker](https://claude.ai/artifact/5yNMNZeMTQuGPeYVzZW5DF).

## Principles

1. **Readability first.** Especially in workout history and detail: generous spacing, clear hierarchy (exercise → sets), never cramped.
2. **Plain and calm, not "AI style".** No emojis, gradients, glow or decorative filler. One accent colour on cool greys. Icons (lucide) only where they carry meaning.
3. **Little text.** Short labels, no explanatory paragraphs. Numbers are the content.
4. **Dark by default**, light theme available. Follow the system setting until the user picks a theme.
5. **A number and its unit never wrap apart.** Always render value and unit in one `white-space: nowrap` element (`9 840 kg`, `1 h 04 min`).
6. **Mobile-first for logging**: large tap targets, minimal typing, main actions reachable with the thumb. Desktop uses the extra space for stats and history.

## Direction: "Graphite A5"

Chosen after comparing three directions (Graphite / Chalk / Iron) and five Graphite variants. Graphite won for the most readable numbers and the calmest look. Blue leaves room for the colours that carry meaning (done, delete, PR). A5 is the user's mix: A2's deep background and card per exercise, with light **Hairline** cards and A1's uppercase labels.

## Colour tokens

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `bg` | `#0A0C0F` | `#EEF0F3` | App background |
| `surface` | `#13171C` | `#FFFFFF` | Bottom nav, floating elements |
| `raised` | `#1B2027` | `#E9ECF0` | Skip button, set-number boxes, empty states |
| `line` | `#232930` | `#DFE3E8` | Input outlines, nav top border |
| `card-bg` | `#0F1216` | `#F8F9FA` | Hairline card fill |
| `card-border` | `#1A1F25` | `#E1E5E9` | Hairline card border |
| `card-divider` | `#1A1F25` | `#E4E7EB` | Faint lines between sets and list rows |
| `text` | `#EEF1F5` | `#0F1216` | Primary text |
| `muted` | `#8A93A0` | `#5A6370` | Secondary text, units, labels |
| `accent` | `#4F86F7` | `#4F86F7` | Tints, progress bars, focus |
| `accent-text` | `#6F9BF8` | `#2F63CF` | Accent-coloured text/icons (contrast-adjusted) |
| `accent-fill` | `#4F86F7` | `#3569D6` | Primary buttons, done checkbox, active dots |
| `on-accent` | `#0B0E12` | `#FFFFFF` | Text/icons on `accent-fill` |

### Accent colour is a user setting
Cobalt is the default. The user can choose among 5 accents in Profile, each with values for both themes. Every component uses the `accent*` tokens, so switching only swaps these four values:

| Accent | `accent` | `accent-text` dark / light | `accent-fill` light |
|---|---|---|---|
| **Cobalt** (default) | `#4F86F7` | `#6F9BF8` / `#2F63CF` | `#3569D6` |
| Teal | `#2FB39F` | `#3CC7B2` / `#1E7F71` | `#23907F` |
| Amber | `#E08A3C` | `#EBA05D` / `#A65E1C` | `#B8691F` |
| Rose | `#E0607E` | `#EC7D96` / `#B23D5A` | `#C4455F` |
| Violet | `#8B7CF6` | `#A194F8` / `#5B4BC4` | `#6A5AD8` |

In dark mode `accent-fill` = `accent`, and `on-accent` stays `#0B0E12` (dark) / `#FFFFFF` (light). Check contrast for each accent when implementing (the text on primary buttons must pass at least WCAG AA large text).

**Text size setting**: Large adds +2 px to every size in the type scale (base 19, set values 20, titles 30).

Derived:
- completed-set tint = `accent` at **11 %** over the card.
- active nav pill = `accent` at 14 %.

Semantic colours (success, danger, warning) are defined later, when first needed, and are never the accent.

## Typography

Font: **IBM Plex Sans** (400/500/600), with `font-variant-numeric: tabular-nums` everywhere. No mono and no condensed faces. Self-hosted from `@fontsource/ibm-plex-sans`, never from Google ([ADR 0008](../adr/0008-self-hosted-font.md)).

| Role | Size / weight | Notes |
|---|---|---|
| Screen title | **28 px** / 600, letter-spacing −0.015em | "Push Day", "Ready to train" |
| Stat value | 18 px / 600 | Summary tiles |
| Set value | **18 px** / 400 (base + 1) | `80 kg × 8` |
| Body / list row | **17 px** / 400–500 (base) | |
| Exercise name | 17 px / 600 | Equipment on a second line: 13 px, muted |
| Sub / meta | 13–14 px, muted | Dates, "4 sets", footers |
| Label | **11 px / 500, UPPERCASE, letter-spacing 0.08em**, muted | Column headers, section headers, stat labels |
| Nav label | 11 px | Always visible |

## Number and text formats

| What | Format | Example |
|---|---|---|
| Thousands | narrow no-break space (U+202F) | `9 840`, `18 310` |
| Decimals | point | `82.5` |
| Units | **same size** as the number, muted colour, never wrapped | `9 840 kg` |
| Date | long | `Tuesday, 29 September` (add the year only when it isn't the current year) |
| Time | 24 h | `17:35` |
| Duration | hours + zero-padded minutes | `58 min`, `1 h 04 min` |
| Rest / elapsed timer | clock | `0:56`, `34:12` |

In **German** ([ADR 0007](../adr/0007-german-language.md)) the same rules apply with German words: `Dienstag, 29. September`, short `Di., 29. Sept.`, `Heute` / `Gestern`, `Diese Woche`, chart months `Jan … Dez`, default names `Morgentraining` / `Abendlauf`. The decimal separator and the date format are still the user's own settings (German does not switch them to `82,5` / `29.09.2026` by itself). German words are longer: keep labels short (`Wdh.`, `Sätze`) and check segments and buttons at 375 px width.

## Shape and spacing

| Token | Value |
|---|---|
| Card radius | **14 px** |
| Button radius | **12 px** |
| Input / checkbox radius | 8–9 px |
| Screen side padding | 20 px |
| Gap between screen sections | 28 px |
| Gap between exercise cards | 14 px |
| Card padding | 18 px (active-workout card: 14 × 12 px) |
| Set row | 11 px vertical padding, **faint divider line** between sets |
| List row | 14 px vertical padding, divider between rows |
| Minimum tap target | 40 × 40 px (inputs 40 px high, checkbox 36 px + row padding) |

## Components

### Cards (Hairline)
`card-bg` fill, 1 px `card-border`, 14 px radius, no shadow. One card per exercise in workout detail and active workout. Home lists (routines, recent) and the week summary also use cards.

### Workout summary (detail screen)
- Three stat tiles in one card: **Duration · Sets · PRs**, with value on top and label below, separated by `card-divider` lines. **No volume anywhere in the UI** (decided 2026-09-30); volume may appear only in future stats pages.
- Tile widths follow their content, so values never shrink or wrap.

### Exercise block (detail)
- Header: the exercise name, with the equipment on a second line (13 px, muted); "4 sets" on the right.
- Set rows: `[set no.] [80 kg × 8] [PR marker]`, where the set number is a plain muted number and a warm-up shows as a **light** `W` (13 px, weight 500, `accent-text` blended towards `muted`). It shouldn't look heavy.
- Footer: `Best 82.5 kg · e1RM 99 kg` (13 px, muted).

### PR marker
A **medal icon** (lucide `award`-style) in `accent-text`, 18 px, at the end of the set row and in history list rows.

### Active workout set table
- Columns: `SET · PREVIOUS · KG · REPS · ✓`.
- The Previous column is muted, e.g. `80 × 8`.
- Inputs are **outlined** (1 px `line`, 8 px radius, 40 px high). Placeholders show the previous values in muted text.
- The done button is a **rounded square** (36 px, 9 px radius) that is `raised` when open and `accent-fill` with an `on-accent` check when done.
- A completed row gets the **11 % accent tint**, and its inputs lose their outline.
- There is no separate "Next exercise" card, because all exercise cards are visible one below the other.
- Swipe-to-delete: the red delete background is only visible while swiping, never at rest (no red peeking out at the rounded corners).

### Rest timer
A **floating pill above the bottom nav**: `REST` label · progress bar · `0:56` · Skip. It stays out of the way (low priority), and the screen gets extra bottom padding while it is visible.

### Home
- Order: date label → title → **full-width "+ Start workout" button at the top** → This week → Routines → Recent.
- This week: **day dots** (Mon–Sun). A day with a workout is a filled `accent-fill` dot, and today has an accent ring. Below the dots: workouts, volume and duration for the week.

### Start button (added 2026-10-04, requested by Florian)
The primary button that starts a workout (Home, Workout tab, empty History) reads **`+ Start workout`** / **`+ Training starten`** (was "Start empty workout"; the routines below make clear what "empty" meant). The plus sits in a small round `on-accent` 20 % disc.
On tap it plays a **launch animation** (~0.5 s) before the workout opens, to make starting feel rewarding: the button dips and pops, the plus spins 180° and grows, a ring and 8 small sparks burst out of it, and a light sweep crosses the button. **Deliberate exception** to principle 2 (no glow/gradients): it only exists for that half second, never at rest. Only `transform`/`opacity` are animated, accent tokens only. Double taps are ignored; with *reduce motion* it starts immediately without animation. Implementation: `apps/web/src/ui/StartWorkoutButton.tsx`, CSS "Start button" in `app.css`.

### Sheets (bottom sheets)
Phone: a sheet slides up from the bottom with a grab handle and scrolls inside when its content is long (max 88 % height). It closes by tapping the scrim, with Escape, or (added 2026-10-04) by **swiping down**: the drag only starts when the content is scrolled to the very top and the finger moves down, so scrolling inside a long sheet (routine preview) keeps working. Release after more than 90 px, or a fast flick, closes it; less springs back. The scrim fades along with the drag. Desktop (≥ 1024 px): centred dialog, no handle, no swipe. Implementation: `apps/web/src/ui/useSwipeToClose.ts`.

### Bottom navigation
Home · History · Workout · Running · Exercises · Profile (six tabs since running, 2026-10-01), with icons and **always-visible labels**. The active tab gets `accent-text` and a pill background. It sits on `surface` with a `line` top border.

## App icon (chosen 2026-10-01)

**Goal Ring**: a glowing cobalt progress ring (about 80 % closed, like the weekly goal) around a silver dumbbell, on the deep Graphite background with a soft cobalt halo. It was chosen from two rounds of options (see [prototypes/11-app-icons.html](prototypes/11-app-icons.html)); the first, flat round was rejected as too plain.
- Source: `apps/web/assets/app-icon.svg`. `npm run icons -w @fitness/web` renders `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` (also maskable; the artwork stays inside the safe zone), `favicon-32.png` and `favicon.svg`.
- App icons may use gradients and glow. The in-app UI stays flat (no gradients), as in the principles above.
- The login screen uses this icon as its brand mark.

## Screens (next planning step)

1. Home
2. Active workout (core screen)
3. Exercise picker / Exercises
4. Routines (list, editor)
5. History + workout detail
6. Exercise detail (charts, PRs, instructions)
7. Stats (desktop)
8. Profile / Settings
9. Login / Register (M7)
