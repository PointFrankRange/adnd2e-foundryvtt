# Advanced Dungeons & Dragons 2nd Edition — Foundry VTT System

A Foundry VTT **game system** (id `adnd2e`) implementing the AD&D 2nd Edition
rules with heavy automation. Built with TypeScript + Vite, targeting Foundry
v13 (verified v14).

## Install into Foundry

In **Configuration and Setup → Game Systems → Install System**, paste this
Manifest URL:

```
https://github.com/PointFrankRange/adnd2e-foundryvtt/releases/download/latest/system.json
```

This tracks the rolling `latest` build (published on every push to `master`).
After a new push, use **Update** in the Game Systems list to pull the newest build.

**Content policy:** this repository contains game *mechanics* only — no rulebook
text, spell descriptions, monster stat blocks, or magic-item text. A JSON import
path (added in a later plan) lets you load content you own into your world.

## Architecture

- `src/core/` — framework-free rules engine (pure functions + lookup tables),
  unit-tested with Vitest. Imports nothing from Foundry.
- `src/config.ts`, `src/settings/registry.ts` — also framework-free: they build
  `CONFIG.ADND2E` and the optional-rules registry. `src/settings/index.ts` is
  the thin Foundry glue that registers the settings and reads them back.
- `src/data/` — Foundry DataModels; thin adapters that delegate computation to `core/`.
- `src/documents/`, `src/sheets/` — Foundry Document and Application subclasses.

Implementation proceeds in sub-projects; see `docs/superpowers/specs/` and
`docs/superpowers/plans/`.

## Setup

```sh
npm install
```

## Scripts

```sh
npm run build        # production build -> dist/
npm run watch        # rebuild on change
npm run test         # Vitest (rules engine)
npm run test:watch
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src
npm run format       # prettier --write src
npm run link         # junction dist/ into <dataPath>/Data/systems/adnd2e
```

## Developing against a local Foundry install

1. Copy `foundryconfig.example.json` to `foundryconfig.json`, set `dataPath` to
   your Foundry user-data directory (the folder containing `Data/`, `Config/`,
   `Logs/`). Gitignored.
2. `npm run build`
3. `npm run link`
4. `npm run watch` while developing; reload the world (F5) after each rebuild.
5. Create or edit a world that uses the "Advanced Dungeons & Dragons 2nd Edition" system.
