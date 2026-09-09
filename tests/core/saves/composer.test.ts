import { describe, expect, it } from "vitest";
import { saveTarget, saveTargetBest } from "../../../src/core/saves/composer";
import { saveBaseTarget } from "../../../src/core/saves";

describe("saveTarget()", () => {
  const base = {
    group: "wizard" as const,
    level: 5,
    race: "human" as const,
    con: 12,
    wisMagicalDefenseAdj: 0,
    dexDefensiveAdj: 0,
  };

  it("no modifiers: target == saveBaseTarget, rollModifier 0", () => {
    const r = saveTarget({ ...base, category: "spell" });
    expect(r.target).toBe(saveBaseTarget("wizard", 5, "spell")); // 12
    expect(r.rollModifier).toBe(0);
    expect(r.effectiveTarget).toBe(r.target);
    expect(r.breakdown).toEqual({
      base: 12, racialConBonus: 0, wisdomMagicalDefense: 0, dexterityDefensive: 0, situational: 0,
    });
  });

  it("Wisdom magical defense: only when mind-affecting", () => {
    const withWis = { ...base, wisMagicalDefenseAdj: 3 };
    expect(saveTarget({ ...withWis, category: "spell" }).breakdown.wisdomMagicalDefense).toBe(0);
    const r = saveTarget({ ...withWis, category: "spell", tags: ["mind-affecting"] });
    expect(r.breakdown.wisdomMagicalDefense).toBe(3);
    expect(r.rollModifier).toBe(3);
    expect(r.effectiveTarget).toBe(r.target - 3);
  });

  it("Dexterity defensive: negated; applies to bw always, and to dodgeable-tagged", () => {
    // DEX 18 -> defensiveAdj -4 -> save bonus +4
    const agile = { ...base, dexDefensiveAdj: -4 };
    expect(saveTarget({ ...agile, category: "bw" }).breakdown.dexterityDefensive).toBe(4);
    expect(saveTarget({ ...agile, category: "spell" }).breakdown.dexterityDefensive).toBe(0);
    expect(saveTarget({ ...agile, category: "spell", tags: ["dodgeable"] }).breakdown.dexterityDefensive).toBe(4);
    // clumsy: DEX 3 -> defensiveAdj +4 -> save PENALTY -4
    expect(saveTarget({ ...base, dexDefensiveAdj: 4, category: "bw" }).breakdown.dexterityDefensive).toBe(-4);
  });

  it("racial CON bonus flows through (dwarf vs spell)", () => {
    const r = saveTarget({
      group: "warrior", level: 3, category: "spell", race: "dwarf", con: 15,
      wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(r.breakdown.racialConBonus).toBe(4); // Table 9: CON 15 -> +4
    expect(r.breakdown.base).toBe(saveBaseTarget("warrior", 3, "spell"));
    expect(r.rollModifier).toBe(4);
  });

  it("situational modifier passes through unclamped, and modifiers stack", () => {
    const r = saveTarget({
      group: "priest", level: 10, category: "ppd", race: "halfling", con: 16,
      wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0, tags: ["poison"], situationalModifier: -6,
    });
    // base ppd for priest L10 = 6; racial (halfling, ppd+poison, CON 16) = +4; situational -6
    expect(r.breakdown).toEqual({
      base: 6, racialConBonus: 4, wisdomMagicalDefense: 0, dexterityDefensive: 0, situational: -6,
    });
    expect(r.rollModifier).toBe(-2);
    expect(r.target).toBe(6);
    expect(r.effectiveTarget).toBe(8);
  });

  it("everything at once", () => {
    const r = saveTarget({
      group: "wizard", level: 12, category: "spell", race: "gnome", con: 18,
      wisMagicalDefenseAdj: 2, dexDefensiveAdj: -2,
      tags: ["mind-affecting", "dodgeable"], situationalModifier: 1,
    });
    // base wizard L12 spell = 8; gnome spell CON18 = +5; wis mind = +2; dex dodgeable = +2; situational +1
    expect(r.breakdown).toEqual({
      base: 8, racialConBonus: 5, wisdomMagicalDefense: 2, dexterityDefensive: 2, situational: 1,
    });
    expect(r.rollModifier).toBe(10);
    expect(r.effectiveTarget).toBe(-2);
  });

  it("rejects invalid level (via saveBaseTarget)", () => {
    expect(() => saveTarget({ ...base, level: 0, category: "spell" })).toThrow(RangeError);
  });

  it("rejects invalid CON even for a non-qualifying race (via racialSaveBonus)", () => {
    expect(() => saveTarget({ ...base, category: "spell", con: 999 })).toThrow(RangeError);
  });
});

describe("saveTargetBest", () => {
  it("takes the lowest (best) base target across the class groups, per category", () => {
    // warrior L5 band = [ppd 11, rsw 13, pp 12, bw 13, spell 14]
    // wizard  L6 band = [ppd 13, rsw  9, pp 11, bw 13, spell 10]
    const rsw = saveTargetBest({
      groups: [{ group: "warrior", level: 5 }, { group: "wizard", level: 6 }],
      category: "rsw", race: "human", con: 12, wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(rsw.target).toBe(9); // wizard wins rsw
    const ppd = saveTargetBest({
      groups: [{ group: "warrior", level: 5 }, { group: "wizard", level: 6 }],
      category: "ppd", race: "human", con: 12, wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0,
    });
    expect(ppd.target).toBe(11); // warrior wins ppd
  });

  it("still layers the character-level modifiers onto the winning base", () => {
    // dwarf CON 16 -> racial bonus on rsw; breath weapon gets the DEX defensive adj
    const r = saveTargetBest({
      groups: [{ group: "warrior", level: 3 }],
      category: "rsw", race: "dwarf", con: 16, wisMagicalDefenseAdj: 0, dexDefensiveAdj: -2,
    });
    // engine: Table 9 CON 16 -> +4 (brief's hand-computed +3 corrected against racialSaveBonus)
    expect(r.rollModifier).toBe(4);
    expect(r.effectiveTarget).toBe(r.target - 4);
    const bw = saveTargetBest({
      groups: [{ group: "warrior", level: 3 }],
      category: "bw", race: "human", con: 12, wisMagicalDefenseAdj: 0, dexDefensiveAdj: -2,
    });
    expect(bw.rollModifier).toBe(2); // -(-2)
  });

  it("saveTarget delegates to saveTargetBest with one group (identical result)", () => {
    const viaTarget = saveTarget({
      group: "priest", level: 9, category: "spell", race: "gnome", con: 15,
      wisMagicalDefenseAdj: 1, dexDefensiveAdj: 0, tags: ["mind-affecting"],
    });
    const viaBest = saveTargetBest({
      groups: [{ group: "priest", level: 9 }], category: "spell", race: "gnome", con: 15,
      wisMagicalDefenseAdj: 1, dexDefensiveAdj: 0, tags: ["mind-affecting"],
    });
    expect(viaTarget).toEqual(viaBest);
  });
});
