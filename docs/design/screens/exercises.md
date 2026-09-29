# Screen: Exercises (list, picker, detail, custom exercises)

Status: **decided and approved via prototype** (2026-09-29). Prototype: [06-exercises.html](../prototypes/06-exercises.html) ([online](https://claude.ai/artifact/Gc9pbXBQ2jPjC5DtNr1vEx)).
Visual tokens and components: [../ui-guidelines.md](../ui-guidelines.md). Catalog source: [ADR 0003](../../adr/0003-exercise-catalog.md). Milestones: **M1** (list, search, filter, About), **M2** (picker), **M5** (Progress, History tabs).

The exercise list is **one component used in two places**:
1. the **Exercises tab**: browse, then tap to open the detail;
2. the **exercise picker** in the active workout: tick several, then **Add 3** (or a single choice for *Replace exercise*).

## Exercises tab: list

```
┌──────────────────────────────────────┐
│ Exercises                        [+] │  title, + = create custom exercise
│ [ Search                 ] [≡ 2]     │  search + filter button (badge = active filters)
│ (Chest ×) (Barbell ×)                │  active filter chips, tap × to remove
│                                      │
│ YOUR EXERCISES                       │  sort "Recently used"
│ ┌ card ────────────────────────────┐ │
│ │ Bench Press               Today  │ │  name / last used (muted)
│ │ Barbell · Chest                  │ │  equipment · muscle group
│ │ …                                │ │
│ └──────────────────────────────────┘ │
│ ALL EXERCISES                        │
│ ┌ card: A–Z ───────────────────────┐ │
└──────────────────────────────────────┘
```

- **Row**: the name (17 px, 500), and a meta line of equipment · muscle group (13 px, muted). Exercises you've done show when they were last used on the right (`Today`, `Tue`, `22 Sep`). Custom exercises have a muted `Custom` tag.
- The list is **virtualised** (800+ rows).
- **Search** (sticky with the filter button):
  - Case-insensitive, and matches every word as a prefix in the name + equipment (`inc db` → "Incline Press, Dumbbell").
  - Hyphens and spaces are ignored (`pullup` finds "Pull-up").
  - Results use the current sort.
- **No results**: `No exercise found`, plus a button **Create "‹search text›"** that opens the create form with the name filled in.

### Sort (in the filter panel)
| Sort | Result |
|---|---|
| **Recently used** (default) | Section **YOUR EXERCISES** (done before, latest first), then **ALL EXERCISES** A–Z |
| **A–Z** | One alphabetical list |
| **Muscle group** | Sections Chest · Back · Shoulders · Arms · Legs · Core · Other, A–Z inside each |
| **Most used** | Done exercises by number of sessions (the right side shows `12×`), then the rest A–Z |

### Filter panel
It opens from the **filter button** (sliders icon) as a bottom sheet (a popover on desktop):
- **SORT**: the four options above, single choice.
- **MUSCLE GROUP**: chips, multi-select: Chest, Back, Shoulders, Arms, Legs, Core, Other.
- **EQUIPMENT**: chips, multi-select: Barbell, Dumbbell, Machine, Cable, Bodyweight, Kettlebell, Band, Other.
- **Show hidden exercises**: a toggle, off by default.
- Buttons: **Reset** and **Show 124 exercises** (live count).
- Active filters show as chips under the search, and the filter button gets a small count badge. Sort isn't shown as a chip.
- Filter and sort are remembered separately for the Exercises tab and the picker (local UI state, not synced).

### Muscle groups
The catalog has 17 muscles. For filtering and sections they are grouped:

| Group | Catalog muscles |
|---|---|
| Chest | chest |
| Back | lats, middle back, lower back, traps |
| Shoulders | shoulders, neck |
| Arms | biceps, triceps, forearms |
| Legs | quadriceps, hamstrings, glutes, calves, abductors, adductors |
| Core | abdominals |

The detail page shows the exact muscles.

## Picker (from the active workout)
- Same list, search, filter panel and sort (default **Recently used**).
- **Add mode**: rows have tick boxes, with a sticky button **Add 3** at the bottom. Tapping a row toggles it; it doesn't open the detail.
- **Replace mode**: tapping a row replaces the exercise immediately.
- A **+** in the picker header opens the create form. The new exercise is ticked right away.

## Exercise detail

Header: back, **title** (exercise name, 28 px), sub `Barbell · Chest`, and a ⋯ menu.
Below that, a segmented control with three tabs: **Progress · History · About**. Progress opens first if the exercise was done before, otherwise About.

### Progress tab
```
[ Weight | Reps ]              3M 6M 1Y All
82.5 kg  ·  Tuesday, 29 September           ← readout: latest point, or the touched point
┌ chart ──────────────────────────────┐
│ 85 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄●   │
│ 80 ┄┄┄┄┄┄┄┄┄┄┄●━━━●━━━●━━━●┄┄┄┄     │
│ 75 ┄┄┄●━━━●━━━┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄     │
│    Jul        Aug        Sep        │
└─────────────────────────────────────┘
HEAVIEST 82.5 kg        BEST SET 12 reps
PR HISTORY
 🏅 82.5 kg   Today        (was 80 kg)
 🏅 80 kg     8 Sep        (was 77.5 kg)
```
(The medal in the sketch stands for the lucide `award` icon. No emoji is used in the UI.)

- **One chart with a switch**: **Weight** = heaviest completed normal set per session; **Reps** = most reps in one completed normal set per session. For `reps_only` exercises there is only the Reps chart, and no switch.
- **Range**: **3M** (default) · 6M · 1Y · All.
- **Chart style**:
  - An `accent` line with small points, and the latest point emphasised (larger, with a ring).
  - 3–4 faint grid lines in `card-divider`, with y labels in muted 12 px and month labels on the x axis.
  - No area fill, no legend. The y axis is scaled from the data (it doesn't start at 0), with rounded ticks.
  - **Tap or drag** on the chart to select the nearest point; the readout line above the chart shows its value and date.
- **Stats row**: HEAVIEST (all time, with date) and BEST SET (most reps).
- **PR history**: every heaviest-weight PR, newest first: medal, weight, date, `was …` (muted). Tapping one opens that workout.
- **Empty** (never done): `No sessions yet`, and the tab bar opens on About.

### History tab
Past sessions of this exercise, newest first. Each is a card with the date and workout name (`Tuesday, 29 September · Push Day`), then the sets as in the workout detail (`80 kg × 8`, warm-up `W`, medal on a PR set). Tapping the card opens the workout detail. The list is paged (20 at a time).

### About tab
- **Images**: the two catalog images side by side (lazy loaded, 4:3, `card` style). They're cached by the service worker on first view.
- **Muscles**: primary (text colour) and secondary (muted), as the exact muscles.
- **Equipment**, **Level** (catalog), and **Type** (Weight & reps / Reps only / Time / Weight & time).
- **Instructions**: a numbered list, showing the first 3 steps with **Show all** below.
- Custom exercises show only Equipment, Muscle and Type.

### ⋯ menu
- **Built-in**: *Hide exercise* / *Unhide exercise*.
- **Custom**: *Edit*, *Hide exercise*, *Delete*.
  - Delete asks first. If the exercise was used: "Used in 5 workouts. It will be removed from lists; your history stays."
  - This is a soft delete, and the logged sets still show in History.
- A hidden exercise disappears from the list and the picker, unless **Show hidden exercises** is on, in which case it shows with a muted `Hidden` tag. Its history stays visible everywhere.

## Create / edit custom exercise
A full-screen form (a dialog on desktop), opened by **+**:
- **Name** (required, max 60 characters). If a visible exercise with the same name + equipment already exists, a warning appears: `Bench Press (Barbell) already exists`. Saving is still allowed.
- **Equipment**: chips, single choice.
- **Primary muscle**: a list grouped by muscle group (the 17 catalog muscles).
- **Type**: Weight & reps (default) · Reps only · Time · Weight & time.
- **Save** is disabled until a name is entered. After saving it opens the new exercise's detail, or when coming from the picker, it goes back with the exercise ticked.
- On edit, **Type** can't be changed once sets are logged (shown disabled, with the hint `Used in workouts`).

## Desktop (≥ 1024 px)
Master–detail layout: the list is on the left (360 px, with search and filters), and the detail is on the right. The filter panel opens as a popover under the filter button, and the create form as a dialog.

## States to design
| State | What is shown |
|---|---|
| List, default | Your exercises + all exercises |
| List, filtered / searched | Chips, badge on the filter button, result list |
| No results | "No exercise found" + Create "…" |
| Filter panel | Sort, muscle, equipment, show hidden, live count |
| Picker add / replace | Ticks + Add N / single tap |
| Detail, done before | Progress tab: chart, stats, PR history |
| Detail, never done | About tab first; Progress shows "No sessions yet" |
| Bodyweight exercise | Reps chart only |
| Hidden exercise | Unhide in menu; "Hidden" tag when shown |
| Create / edit form | With the duplicate warning |
