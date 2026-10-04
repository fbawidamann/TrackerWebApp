# ADR 0010: Nutrition (food tracking v1)

Status: **accepted** (2026-10-04, planned with Florian). Screen spec: [nutrition.md](../design/screens/nutrition.md).

## Context
Goal: muscle gain. Protein and calories matter most, carbs and fat are secondary. Barcode scanning is "very important".
The app is an offline-first PWA, mostly used on an iPhone from the home screen.

## Decisions
- **Own domain, synced like everything else**: `foods`, `foodEntries`, `bodyWeights` are new entries in
  `SYNCED_TABLE_SCHEMAS`. The server stores them in the generic `records` table (ADR 0005) → **no DB migration**.
  Dexie schema version 3 adds the local tables. Backups include them (older backups still import: arrays default to `[]`).
- **Values per 100 g / 100 ml** on foods; a **food entry stores a snapshot** (name, amount, kcal, protein, carbs, fat for the
  eaten amount). Editing a food later never changes past days.
- **Protein colour** (Florian): red < 50 %, yellow < 80 %, green < 100 %, dark green ≥ 100 % of the target; grey = nothing logged.
  Fixed colours (not the accent colour), so they always mean the same. The kcal bar never turns red (a surplus is the goal).
- **Targets**: protein = own grams, else bodyweight (7-day average) × g/kg (chips 1.5 / 1.6 / 1.8 / 2.0 / 2.2, default 1.8).
  kcal = own value, else Mifflin-St Jeor × activity factor + surplus (default +250). Fat 25 % of kcal (≥ 0.8 g/kg), carbs the rest.
- **Open Food Facts via our API** (`/api/food/product/:barcode`, `/api/food/search`): OFF wants an identifying User-Agent
  (browsers can't set one) and rate-limits (product ~100/min, search ~10/min). The proxy sends our UA, caches 24 h
  (max 2000 answers in memory), allows 30 uncached OFF calls per user per minute, and converts products to a small shape.
  A product is copied into the user's `foods` the first time it is used (offline later, correctable).
  Data licence ODbL → attribution shown under the search results.
- **Barcode on iPhone**: Safari has no `BarcodeDetector`, so we use the `barcode-detector` ponyfill (ZXing-C++ as
  WebAssembly, ~1.1 MB, 464 kB gzip). The wasm is **bundled and served by us** (no CDN) and precached by the service worker;
  the scanner code is lazy-loaded when the camera opens. Only EAN-13/EAN-8/UPC-A/UPC-E, ~6 decodes/s, a code counts after two
  equal reads with a valid check digit. The camera stops when the scanner closes or the app goes to the background.
  Typing the number is always possible (no camera, permission denied).
- **Navigation**: the bottom bar stays four slots: Home · Workout · Nutrition · More. Profile is in More and behind the
  username on Home.

## Deployment requirement
The Traefik middleware `secure-headers@file` (`/docker/traefik-r4mf/dynamic/security-headers.yml`) sends
`Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()`. `camera=()` **blocks the camera for every page**,
so the scanner would always fail with "no camera access". **Done 2026-10-04 (Florian's OK):** a second middleware
`secure-headers-fitness@file` (`/docker/traefik-r4mf/dynamic/security-headers-fitness.yml`) is identical except
`camera=(self)`; only the `fitness` router uses it (label in `docker-compose.yml`). The other sites keep `camera=()`.

## Not in v1
Recipes, meal templates, statistics (planned next). No fibre/sugar/salt, no water (decided).
