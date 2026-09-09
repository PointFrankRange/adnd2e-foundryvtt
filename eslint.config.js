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
    ignores: ["src/core/**", "tests/core/**", "src/config.ts", "src/settings/registry.ts", "tests/config/**", "tests/settings/**", "tests/lang/**", "src/data/derive/**", "src/data/item/subtypes.ts", "src/data/item/choices.ts", "src/data/actor/subtypes.ts", "src/data/active-effect/subtypes.ts", "tests/data/**"],
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
    files: ["src/core/**/*.ts", "tests/core/**/*.ts", "src/config.ts", "src/settings/registry.ts", "tests/config/**/*.ts", "tests/settings/**/*.ts", "tests/lang/**/*.ts", "src/data/derive/**/*.ts", "src/data/item/subtypes.ts", "src/data/item/choices.ts", "src/data/actor/subtypes.ts", "src/data/active-effect/subtypes.ts", "tests/data/**/*.ts"],
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
