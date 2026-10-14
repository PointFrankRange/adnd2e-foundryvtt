import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..", "..");
const MAIN = readFileSync(path.join(root, "templates", "actor", "pc", "partials", "pc-main-panels.hbs"), "utf8");
const LANG = JSON.parse(readFileSync(path.join(root, "lang", "en.json"), "utf8"));

describe("Main tab armor panel (#165)", () => {
  it("loops the equipped-only list and uses the equipped empty state", () => {
    expect(MAIN).toContain("adnd2e.combat.armor");
    expect(MAIN).toContain("ADND2E.sheet.combat.noArmorEquipped");
    const panel = MAIN.slice(MAIN.indexOf("adnd2e.combat.armor"), MAIN.indexOf("adnd2e.combat.acBreakdown"));
    expect(panel).not.toContain("notEquipped");
  });
  it("defines the empty-state key", () => {
    expect(LANG.ADND2E.sheet.combat.noArmorEquipped).toBe("No armor equipped.");
  });
});
