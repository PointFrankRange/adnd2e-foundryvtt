import { describe, expect, it } from "vitest";

describe("test pipeline", () => {
  it("runs pure TypeScript with no Foundry globals", () => {
    expect(typeof (globalThis as Record<string, unknown>).game).toBe("undefined");
    expect(2 + 2).toBe(4);
  });
});
