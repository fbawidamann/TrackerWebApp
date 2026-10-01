# ADR 0007: German language — own typed dictionaries, hand-translated exercise catalog

- Status: **Accepted**
- Date: 2026-10-01
- Setting: [profile.md](../design/screens/profile.md) (Language and formats). Formats: [ui-guidelines.md](../design/ui-guidelines.md#number-and-text-formats).

## Context
The app was English only. The user wants to switch it to German in the settings, and the exercises (names **and** instructions) must be well translated, not machine-like. More languages are not planned, but should not need a rewrite.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Library | **No i18n library.** `apps/web/src/i18n/en.ts` is the source dictionary (plain object, functions for plurals and values); `de.ts` is typed `const de: Dict = …` with `type Dict = typeof en` | TypeScript fails the build when a German key is missing or a function has the wrong arguments. Two languages don't need ICU, loaders or extraction tools |
| Access | `useT()` in components (re-renders on change), `tr()` / `currentLanguage()` in plain code (actions, sync errors) | Default names, toasts and server error messages are created outside React |
| Setting | `language: "en" \| "de"` in the synced user settings (default `en`) | Follows the account to every device |
| First language | A new device starts with the language last used on it (`localStorage`), else the browser's (`de*` → German) | The login screen is shown before any settings exist, and a logout wipes the settings |
| Formats | `packages/shared/src/format.ts` takes the language: German weekday/month names and abbreviations, `Heute`/`Gestern`, `29. September`, default names (`Morgentraining`, `Abendlauf`) | All formatting already lives there (CLAUDE.md: never format inline). Decimal separator and date format stay separate settings |
| Exercise catalog | **Hand-written translation** in `packages/shared/data/exercises.de.json`, keyed by the free-exercise-db slug: `{ name, instructions[] }` for all 876 exercises | Quality: names are the terms used in German gyms, instructions use "du" and metric units |
| Storing it | Built-in exercises are never synced ([ADR 0003](0003-exercise-catalog.md)), so the seed **writes them in the chosen language** into Dexie. Switching the language re-seeds (queued, one at a time). The seed key is `catalogVersion:lang:translationVersion` | Every screen (picker, history, detail, charts) shows German names without any per-screen code. IDs don't change, so history and PRs are unaffected |
| Loading | The German file (~640 kB) is a lazy chunk, only loaded when German is chosen | English users don't download it |
| Search | Exercise search matches the shown name, the slug (= English name) and the equipment in both languages; umlauts are folded (`ü` = `u`, `ß` = `ss`) | People often know the English name ("Bench Press"), and phone keyboards make umlauts slow |
| Custom exercises | Not translated (the user's own text) | |
| Server | Error messages stay English on the wire; the client maps known messages to German (`serverErrors`) | The API stays language-free |

## Glossary (German UI and catalog)

| English | German | English | German |
|---|---|---|---|
| Workout | Training | Set / Reps | Satz / Wdh. |
| Exercise | Übung | Routine | Routine |
| Rest | Pause | PR | PR |
| Run / Pace | Lauf / Pace | Warm-up | Aufwärmsatz |
| Barbell / Dumbbell | Langhantel / Kurzhantel | EZ bar | SZ-Stange |
| Cable / Machine | Kabelzug / Maschine | Smith machine | Multipresse |
| Bench press | Bankdrücken | Incline / Decline | Schrägbank- / Negativ- |
| Deadlift / Squat | Kreuzheben / Kniebeuge | Lunge | Ausfallschritt |
| Row / Lat pulldown | Rudern / Latziehen | Pull-up / Push-up | Klimmzug / Liegestütz |
| Fly | Fliegende | Preacher curl | Scottcurl |
| Skullcrusher / lying triceps ext. | Stirndrücken / French Press | Lateral / front raise | Seitheben / Frontheben |
| Clean / Snatch / Jerk (barbell) | Umsetzen / Reißen / Ausstoßen | Clean & Jerk | Stoßen |
| Hack squat machine | Hackenschmidt | SMR (foam roller) | Faszienrolle |

Terms that German gyms use in English stay English: Shrugs, Face Pull, Hip Thrust, Good Morning, Goblet Squat, Plank, Crunch, Butterfly, kettlebell Clean/Swing.

Instruction style: informal "du", imperative, short sentences; inches, feet, pounds and mph are converted to cm, m, kg and km/h; obvious mistakes of the source (swapped breathing, chapter references, stray characters) are fixed instead of translated. Two exercises only share a German name and equipment if they also share the English name.

## Maintaining the translation
- `npm run catalog:import` lists new slugs without a German entry; `packages/shared/src/catalog.test.ts` fails until every slug has one (same step count, name ≤ 60 characters, metric units).
- After editing `exercises.de.json`, run `npm run catalog:version`. It stores the translation's hash in `catalog-version.json` so devices re-seed. The test fails if this was forgotten.

## Alternatives considered
- **i18next / FormatJS**: proven, but adds runtime, string keys without type checks and ICU syntax for two languages.
- **Machine translation of the catalog at runtime**: needs a network service and gives uneven terms ("Langhantel-Bankpresse").
- **Translating only exercise names**: the instructions are what a user reads mid-workout; an English text there breaks the German app.
- **Storing both languages in each exercise row**: bigger rows and every screen would have to choose.

## Consequences
- Every new UI string needs an entry in `en.ts` and `de.ts` (the type check enforces it).
- A third language = a new dictionary file, a value in `LANGUAGES`, names in `format.ts` and a catalog file.
