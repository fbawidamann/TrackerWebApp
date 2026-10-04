# Screen: Nutrition (Ernährung) — PLAN

Status: **v1 built 2026-10-04** (ADR [0010](../../adr/0010-nutrition.md)). Recipes and statistics still to come.
Phase 3 of the [roadmap](../../roadmap.md). Data model: separate domain, not part of `activities` ([data-model.md](../../architecture/data-model.md)).

## Decisions so far (Florian, 2026-10-04)

| Topic | Decision |
|---|---|
| Goal | **Muscle gain**: enough protein + a slight calorie surplus |
| Precision | **Exact**: food + grams → kcal, protein, carbs, fat |
| Food data | **Open Food Facts** (free, many German supermarket products) + **barcode scan** with the phone camera; own foods as fallback |
| Eating style | Mixed (repeats and variety) → needs fast re-logging *and* good search |
| Meal structure | **No fixed meals**: entries are simply listed by time of day |
| Targets | **App suggests** kcal + macros from body data, user can change them |
| Training vs rest days | **Same target every day** |
| Recipes | **Yes**: build a recipe from ingredients (e.g. pot of chili = 4 portions), then log portions |
| Bodyweight | **Yes**: weigh-in entries + trend curve, to check the surplus actually works |
| Place in the app | **Own tab in the bottom bar** |

## Round 3 (Florian, 2026-10-04): protein first
- **Protein ring** (circle diagram) as the hero: fill = protein / target, colour = how good the day is:
  **red** < 50 % (very little) · **yellow** < 80 % (so-so) · **green** < 100 % (fits) · **dark green** ≥ 100 % (very good); grey ring = nothing logged.
- Under the ring: the same colour as a dot for each of the **last 7 days** (tap = open that day) and "N days in a row on protein target" (≥ 80 %) from 2 days.
- **Protein and kcal are the main numbers**; carbs and fat are two small bars below.
- **Protein target**: bodyweight × **1.5–2.2 g/kg** (chips, default 1.8) **or an own gram value**.
- Barcode scan is a main button next to "Add food".

## Screens

### Nutrition tab (today) — as built
```
‹  Today  ›                                   [targets]
┌ card ──────────────────────────────────────────────┐
│  ( ring 98 g  )   kcal 1 840 / 3 050               │
│  ( of 145 g   )   ████████░░░░  1 210 left         │
│  (  so-so     )   47 g to go                       │
│  Carbs 190 / 380 g ▬▬▬    Fat 52 / 85 g ▬▬▬        │
│  Mo Di Mi Do Fr Sa So   ● ● ● ● ● ● ○  (colours)   │
└────────────────────────────────────────────────────┘
[ + Add food ]            [ ▦ Scan ]
Entries   08:10  Skyr  250 g · 158 kcal · 27.5 g protein
Weight    80.4 kg · +0.21 kg/week · trend sparkline · calm hint if off target
```

### Original sketch
```
Today                                  ‹ ›   day switch (swipe or arrows), date picker on tap
┌ card ─────────────────────────────────┐
│ 1 840 / 2 900 kcal        1 060 left │  big ring or bar for kcal
│ Protein  ███████░░  128 / 160 g      │  three macro bars, protein first
│ Carbs    █████░░░░  190 / 360 g      │
│ Fat      ████░░░░░   52 / 80 g       │
└───────────────────────────────────────┘
[ + Add food ]          [ ▦ Scan ]          primary + secondary, thumb-reachable
08:10  Oats 80 g · Milk 300 ml      612 kcal · 31 g P     one row per entry, by time
12:40  Chili (recipe) 1 portion     705 kcal · 48 g P     swipe to delete, tap to edit grams/time
...
```
- Numbers are the content, little text. Protein is the most important number for the goal, so it is always first and gets the accent.
- Over the kcal target is **not red** (a surplus is the goal); only "left"/"over" changes.

### Add food (full-screen overlay)
- Search field on top, focus immediately. Results: **Recent** and **Frequent** first (empty query), then own foods + recipes, then Open Food Facts results.
- **Barcode**: camera button → scanner → product → amount sheet. Unknown barcode → "Create food" with the barcode pre-filled.
- **Amount sheet**: grams input (big number field, decimal keyboard), quick chips (e.g. 1 portion / 100 g / last amount), live kcal + macros, time (default now). "Add".
- Multi-add: after "Add" the search stays open for the next item (a meal = several foods quickly).
- **Copy**: "Copy yesterday's entry" / "same as last time" on a recent food.

### Foods and recipes (under the tab, e.g. segmented "Today | Foods | Recipes")
- Own food: name, brand (optional), kcal/protein/carbs/fat **per 100 g** (or per 100 ml), optional portion size (e.g. 1 egg = 60 g), barcode.
- Recipe: name, ingredients (food + grams), number of portions or total cooked weight → values per portion / per 100 g are derived.
- Open Food Facts products are copied into the local `foods` table when first used (offline later, editable, synced).

### Bodyweight
- Entry: kg (or lb per setting) + date, from the Nutrition tab (small card "Weight 78.4 kg · +0.3 kg/week") and Profile.
- Detail: line chart of entries + **7-day average** trend; weekly change vs. target gain.
- Muscle-gain guideline as a hint: about **+0.25 % bodyweight per week** (≈ +0.2 kg/week at 80 kg); exact target see open question 3.

### Home / Statistics
- Home: optional small card "Today: 1 840 / 2 900 kcal · 128 / 160 g protein" (toggle in Profile like the other Home sections).
- Statistics: later — average kcal/protein per week, days on protein target.

## Target suggestion
- Inputs (Profile, new "Body" section): sex, birth year, height, current weight (from bodyweight), activity level (5 steps).
- **BMR**: Mifflin-St Jeor. **TDEE** = BMR × activity factor (1.2 / 1.375 / 1.55 / 1.725 / 1.9).
- **Muscle gain**: kcal = TDEE **+ 250** (slight surplus; adjustable +100…+500).
- **Protein**: **2.0 g/kg** bodyweight (range 1.6–2.2). **Fat**: 25 % of kcal (min 0.8 g/kg). **Carbs**: the rest.
- Shown as a suggestion with the formula in one line; the user can override every number. Recalculated only on request ("Recalculate"), never silently.

## Data model (draft)
SI and per-100 g storage, formatted at display time. All synced via `SYNCED_TABLE_SCHEMAS` (no server migration needed, ADR 0005).
- `foods`: id, name, brand?, barcode?, source (`own` | `off`), offId?, unit (`g` | `ml`), kcal/protein/carbs/fat per 100, portionG?, deletedAt…
- `recipes`: id, name, portions?, cookedWeightG? · `recipe_items`: recipeId, foodId, grams, position
- `food_entries`: id, eatenAt (UTC ISO), foodId | recipeId, grams (or portions for recipes), **snapshot of the values** (so editing a food later doesn't change past days — to be decided)
- `body_weights`: id, measuredAt, kg
- `user_settings`: + nutrition targets (kcal, protein, carbs, fat), body data (sex, birthYear, heightCm, activity), `homeShowNutrition`

## Technical notes
- **Open Food Facts**: public API (`/api/v2/product/{barcode}`, search), ODbL licence → attribution in About. Requests need a custom User-Agent and have rate limits (product ~100/min, search ~10/min) → debounce search, cache. Probably proxied via our API (`/api/food/...`) for the User-Agent, caching and to keep the client simple.
- **Barcode on iPhone**: Safari has no `BarcodeDetector` → a JS/WASM scanner (e.g. ZXing-based) with `getUserMedia`; works in the home-screen PWA (camera permission prompt). Needs a spike on Flo's iPhone first.
- Offline: own foods, recipes, recent foods and logging work offline; OFF search/scan needs network (clear message).

## Decided in round 2 (Florian, 2026-10-04)
1. **Bottom bar stays 4 slots**: Home · Workout · **Nutrition** · More. **Profile moves** behind the username on Home (tap the name) and into the More sheet (desktop sidebar keeps listing it). ui-guidelines "Navigation" must be updated when built.
2. **Snapshot**: a food entry stores the values as logged; editing a food later does not change past days.
3. **Weight-gain target is user-set** (kg/week, default suggestion +0.25 kg/week) with a calm hint when the 7-day-average trend is clearly off for 2+ weeks ("gaining slower/faster than your target"). Never red, no nagging.
4. **Only kcal + protein, carbs, fat** (no fibre/sugar/salt).
5. **No water tracking.**

## Settled while building
- Units: grams/ml + the product's own **portion** as a quick chip ("1 portion (60 g)"), plus "last amount" and "100 g".
- Scanner: `barcode-detector` ponyfill (ZXing WebAssembly), self-hosted, see ADR 0010.
- Profile: More sheet + tap on the username on Home.

## Build order (proposal)
1. Spike: barcode scanner + OFF lookup on Flo's iPhone (risk first).
2. Data model + own foods + logging by search + Today screen + targets (manual).
3. Open Food Facts search + barcode.
4. Body data + target suggestion + bodyweight with trend.
5. Recipes. 6. Home card, statistics.
