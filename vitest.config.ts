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
        "src/data/active-effect/subtypes.ts",
        "src/data/derive/**/*.ts",
      ],
      // Only true barrels/type-only modules are excluded. src/core/abilities/index.ts
      // is NOT a barrel — it holds deriveAbilities()/primeRequisiteXpBonus() — so it stays included.
      exclude: ["src/core/index.ts", "src/core/types.ts"],
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 90 },
    },
  },
});
