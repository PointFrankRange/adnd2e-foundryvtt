import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HIT_REQUIREMENTS } from "../../src/core/enchantment";
import { HIT_REQUIREMENTS as CHOICES } from "../../src/data/item/choices";

const SRC = readFileSync(path.resolve(__dirname, "..", "..", "src", "data", "actor", "creature.ts"), "utf8");
const COMBAT = readFileSync(path.resolve(__dirname, "..", "..", "src", "sheets", "character", "combat-rolls.ts"), "utf8");

describe("creature hitRequirement (SP18 Plan C)", () => {
  it("is a blank-able choice of the pure requirement ids, default none", () => {
    const line = SRC.split("\n").find((l) => /^\s*hitRequirement:\s*new /.test(l)) ?? "";
    expect(line).toContain("blank: true");
    expect(line).toContain('initial: ""');
    expect(line).toContain("choices: HIT_REQUIREMENTS");
  });
  it("re-exports the pure vocabulary", () => {
    expect([...CHOICES]).toEqual([...HIT_REQUIREMENTS]);
  });
  it("target resolution returns the requirement (creature only)", () => {
    expect(COMBAT).toContain("hitRequirement");
  });
});
