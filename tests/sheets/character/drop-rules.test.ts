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
    for (const t of ["weapon", "armor", "equipment", "spell", "classFeature"]) {
      expect(validateItemDrop({ dropType: t, hasRace: true, existingChassisIds: ["fighter"] }))
        .toEqual({ ok: true });
    }
  });

  it("allows a weaponProficiency/nonweaponProficiency drop with no cost/available info supplied (default cost 1, default available 0 — rejected)", () => {
    for (const t of ["weaponProficiency", "nonweaponProficiency"] as const) {
      const r = validateItemDrop({ dropType: t, hasRace: true, existingChassisIds: ["fighter"] });
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("ADND2E.sheet.drop.insufficientSlots");
    }
  });

  it("allows a weaponProficiency drop when available slots cover its cost", () => {
    expect(validateItemDrop({
      dropType: "weaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 1, availableSlots: 2,
    })).toEqual({ ok: true });
  });

  it("rejects a weaponProficiency drop when available slots don't cover its cost", () => {
    const r = validateItemDrop({
      dropType: "weaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 1, availableSlots: 0,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ADND2E.sheet.drop.insufficientSlots");
  });

  it("allows a nonweaponProficiency drop when available slots exactly cover its cost", () => {
    expect(validateItemDrop({
      dropType: "nonweaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 2, availableSlots: 2,
    })).toEqual({ ok: true });
  });

  it("rejects a nonweaponProficiency drop when available slots fall short by one", () => {
    const r = validateItemDrop({
      dropType: "nonweaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 3, availableSlots: 2,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ADND2E.sheet.drop.insufficientSlots");
  });
});
