import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // core/ is framework-free; no setup file, no Foundry globals.
  },
});
