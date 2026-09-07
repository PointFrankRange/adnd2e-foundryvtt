# my-module

A skeleton Foundry VTT module built with TypeScript and Vite, targeting the modern
`ApplicationV2`/`HandlebarsApplicationMixin` UI API (Foundry v13+).

## Rename it

Before you start, replace `my-module` everywhere it appears (this is the module `id`):

- [module.json](module.json) — `id`, `title`, `description`, `authors`
- [package.json](package.json) — `name`
- [src/helpers/constants.ts](src/helpers/constants.ts) — `MODULE_ID`
- [src/types/global.d.ts](src/types/global.d.ts) — `SettingConfig` key prefix
- [lang/en.json](lang/en.json) — top-level localization key (currently `MY-MODULE`)
- CSS class names in [styles/module.scss](styles/module.scss) and [templates/example-app.hbs](templates/example-app.hbs)

## Project layout

```
src/               TypeScript source (bundled by Vite into dist/module.js)
  module.ts        Entry point — registers hooks
  helpers/         Settings registration, shared constants
  apps/            ApplicationV2 windows
  types/           Global type augmentation (e.g. SettingConfig)
templates/         Handlebars templates, copied as-is into dist/
lang/              Localization files, copied as-is into dist/
styles/            Sass, compiled and bundled to dist/module.css
module.json        Foundry module manifest, copied as-is into dist/
```

`dist/` is the folder Foundry actually loads — it's what you build and what you'd
zip up for a release.

## Setup

```sh
npm install
```

## Build

```sh
npm run build      # one-off production build -> dist/
npm run watch       # rebuild on file change
```

## Type-checking & linting

```sh
npm run typecheck   # tsc --noEmit
npm run lint         # eslint src
npm run format        # prettier --write src
```

## Developing against a local Foundry install

1. Copy `foundryconfig.example.json` to `foundryconfig.json` and set `dataPath` to your
   Foundry user data directory (the folder containing `Data/`, `Config/`, `Logs/`).
   This file is gitignored — it's local machine config, not part of the module.
2. Build once: `npm run build`
3. Link the build output into Foundry's modules folder:

   ```sh
   npm run link
   ```

   This creates a directory junction from `dist/` to
   `<dataPath>/Data/modules/my-module`, so Foundry sees the module without copying files.
4. Run `npm run watch` while developing, then reload the world in Foundry (F5) to pick
   up changes — Vite doesn't hot-reload into a running Foundry instance, so a manual
   browser refresh is required after each rebuild.
5. Enable the module from the world's **Manage Modules** dialog.

## Notes on tooling choices

- **[fvtt-types](https://github.com/League-of-Foundry-Developers/foundry-vtt-types)**
  (installed as the `fvtt-types` alias for `@league-of-foundry-developers/foundry-vtt-types`)
  gives full autocomplete/type-checking against Foundry's classes (`Actor`, `Item`,
  `ApplicationV2`, `Hooks`, `game`, etc). It's community-maintained and currently tracks
  Foundry v13; it works for v14 (the version foundryvtt.com/api currently documents) with
  only minor gaps since the two versions are close. Check the package's GitHub for updates
  as v14 support solidifies.
  Its README asks that AI tools not be used on its own `src/` — only its public README/docs
  were used to write this skeleton, and you should avoid pointing an AI assistant at that
  package's source for the same reason (it embeds Foundry's own documentation, which is
  under Foundry's EULA).
- **Vite** bundles `src/module.ts` (and its Sass import) into `dist/module.js` +
  `dist/module.css`, and copies `module.json`, `lang/`, and `templates/` alongside it via
  `vite-plugin-static-copy`. No separate template/i18n build step is needed.
- **ESLint (flat config) + typescript-eslint** and **Prettier** are wired up but intentionally
  minimal — extend `eslint.config.js` with more rules as the module grows.

## Recommended editor setup

- VS Code with the built-in TypeScript support (no extra extension needed once `fvtt-types`
  is installed — it's picked up automatically via `tsconfig.json`).
- A Handlebars syntax extension (e.g. "Handlebars" by `hcnn` or similar) for `.hbs` files.
- ESLint and Prettier VS Code extensions, so lint errors and formatting show up inline.

## Optional next steps

- **[Quench](https://github.com/Ethaks/FVTT-Quench)** — an in-Foundry test runner module,
  useful if you want integration tests that exercise real Foundry APIs rather than mocks.
- **[@foundryvtt/foundryvtt-cli](https://github.com/foundryvtt/foundryvtt-cli)** — official
  CLI for packing/unpacking LevelDB compendium packs, if your module ships compendium content.
- A GitHub Actions workflow that runs `npm run build`, zips `dist/`, and attaches it plus
  `module.json` to a GitHub Release — the standard distribution method for Foundry modules.
