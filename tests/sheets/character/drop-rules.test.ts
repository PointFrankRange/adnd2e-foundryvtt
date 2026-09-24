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

describe("validateItemDrop — trait drops (SP8 Plan 8c)", () => {
  const trait = { dropType: "trait", hasRace: false, existingChassisIds: [] as string[] };

  it("rejects every trait drop while the rule is off (availableCp null or absent)", () => {
    expect(validateItemDrop({ ...trait, dropTraitCost: 4, dropTraitId: "hardy", availableCp: null })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.traitsDisabled" });
    expect(validateItemDrop({ ...trait, dropTraitCost: 4, dropTraitId: "hardy" })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.traitsDisabled" });
  });

  it("rejects a duplicate trait id", () => {
    expect(validateItemDrop({ ...trait, dropTraitCost: 6, dropTraitId: "hardy", ownedTraitIds: ["hardy"], availableCp: 50, refundedSoFar: 0 })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.duplicateTrait" });
  });

  it("rejects an advantage costing more than the available CP, allows one that fits", () => {
    expect(validateItemDrop({ ...trait, dropTraitCost: 8, dropTraitId: "brawler", ownedTraitIds: [], availableCp: 7, refundedSoFar: 0 })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.insufficientCp" });
    expect(validateItemDrop({ ...trait, dropTraitCost: 8, dropTraitId: "brawler", ownedTraitIds: [], availableCp: 8, refundedSoFar: 0 })).toEqual({ ok: true });
  });

  it("always allows a disadvantage, even overspent or past the refund cap", () => {
    expect(validateItemDrop({ ...trait, dropTraitCost: -4, dropTraitId: "frail", ownedTraitIds: [], availableCp: -9, refundedSoFar: 10 })).toEqual({ ok: true });
  });

  it("defaults a missing cost to 0, id to blank, owned ids to none and refund to 0", () => {
    expect(validateItemDrop({ ...trait, availableCp: 0 })).toEqual({ ok: true });
  });
});
