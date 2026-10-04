# Documentation

Everything we decide about the fitness tracker is written down here. Planning happens in conversation, and every agreed decision ends up in one of these files.

| Doc | What it answers |
|---|---|
| [requirements.md](requirements.md) | What the app must do, and gym-specific decisions |
| [roadmap.md](roadmap.md) | Milestones and their order, as checklists |
| [architecture/data-model.md](architecture/data-model.md) | Tables, fields, relations, IDs, derived metrics |
| [architecture/sync.md](architecture/sync.md) | How offline-first storage and server sync work |
| [architecture/pwa-updates.md](architecture/pwa-updates.md) | How new versions reach the installed iPhone app (update banner) |
| [design/ui-guidelines.md](design/ui-guidelines.md) | Visual design: colours, type, formats, spacing, components |
| [design/screens/](design/screens/) | One spec per screen: layout, interactions, states, edge cases |
| [design/prototypes/](design/prototypes/README.md) | Clickable HTML prototypes used to decide the design (open in a browser) |
| [adr/](adr/) | Architecture Decision Records: *why* we chose something |

## Architecture Decision Records (ADRs)

An ADR records one important decision: the context, the choice, the alternatives and the consequences. ADRs are never deleted. If a decision changes, write a new ADR and set the old one's status to *Superseded by ADR-XXXX*.

| ADR | Decision | Status |
|---|---|---|
| [0001](adr/0001-tech-stack.md) | Tech stack | Accepted |
| [0002](adr/0002-offline-sync.md) | Offline-first sync approach | Accepted |
| [0003](adr/0003-exercise-catalog.md) | Exercise catalog source | Accepted |
| [0004](adr/0004-deployment.md) | Deployment: existing Traefik, 2 containers (app + db) | Accepted |
| [0005](adr/0005-backend-auth-and-sync.md) | Backend auth (username + password, admin-created) and sync store (generic `records` table) | Accepted |
| [0006](adr/0006-running.md) | Running: GPX/FIT import, totals + downsampled track, no map tiles | Accepted |
| [0007](adr/0007-german-language.md) | German language: own typed dictionaries, translated exercise catalog | Accepted |
| [0008](adr/0008-self-hosted-font.md) | Self-hosted font (IBM Plex Sans via @fontsource) instead of Google Fonts | Accepted |
| [0009](adr/0009-strava.md) | Strava connection: OAuth on the server, encrypted tokens, runs imported via importRun | Accepted |
