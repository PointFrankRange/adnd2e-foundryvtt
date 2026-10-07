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

describe("derivePsionics wild talents", () => {
  const one = [{ initialCost: 7, maintenanceCost: 4 }];
  const fighter3 = [{ chassisId: "fighter", level: 3 }];
  it("a level 3 character found at level 2 with one power (7 / 4): 23 + 4 = 27", () => {
    const d = derivePsionics({ classes: fighter3, scores, wild: { found: true, levelAtDiscovery: 2, powers: one } });
    expect(d).toEqual({ wild: true, level: 3, max: 27, row: powerProgression(3) });
  });
  it("found at level 3 at level 3: 23", () => {
    expect(derivePsionics({ classes: fighter3, scores, wild: { found: true, levelAtDiscovery: 3, powers: one } })?.max).toBe(23);
  });
  it("never goes negative when the level is below the discovery level; two powers add; no powers is 0", () => {
    expect(derivePsionics({ classes: fighter3, scores, wild: { found: true, levelAtDiscovery: 5, powers: one } })?.max).toBe(23);
    expect(derivePsionics({ classes: fighter3, scores, wild: { found: true, levelAtDiscovery: 3, powers: [...one, { initialCost: 3, maintenanceCost: 0 }] } })?.max).toBe(26);
    expect(derivePsionics({ classes: fighter3, scores, wild: { found: true, levelAtDiscovery: 3, powers: [] } })?.max).toBe(0);
  });
  it("uses the highest class level of a multiclass", () => {
    const d = derivePsionics({ classes: [{ chassisId: "fighter", level: 2 }, { chassisId: "mage", level: 5 }], scores, wild: { found: true, levelAtDiscovery: 4, powers: [] } });
    expect(d?.level).toBe(5);
    expect(d?.max).toBe(4);
  });
  it("a psionicist is unaffected by wild data (wild false, the normal max)", () => {
    const d = derivePsionics({ classes: [{ chassisId: "psionicist", level: 5 }], scores, wild: { found: true, levelAtDiscovery: 1, powers: one } });
    expect(d?.wild).toBe(false);
    expect(d?.max).toBe(73);
  });
  it("is null when not found, when there is no class entry, or without wild data", () => {
    expect(derivePsionics({ classes: fighter3, scores, wild: { found: false, levelAtDiscovery: 0, powers: one } })).toBeNull();
    expect(derivePsionics({ classes: [], scores, wild: { found: true, levelAtDiscovery: 0, powers: one } })).toBeNull();
    expect(derivePsionics({ classes: fighter3, scores })).toBeNull();
  });
  it("deriveCharacter threads the snapshot's wildTalent through (and a psionicist reports wild false)", () => {
    const s = (chassisId: "psionicist" | "fighter"): ActorSnapshot => ({
      abilities: { str: 12, dex: 12, con: 16, int: 12, wis: 17, cha: 12 },
      exceptionalStrengthPercentile: null,
      race: "human",
      classes: [{ chassisId, specialistSchool: null, xp: 4000, hpRolls: [], dualClassState: null, level: 3 }],
      equippedArmor: null, equippedShield: null, carriedWeight: 0, wizardMemorized: [], priestMemorized: [],
      spentWeaponSlots: 0, spentNonweaponSlots: 0, baseMovement: 12, thiefSkillAllocations: [], traits: [], isCasting: false,
      wildTalent: { found: true, levelAtDiscovery: 2, powers: one },
    });
    const wild = deriveCharacter(s("fighter"), DEFAULT_OPTIONAL_RULES).psionics;
    expect(wild?.wild).toBe(true);
    expect(wild?.max).toBe(27);
    expect(deriveCharacter(s("psionicist"), DEFAULT_OPTIONAL_RULES).psionics?.wild).toBe(false);
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

  it("a dormant dual-class psionicist has no psionics; the active psionicist and a surpassed one do", () => {
    const base = snap("psionicist", 0);
    const dual = (dormantXp: number, activeXp: number): ActorSnapshot => ({
      ...base,
      classes: [
        { ...base.classes[0], chassisId: "psionicist", xp: dormantXp, dualClassState: "primary" as never },
        { ...base.classes[0], chassisId: "fighter", xp: activeXp, dualClassState: "active" as never },
      ],
    });
    const dormant = deriveCharacter(dual(16500, 0), DEFAULT_OPTIONAL_RULES);
    expect(dormant.multiclass.dualClass.dormantChassisId).toBe("psionicist");
    expect(dormant.multiclass.dualClass.surpassed).toBe(false);
    expect(dormant.psionics).toBeNull();
    const surpassed = deriveCharacter(dual(0, 99_000_000), DEFAULT_OPTIONAL_RULES);
    expect(surpassed.multiclass.dualClass.surpassed).toBe(true);
    expect(surpassed.psionics?.max).toBe(25);
    // the psionicist as the ACTIVE class of a dual-class is unaffected
    const active: ActorSnapshot = {
      ...base,
      classes: [
        { ...base.classes[0], chassisId: "fighter", xp: 16000, dualClassState: "primary" as never },
        { ...base.classes[0], chassisId: "psionicist", xp: 16500, dualClassState: "active" as never },
      ],
    };
    expect(deriveCharacter(active, DEFAULT_OPTIONAL_RULES).psionics?.max).toBe(73);
  });

  it("derives psionics in the multiclass path too", () => {
    const s = snap("psionicist", 0);
    const m: ActorSnapshot = { ...s, classes: [...s.classes, { ...s.classes[0], chassisId: "fighter" }] };
    const m2: ActorSnapshot = { ...m, classes: [{ ...m.classes[0], xp: 16500 }, { ...m.classes[1], xp: 99_000_000 }] };
    expect(deriveCharacter(m2, DEFAULT_OPTIONAL_RULES).psionics?.max).toBe(73);
  });
});
