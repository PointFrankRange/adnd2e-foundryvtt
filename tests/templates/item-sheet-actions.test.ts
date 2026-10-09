import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const PARTIAL = readFileSync(path.join(ROOT, "templates", "sheets", "raw-effects.hbs"), "utf8");
const SHEET = readFileSync(path.join(ROOT, "src", "sheets", "item-sheet.ts"), "utf8");
const RAW = readFileSync(path.join(ROOT, "src", "sheets", "raw-field-sheet.ts"), "utf8");

describe("item sheet Effects wiring (#146)", () => {
  const used = [...new Set([...PARTIAL.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!))];
  it("the item sheet registers every action the Effects partial uses", () => {
    for (const action of used) expect(SHEET, action).toMatch(new RegExp(`^\\s+${action}: Adnd2eItemSheet\\.#on`, "m"));
  });
  it("only weapon, armor and equipment get the Effects section", () => {
    expect(RAW).toMatch(/itemEffects/);
    expect(RAW).toMatch(/\["weapon", "armor", "equipment"\]/);
  });
});
