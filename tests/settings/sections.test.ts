import { describe, expect, it } from "vitest";
import enJson from "../../lang/en.json";
import { SETTING_DESCRIPTORS } from "../../src/settings/registry";
import { SETTING_SECTIONS, sectionOf } from "../../src/settings/sections";

const CHOICE_SETTINGS = ["exceedLevelLimits", "playerAppliedEffects"];

describe("SETTING_SECTIONS", () => {
  it("places every registered setting in exactly one section", () => {
    const placed = SETTING_SECTIONS.flatMap((s) => s.keys);
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual([...SETTING_DESCRIPTORS.map((d) => d.key), ...CHOICE_SETTINGS].sort());
  });

  it("marks only Core Rules as core", () => {
    expect(SETTING_SECTIONS.filter((s) => s.kind === "core").map((s) => s.id)).toEqual(["coreRules"]);
  });

  it("has a localized title and badge for every section", () => {
    const sections = (enJson as unknown as { ADND2E: { settings: { sections: Record<string, unknown> } } }).ADND2E.settings.sections;
    const kinds = sections.kind as Record<string, string>;
    for (const s of SETTING_SECTIONS) {
      expect(typeof sections[s.id]).toBe("string");
      expect(typeof kinds[s.kind]).toBe("string");
    }
  });

  it("sectionOf finds a key's section", () => {
    expect(sectionOf("criticalHits")?.id).toBe("combatAndTactics");
    expect(sectionOf("nope")).toBeUndefined();
  });
});
