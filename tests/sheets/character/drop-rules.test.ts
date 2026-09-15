import { describe, expect, it } from "vitest";
import { validateItemDrop } from "../../../src/sheets/character/drop-rules";

describe("validateItemDrop", () => {
  it("allows a race when the actor has none", () => {
    expect(validateItemDrop({ dropType: "race", hasRace: false, existingChassisIds: [] }))
      .toEqual({ ok: true });
  });
  it("rejects a second race", () => {
    const r = validateItemDrop({ dropType: "race", hasRace: true, existingChassisIds: [] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ADND2E.sheet.drop.duplicateRace");
  });
  it("rejects a duplicate class chassis", () => {
    const r = validateItemDrop({
      dropType: "class", dropChassisId: "fighter", hasRace: true, existingChassisIds: ["fighter"],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ADND2E.sheet.drop.duplicateClass");
  });
  it("allows a distinct second class", () => {
    expect(validateItemDrop({
      dropType: "class", dropChassisId: "mage", hasRace: true, existingChassisIds: ["fighter"],
    })).toEqual({ ok: true });
  });
  it("allows any other item type unconditionally", () => {
    for (const t of ["weapon", "armor", "equipment", "spell", "weaponProficiency", "nonweaponProficiency", "classFeature"]) {
      expect(validateItemDrop({ dropType: t, hasRace: true, existingChassisIds: ["fighter"] }))
        .toEqual({ ok: true });
    }
  });
});
