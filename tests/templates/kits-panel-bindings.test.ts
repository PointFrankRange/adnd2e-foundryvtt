import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..", "..");
const FEATURES = readFileSync(path.join(root, "templates", "actor", "pc", "partials", "pc-feature-panels.hbs"), "utf8");
const LANG = JSON.parse(readFileSync(path.join(root, "lang", "en.json"), "utf8"));
const panel = FEATURES.slice(FEATURES.indexOf("kits-panel"), FEATURES.indexOf("martialArts.manageTitle"));

describe("Features tab kits panel (#133)", () => {
  it("groups the day and encounter buttons in the panel bar, before the kit cards", () => {
    const bar = panel.slice(0, panel.indexOf("kit-card"));
    expect(bar).toContain('data-action="newDayKitPowers"');
    expect(bar).toContain('data-action="newEncounterKitPowers"');
    expect(panel.slice(panel.indexOf("kit-card")).match(/newDayKitPowers/g)).toBeNull();
  });
  it("renders each kit as a card with a header of chips and a powers table with inline row buttons", () => {
    expect(panel).toContain("kit-card-head");
    expect(panel).toContain('class="chip');
    expect(panel).toContain("power-head");
    const row = panel.slice(panel.indexOf('class="power-row"'));
    expect(row).toContain('data-action="useKitPower"');
    expect(row).toContain('data-action="resetKitPower"');
  });
  it("has the table column labels", () => {
    expect(LANG.ADND2E.sheet.kits.usesColumn).toBe("Uses");
    expect(LANG.ADND2E.sheet.kits.scopeColumn).toBe("Scope");
  });
});
