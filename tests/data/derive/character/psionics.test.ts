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
    expect(d?.max).toBe(73); // the fighter's level 9 never enters the PSP formula
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
    // 16,500 XP is level 5 (Table 2); Wis 17 / Con 16 / Int 12 -> 25 + 4 x 12 = 73
    const d = deriveCharacter(snap("psionicist", 16500), DEFAULT_OPTIONAL_RULES);
    expect(d.classes[0].level).toBe(5);
    expect(d.psionics?.level).toBe(5);
    expect(d.psionics?.max).toBe(73);
    expect(deriveCharacter(snap("psionicist", 0), DEFAULT_OPTIONAL_RULES).psionics?.max).toBe(25);
  });

  it("derives psionics in the multiclass path too", () => {
    const s = snap("psionicist", 0);
    const m: ActorSnapshot = { ...s, classes: [...s.classes, { ...s.classes[0], chassisId: "fighter" }] };
    const m2: ActorSnapshot = { ...m, classes: [{ ...m.classes[0], xp: 16500 }, { ...m.classes[1], xp: 99_000_000 }] };
    expect(deriveCharacter(m2, DEFAULT_OPTIONAL_RULES).psionics?.max).toBe(73);
  });
});
