import { describe, expect, it } from "vitest";
import {
  classifyArrangement,
  resolveDualClassArrangement,
  resolveMulticlassArrangement,
} from "../../../../src/data/derive/character/multiclass";
import type { ClassEntry } from "../../../../src/data/derive/character/snapshot";

const entry = (over: Partial<ClassEntry> & Pick<ClassEntry, "chassisId">): ClassEntry => ({
  specialistSchool: null, xp: 0, hpRolls: [], dualClassState: null, level: 1, ...over,
});

describe("classifyArrangement", () => {
  it("0 or 1 class -> single", () => {
    expect(classifyArrangement([])).toBe("single");
    expect(classifyArrangement([entry({ chassisId: "fighter" })])).toBe("single");
  });
  it("2+ plain classes -> multiclass", () => {
    expect(classifyArrangement([entry({ chassisId: "fighter" }), entry({ chassisId: "mage" })])).toBe("multiclass");
    expect(
      classifyArrangement([entry({ chassisId: "fighter" }), entry({ chassisId: "mage" }), entry({ chassisId: "thief" })]),
    ).toBe("multiclass");
  });
  it("exactly one primary + one active -> dualclass", () => {
    expect(
      classifyArrangement([
        entry({ chassisId: "fighter", dualClassState: "primary" }),
        entry({ chassisId: "mage", dualClassState: "active" }),
      ]),
    ).toBe("dualclass");
  });
  it("malformed dual-class markers fall back to multiclass", () => {
    expect(
      classifyArrangement([
        entry({ chassisId: "fighter", dualClassState: "primary" }),
        entry({ chassisId: "mage", dualClassState: null }),
      ]),
    ).toBe("multiclass");
  });
});

describe("resolveMulticlassArrangement", () => {
  it("elf Fighter 5 / Mage 6, CON 15, averaging on", () => {
    const classes = [
      entry({ chassisId: "fighter", hpRolls: [10, 9, 8, 10, 7], level: 5 }),
      entry({ chassisId: "mage", hpRolls: [4, 3, 4, 2, 3, 4], level: 6 }),
    ];
    const r = resolveMulticlassArrangement(classes, [5, 6], 15, true);
    // characterHpMax(fighter,5,[...],+1)=44+5=49 ; characterHpMax(mage,6,[...],+1)=20+6=26
    expect(r.hpMax).toBe(37); // floor(75/2)
    expect(r.bestThac0).toEqual({ group: "warrior", level: 5 });
    expect(r.weaponProfSource.chassisId).toBe("fighter");
    expect(r.nonweaponProfSource.chassisId).toBe("mage");
    expect(r.casters.map((c) => c.chassisId)).toEqual(["mage"]);
  });

  it("CON 17: warrior member gets +3/die, non-warrior capped at +2/die", () => {
    const classes = [
      entry({ chassisId: "fighter", hpRolls: [1, 1], level: 2 }),
      entry({ chassisId: "mage", hpRolls: [1, 1], level: 2 }),
    ];
    // fighter: (1+3)+(1+3)=8 ; mage: (1+2)+(1+2)=6 ; floor(14/2)=7
    const r = resolveMulticlassArrangement(classes, [2, 2], 17, true);
    expect(r.hpMax).toBe(7);
  });

  it("averaging off -> the single highest class total", () => {
    const classes = [
      entry({ chassisId: "fighter", hpRolls: [1, 1], level: 2 }),
      entry({ chassisId: "mage", hpRolls: [1, 1], level: 2 }),
    ];
    const r = resolveMulticlassArrangement(classes, [2, 2], 17, false);
    expect(r.hpMax).toBe(8); // max(8, 6)
  });
});

describe("resolveDualClassArrangement", () => {
  const dualFighterToMage = (mageLevel: number, mageRolls: number[]) => [
    entry({ chassisId: "fighter", dualClassState: "primary", hpRolls: [10, 8, 9, 10, 7, 8], level: 6 }),
    entry({ chassisId: "mage", dualClassState: "active", hpRolls: mageRolls, level: mageLevel }),
  ];

  it("suppressed: HP frozen at the fighter total, active class only", () => {
    const classes = dualFighterToMage(3, [4, 3, 4]);
    const r = resolveDualClassArrangement(classes, [6, 3], 16);
    // characterHpMax(fighter,6,[...],+2) = 52 + 12 = 64
    expect(r.hpMax).toBe(64);
    expect(r.surpassed).toBe(false);
    expect(r.bestThac0).toEqual({ group: "wizard", level: 3 });
    expect(r.dormantChassisId).toBe("fighter");
  });

  it("surpassed: frozen fighter HP + the mage's level-7 die", () => {
    const classes = dualFighterToMage(7, [4, 3, 4, 2, 3, 4, 3]);
    const r = resolveDualClassArrangement(classes, [6, 7], 16);
    // 64 + (characterHpMax(mage,7,[7 rolls],+2) - characterHpMax(mage,6,[6 rolls],+2))
    //    = 64 + ((23 + 14) - (20 + 12)) = 64 + 5 = 69
    expect(r.hpMax).toBe(69);
    expect(r.surpassed).toBe(true);
    expect(r.bestThac0).toEqual({ group: "warrior", level: 6 });
    expect(r.saveGroups).toEqual([
      { group: "warrior", level: 6 },
      { group: "wizard", level: 7 },
    ]);
  });
});
