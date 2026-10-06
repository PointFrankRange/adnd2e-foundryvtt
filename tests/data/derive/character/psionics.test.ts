import { describe, expect, it } from "vitest";
import { derivePsionics } from "../../../../src/data/derive/character/psionics";
import { deriveCharacter } from "../../../../src/data/derive/character/derive";
import type { ActorSnapshot } from "../../../../src/data/derive/character/snapshot";
import { DEFAULT_OPTIONAL_RULES } from "../../../../src/core/options";
import { powerProgression } from "../../../../src/core/psionics";

const scores = { wis: 17, int: 12, con: 16 };

describe("derivePsionics", () => {
  it("is null without a psionicist", () => {
    expect(derivePsionics({ classes: [{ chassisId: "fighter", level: 5 }], scores })).toBeNull();
    expect(derivePsionics({ classes: [], scores })).toBeNull();
  });

  it("derives max PSP, level and the progression row for a level-5 psionicist", () => {
    const d = derivePsionics({ classes: [{ chassisId: "psionicist", level: 5 }], scores });
    expect(d?.max).toBe(73);
    expect(d?.level).toBe(5);
    expect(d?.row).toEqual(powerProgression(5));
  });

  it("uses only the psionicist level in a multiclass", () => {
    const d = derivePsionics({
      classes: [{ chassisId: "fighter", level: 9 }, { chassisId: "psionicist", level: 5 }],
      scores,
    });
    expect(d?.level).toBe(5);
  });
});

describe("deriveCharacter psionics", () => {
  const snap = (chassisId: "psionicist" | "fighter", xp: number): ActorSnapshot => ({
    abilities: { str: 12, dex: 12, con: 16, int: 12, wis: 17, cha: 12 },
    exceptionalStrengthPercentile: null,
    race: "human",
    classes: [{ chassisId, specialistSchool: null, xp, hpRolls: [], dualClassState: null, level: 1 }],
    equippedArmor: null,
    equippedShield: null,
    carriedWeight: 0,
    wizardMemorized: [],
    priestMemorized: [],
    spentWeaponSlots: 0,
    spentNonweaponSlots: 0,
    baseMovement: 12,
    thiefSkillAllocations: [],
    traits: [],
    isCasting: false,
  });

  it("is null for a non-psionicist", () => {
    expect(deriveCharacter(snap("fighter", 0), DEFAULT_OPTIONAL_RULES).psionics).toBeNull();
  });

  it("gives a psionicist a max PSP from the prepared scores", () => {
    const d = deriveCharacter(snap("psionicist", 0), DEFAULT_OPTIONAL_RULES);
    expect(d.psionics?.level).toBe(d.classes[0].level);
    expect(d.psionics?.max).toBeGreaterThan(0);
  });

  it("derives psionics in the multiclass path too", () => {
    const s = snap("psionicist", 0);
    const m: ActorSnapshot = { ...s, classes: [...s.classes, { ...s.classes[0], chassisId: "fighter" }] };
    expect(deriveCharacter(m, DEFAULT_OPTIONAL_RULES).psionics).not.toBeNull();
  });
});
