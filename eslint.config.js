import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Foundry globals — available everywhere EXCEPT the framework-free engine.
    ignores: ["src/core/**", "tests/core/**", "src/config.ts", "src/conditions.ts", "src/settings/registry.ts", "tests/config/**", "tests/settings/**", "tests/lang/**", "src/data/derive/**", "src/data/item/subtypes.ts", "src/data/item/choices.ts", "src/data/actor/subtypes.ts", "src/data/active-effect/subtypes.ts", "src/data/migrations.ts", "src/data/import/envelope.ts", "tests/conditions.test.ts", "tests/data/**", "tests/packs/**", "src/sheets/character/context-types.ts", "src/sheets/character/xp.ts", "src/sheets/character/drop-rules.ts", "src/sheets/character/grouping.ts", "src/sheets/character/context.ts", "src/sheets/creature/context-types.ts", "src/sheets/creature/context.ts", "tests/sheets/**", "src/combat/**", "tests/combat/**", "src/magic/**", "tests/magic/**"],
    languageOptions: {
      globals: {
        game: "readonly",
        Hooks: "readonly",
        foundry: "readonly",
        CONFIG: "readonly",
        ui: "readonly",
        canvas: "readonly",
      },
    },
  },
  {
    // The engine must stay pure — no Foundry globals under core/.
    // initiative-modifier-dialog.ts is Foundry-shell glue (DialogV2 dialog),
    // same category as the sheets/character combat-rolls.ts files that never
    // appear in this list — it's carved out of src/combat/**'s directory-level
    // match rather than added file-by-file like those siblings (mirrors the
    // equivalent tsconfig.core.json exclude).
    files: ["src/core/**/*.ts", "tests/core/**/*.ts", "src/config.ts", "src/conditions.ts", "src/settings/registry.ts", "tests/config/**/*.ts", "tests/settings/**/*.ts", "tests/lang/**/*.ts", "src/data/derive/**/*.ts", "src/data/item/subtypes.ts", "src/data/item/choices.ts", "src/data/actor/subtypes.ts", "src/data/active-effect/subtypes.ts", "src/data/migrations.ts", "src/data/import/envelope.ts", "tests/conditions.test.ts", "tests/data/**/*.ts", "tests/packs/**/*.ts", "src/sheets/character/context-types.ts", "src/sheets/character/xp.ts", "src/sheets/character/drop-rules.ts", "src/sheets/character/grouping.ts", "src/sheets/character/context.ts", "src/sheets/creature/context-types.ts", "src/sheets/creature/context.ts", "tests/sheets/**/*.ts", "src/combat/**/*.ts", "tests/combat/**/*.ts", "src/magic/**/*.ts", "tests/magic/**/*.ts"],
    ignores: ["src/combat/initiative-modifier-dialog.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "game", message: "core/ must not touch Foundry globals" },
        { name: "Hooks", message: "core/ must not touch Foundry globals" },
        { name: "foundry", message: "core/ must not touch Foundry globals" },
        { name: "CONFIG", message: "core/ must not touch Foundry globals" },
        { name: "ui", message: "core/ must not touch Foundry globals" },
        { name: "canvas", message: "core/ must not touch Foundry globals" },
        { name: "Roll", message: "core/ must not touch Foundry globals" },
        { name: "Actor", message: "core/ must not touch Foundry globals" },
        { name: "Item", message: "core/ must not touch Foundry globals" },
        { name: "Dialog", message: "core/ must not touch Foundry globals" },
        { name: "fromUuid", message: "core/ must not touch Foundry globals" },
        { name: "Handlebars", message: "core/ must not touch Foundry globals" },
      ],
      "no-restricted-imports": ["error", { patterns: ["fvtt-types", "fvtt-types/*", "foundry", "foundry/*", "@league-of-foundry-developers/*"] }],
    },
  },
  {
    // Node-executed tooling scripts (not shipped in the system bundle).
    files: ["scripts/**/*.{js,mjs,cjs}", "*.config.{js,ts,mjs}"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
  {
    ignores: ["dist/**", "packs/**", "coverage/**"],
  },
);
