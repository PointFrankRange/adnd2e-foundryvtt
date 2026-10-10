import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PARTIAL = readFileSync(path.resolve(__dirname, "..", "..", "templates", "sheets", "raw-effects.hbs"), "utf8");

describe("raw-effects.hbs (#146)", () => {
  it("emits exactly the five item-effect actions", () => {
    const used = [...new Set([...PARTIAL.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!))].sort();
    expect(used).toEqual(
      ["createItemEffect", "deleteItemEffect", "editItemEffect", "toggleItemEffect", "toggleItemEffectTransfer"],
    );
  });
  it("renders from the itemEffects context key", () => {
    expect(PARTIAL).toContain("itemEffects");
  });
  it("does not put core's .disabled class on a container (core sets pointer-events:none, killing its buttons)", () => {
    expect(PARTIAL).not.toMatch(/[ }"]disabled[ {"]/);
    expect(PARTIAL).toContain("effect-disabled");
  });
});
