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

  it("rejects a duplicate specific-weapon proficiency, even with slots to spare", () => {
    const r = validateItemDrop({
      dropType: "weaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 1, availableSlots: 5,
      dropWeaponOrGroup: "Long Sword", dropIsGroup: false,
      existingWeaponProfs: [{ weaponOrGroup: "Long Sword", isGroup: false }],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ADND2E.sheet.drop.duplicateWeaponProficiency");
  });

  it("rejects a duplicate GROUP weapon proficiency, but allows the same name as a different isGroup", () => {
    const dup = validateItemDrop({
      dropType: "weaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 1, availableSlots: 5,
      dropWeaponOrGroup: "Blades", dropIsGroup: true,
      existingWeaponProfs: [{ weaponOrGroup: "Blades", isGroup: true }],
    });
    expect(dup.ok).toBe(false);
    expect(dup.reason).toBe("ADND2E.sheet.drop.duplicateWeaponProficiency");

    // Same weaponOrGroup text, but the existing one is a GROUP prof and the
    // drop is a specific-weapon prof (or vice versa) — not a duplicate.
    const notDup = validateItemDrop({
      dropType: "weaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 1, availableSlots: 5,
      dropWeaponOrGroup: "Blades", dropIsGroup: false,
      existingWeaponProfs: [{ weaponOrGroup: "Blades", isGroup: true }],
    });
    expect(notDup).toEqual({ ok: true });
  });

  it("defaults a missing dropIsGroup to false (a specific-weapon drop)", () => {
    const r = validateItemDrop({
      dropType: "weaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 1, availableSlots: 5,
      dropWeaponOrGroup: "Long Sword",
      existingWeaponProfs: [{ weaponOrGroup: "Long Sword", isGroup: false }],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ADND2E.sheet.drop.duplicateWeaponProficiency");
  });

  it("allows a distinct weapon proficiency alongside an existing one", () => {
    expect(validateItemDrop({
      dropType: "weaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 1, availableSlots: 5,
      dropWeaponOrGroup: "Short Sword", dropIsGroup: false,
      existingWeaponProfs: [{ weaponOrGroup: "Long Sword", isGroup: false }],
    })).toEqual({ ok: true });
  });

  it("rejects a duplicate nonweapon proficiency by name, even with slots to spare", () => {
    const r = validateItemDrop({
      dropType: "nonweaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 1, availableSlots: 5,
      dropNonweaponName: "Swimming",
      existingNonweaponNames: ["Swimming"],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ADND2E.sheet.drop.duplicateNonweaponProficiency");
  });

  it("allows a distinct nonweapon proficiency alongside an existing one", () => {
    expect(validateItemDrop({
      dropType: "nonweaponProficiency", hasRace: true, existingChassisIds: ["fighter"],
      dropSlotCost: 1, availableSlots: 5,
      dropNonweaponName: "Herbalism",
      existingNonweaponNames: ["Swimming"],
    })).toEqual({ ok: true });
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

describe("kit drops (SP11)", () => {
  const base = { hasRace: true, existingChassisIds: ["fighter"], dropType: "kit", dropKitChassisId: "fighter" };
  it("accepts a qualifying kit for an owned class", () => {
    expect(validateItemDrop({ ...base, existingKitChassisIds: [], kitQualifies: { ok: true } })).toEqual({ ok: true });
  });
  it("rejects a kit whose class the actor does not have", () => {
    expect(validateItemDrop({ ...base, dropKitChassisId: "mage" })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.kitNoClass" });
  });
  it("rejects a second kit for the same class", () => {
    expect(validateItemDrop({ ...base, existingKitChassisIds: ["fighter"], kitQualifies: { ok: true } })).toEqual({
      ok: false, reason: "ADND2E.sheet.drop.kitDuplicate",
    });
  });
  it("rejects unmet qualifications with that reason", () => {
    expect(validateItemDrop({ ...base, existingKitChassisIds: [], kitQualifies: { ok: false, reason: "ADND2E.sheet.drop.kitAbility" } })).toEqual({
      ok: false, reason: "ADND2E.sheet.drop.kitAbility",
    });
  });
});

describe("kit-forbidden weapon proficiencies (SP11)", () => {
  it("rejects a forbidden proficiency before slot checks", () => {
    expect(
      validateItemDrop({
        dropType: "weaponProficiency", hasRace: true, existingChassisIds: ["mage"], dropWeaponOrGroup: "Long Bow",
        dropIsGroup: false, dropSlotCost: 1, availableSlots: 5, kitForbidsProficiency: true,
      }),
    ).toEqual({ ok: false, reason: "ADND2E.sheet.drop.kitForbiddenProficiency" });
  });
  it("is unaffected when no kit forbids it", () => {
    expect(
      validateItemDrop({
        dropType: "weaponProficiency", hasRace: true, existingChassisIds: ["mage"], dropWeaponOrGroup: "Dagger",
        dropIsGroup: false, dropSlotCost: 1, availableSlots: 5,
      }),
    ).toEqual({ ok: true });
  });
});

describe("kit-disabled casting drops (SP11 Plan C)", () => {
  it("refuses a spell drop when the owning kit disables that caster type's casting (SP11 Plan C)", () => {
    const base = { dropType: "spell", hasRace: false, existingChassisIds: ["paladin"] };
    expect(validateItemDrop({ ...base, kitDisablesCasting: true })).toEqual({ ok: false, reason: "ADND2E.sheet.drop.kitCastingDisabled" });
    expect(validateItemDrop({ ...base, kitDisablesCasting: false })).toEqual({ ok: true });
    expect(validateItemDrop(base)).toEqual({ ok: true });
  });
});
