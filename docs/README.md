# Documentation

Everything we decide about the fitness tracker is written down here. Planning happens in conversation, and every agreed decision ends up in one of these files.

| Doc | What it answers |
|---|---|
| [requirements.md](requirements.md) | What the app must do, and gym-specific decisions |
| [roadmap.md](roadmap.md) | Milestones and their order, as checklists |
| [architecture/data-model.md](architecture/data-model.md) | Tables, fields, relations, IDs, derived metrics |
| [architecture/sync.md](architecture/sync.md) | How offline-first storage and server sync work |
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
