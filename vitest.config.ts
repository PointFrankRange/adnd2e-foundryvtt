import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // core/ is framework-free; no setup file, no Foundry globals.
    coverage: {
      provider: "v8",
      include: [
        "src/core/**/*.ts", "src/config.ts", "src/conditions.ts", "src/settings/registry.ts",
        "src/data/item/subtypes.ts", "src/data/item/choices.ts", "src/data/actor/subtypes.ts",
        "src/data/active-effect/subtypes.ts", "src/data/migrations.ts", "src/data/import/**/*.ts",
        "src/data/derive/**/*.ts",
        "src/sheets/character/context-types.ts", "src/sheets/character/xp.ts",
        "src/sheets/character/drop-rules.ts", "src/sheets/character/grouping.ts",
        "src/sheets/character/context.ts",
        "src/sheets/creature/context-types.ts", "src/sheets/creature/context.ts",
        "src/combat/**/*.ts",
        "src/magic/**/*.ts",
      ],
      // Only true barrels/type-only modules are excluded. src/core/abilities/index.ts
      // is NOT a barrel — it holds deriveAbilities()/primeRequisiteXpBonus() — so it stays included.
      // src/combat/initiative-modifier-dialog.ts is Foundry-shell glue (DialogV2
      // dialog + Combat Tracker context-menu wiring) — this project's established
      // convention excludes that category from the coverage gate rather than
      // testing it (see src/combat/initiative-modifier-dialog.ts itself / SP7a
      // task 5 report for why it has no unit tests).
      exclude: ["src/core/index.ts", "src/core/types.ts", "src/combat/initiative-modifier-dialog.ts"],
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 90 },
    },
  },
});
