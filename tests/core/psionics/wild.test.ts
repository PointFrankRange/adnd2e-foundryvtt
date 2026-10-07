import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  direOutcome,
  isHalved,
  lookupWild,
  testWildTalent,
  wildPsp,
  wildTalentChance,
  WILD_TABLE_12,
  WILD_TABLE_13,
} from "../../../src/core/psionics";

const ROOT = path.resolve(__dirname, "..", "..", "..");
function readPowers(): Record<string, unknown>[] {
  const dir = path.join(ROOT, "packs", "powers", "_source");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as Record<string, unknown>);
}

describe("wildTalentChance", () => {
  it("base is 1", () => {
    expect(wildTalentChance({ wis: 10, con: 10, int: 10, level: 1, halved: false })).toBe(1);
  });

  it("the book's worked example: 3rd-level dwarf cleric with Wis 17, Int 9, Con 16 -> chance 2", () => {
    // halved: true because cleric
    // calculation: 1 base + 2 (Wis 17) + 0 (Int 9) + 1 (Con 16) + 0 (level 3) = 4
    // halved: ceil(4 / 2) = 2
    expect(wildTalentChance({ wis: 17, int: 9, con: 16, level: 3, halved: true })).toBe(2);
  });

  describe("ability modifiers", () => {
    it("Wisdom 18 -> +3, 17 -> +2, 16 -> +1, else 0", () => {
      expect(wildTalentChance({ wis: 18, con: 10, int: 10, level: 1, halved: false })).toBe(1 + 3);
      expect(wildTalentChance({ wis: 17, con: 10, int: 10, level: 1, halved: false })).toBe(1 + 2);
      expect(wildTalentChance({ wis: 16, con: 10, int: 10, level: 1, halved: false })).toBe(1 + 1);
      expect(wildTalentChance({ wis: 15, con: 10, int: 10, level: 1, halved: false })).toBe(1);
    });

    it("Constitution 18 -> +3, 17 -> +2, 16 -> +1, else 0", () => {
      expect(wildTalentChance({ wis: 10, con: 18, int: 10, level: 1, halved: false })).toBe(1 + 3);
      expect(wildTalentChance({ wis: 10, con: 17, int: 10, level: 1, halved: false })).toBe(1 + 2);
      expect(wildTalentChance({ wis: 10, con: 16, int: 10, level: 1, halved: false })).toBe(1 + 1);
      expect(wildTalentChance({ wis: 10, con: 15, int: 10, level: 1, halved: false })).toBe(1);
    });

    it("Intelligence 18 -> +3, 17 -> +2, 16 -> +1, else 0", () => {
      expect(wildTalentChance({ wis: 10, con: 10, int: 18, level: 1, halved: false })).toBe(1 + 3);
      expect(wildTalentChance({ wis: 10, con: 10, int: 17, level: 1, halved: false })).toBe(1 + 2);
      expect(wildTalentChance({ wis: 10, con: 10, int: 16, level: 1, halved: false })).toBe(1 + 1);
      expect(wildTalentChance({ wis: 10, con: 10, int: 15, level: 1, halved: false })).toBe(1);
    });
  });

  describe("level modifiers", () => {
    it("level 1-4 -> +0, 5-8 -> +1, 9+ -> +2", () => {
      expect(wildTalentChance({ wis: 10, con: 10, int: 10, level: 1, halved: false })).toBe(1);
      expect(wildTalentChance({ wis: 10, con: 10, int: 10, level: 4, halved: false })).toBe(1);
      expect(wildTalentChance({ wis: 10, con: 10, int: 10, level: 5, halved: false })).toBe(1 + 1);
      expect(wildTalentChance({ wis: 10, con: 10, int: 10, level: 8, halved: false })).toBe(1 + 1);
      expect(wildTalentChance({ wis: 10, con: 10, int: 10, level: 9, halved: false })).toBe(1 + 2);
      expect(wildTalentChance({ wis: 10, con: 10, int: 10, level: 20, halved: false })).toBe(1 + 2);
    });
  });

  describe("halving", () => {
    it("halved: false -> no change", () => {
      expect(wildTalentChance({ wis: 18, con: 18, int: 18, level: 9, halved: false })).toBe(1 + 3 + 3 + 3 + 2);
    });

    it("halved: true -> Math.ceil(total / 2)", () => {
      // 1 + 3 + 3 + 3 + 2 = 12, ceil(12 / 2) = 6
      expect(wildTalentChance({ wis: 18, con: 18, int: 18, level: 9, halved: true })).toBe(6);
    });

    it("odd totals round up: 5 -> 3, 1 -> 1", () => {
      // Total 5: base 1 + wis +2 + level +1 + con +1 = 5
      // ceil(5 / 2) = 3
      expect(wildTalentChance({ wis: 17, con: 16, int: 10, level: 5, halved: true })).toBe(3);

      // Total 1: base 1, no bonuses
      // ceil(1 / 2) = 1
      expect(wildTalentChance({ wis: 10, con: 10, int: 10, level: 1, halved: true })).toBe(1);
    });
  });

  it("maxed human: all 18, level 9 -> 1 + 3 + 3 + 3 + 2 = 12", () => {
    expect(wildTalentChance({ wis: 18, con: 18, int: 18, level: 9, halved: false })).toBe(12);
  });
});

describe("isHalved", () => {
  it("any class is mage or cleric -> true", () => {
    expect(isHalved({ classIds: ["mage"], raceId: "human" })).toBe(true);
    expect(isHalved({ classIds: ["cleric"], raceId: "human" })).toBe(true);
    expect(isHalved({ classIds: ["fighter", "cleric"], raceId: "human" })).toBe(true);
  });

  it("race is not human -> true", () => {
    expect(isHalved({ classIds: ["fighter"], raceId: "dwarf" })).toBe(true);
    expect(isHalved({ classIds: ["fighter"], raceId: "elf" })).toBe(true);
  });

  it("fighter human -> false", () => {
    expect(isHalved({ classIds: ["fighter"], raceId: "human" })).toBe(false);
  });

  it("human mage -> true", () => {
    expect(isHalved({ classIds: ["mage"], raceId: "human" })).toBe(true);
  });

  it("half-elf fighter -> true", () => {
    expect(isHalved({ classIds: ["fighter"], raceId: "half-elf" })).toBe(true);
  });
});

describe("direOutcome", () => {
  it("roll 97 -> ability wis, savePenalty 0", () => {
    expect(direOutcome(97)).toEqual({ roll: 97, ability: "wis", savePenalty: 0 });
  });

  it("roll 98 -> ability int, savePenalty 0", () => {
    expect(direOutcome(98)).toEqual({ roll: 98, ability: "int", savePenalty: 0 });
  });

  it("roll 99 -> ability con, savePenalty 0", () => {
    expect(direOutcome(99)).toEqual({ roll: 99, ability: "con", savePenalty: 0 });
  });

  it("roll 100 (00) -> ability all, savePenalty -5", () => {
    expect(direOutcome(100)).toEqual({ roll: 100, ability: "all", savePenalty: -5 });
  });

  it("roll below 97 -> null", () => {
    expect(direOutcome(96)).toBeNull();
    expect(direOutcome(1)).toBeNull();
    expect(direOutcome(50)).toBeNull();
  });
});

describe("testWildTalent", () => {
  it("chance 2, roll 2 -> talent, no dire", () => {
    const result = testWildTalent(2, 2, false);
    expect(result.talent).toBe(true);
    expect(result.effectiveRoll).toBe(2);
    expect(result.dire).toBeNull();
  });

  it("chance 2, roll 3 -> no talent, no dire", () => {
    const result = testWildTalent(2, 3, false);
    expect(result.talent).toBe(false);
    expect(result.effectiveRoll).toBe(3);
    expect(result.dire).toBeNull();
  });

  it("chance 2, roll 3 with surgeon -> effectiveRoll 1, talent", () => {
    const result = testWildTalent(2, 3, true);
    expect(result.talent).toBe(true);
    expect(result.effectiveRoll).toBe(1);
    expect(result.dire).toBeNull();
  });

  it("dire result comes from the RAW roll, not the surgeon-adjusted one", () => {
    const result = testWildTalent(100, 97, true);
    expect(result.dire).toEqual({ roll: 97, ability: "wis", savePenalty: 0 });
  });

  it("roll 96 -> no dire", () => {
    const result = testWildTalent(100, 96, false);
    expect(result.dire).toBeNull();
  });
});

describe("lookupWild Table 12", () => {
  it("throws for out-of-range rolls", () => {
    expect(() => lookupWild(12, 0)).toThrow();
    expect(() => lookupWild(12, 101)).toThrow();
    expect(() => lookupWild(12, -1)).toThrow();
  });

  it("01 -> Spirit Sense (at boundary)", () => {
    expect(lookupWild(12, 1)).toEqual({ kind: "power", name: "All-Round Vision" });
  });

  it("12 -> Spirit Sense", () => {
    expect(lookupWild(12, 12)).toEqual({ kind: "power", name: "Spirit Sense" });
  });

  it("13-14 -> choose clairsentient devotion", () => {
    expect(lookupWild(12, 13)).toEqual({
      kind: "choose",
      discipline: "clairsentience",
      powerKinds: ["devotion"],
    });
    expect(lookupWild(12, 14)).toEqual({
      kind: "choose",
      discipline: "clairsentience",
      powerKinds: ["devotion"],
    });
  });

  it("15 -> Animate Object", () => {
    expect(lookupWild(12, 15)).toEqual({ kind: "power", name: "Animate Object" });
  });

  it("22 -> choose psychokinetic devotion", () => {
    expect(lookupWild(12, 22)).toEqual({
      kind: "choose",
      discipline: "psychokinesis",
      powerKinds: ["devotion"],
    });
  });

  it("49 -> choose psychometabolic devotion", () => {
    expect(lookupWild(12, 49)).toEqual({
      kind: "choose",
      discipline: "psychometabolism",
      powerKinds: ["devotion"],
    });
  });

  it("50 -> Attraction", () => {
    expect(lookupWild(12, 50)).toEqual({ kind: "power", name: "Attraction" });
  });

  it("77-78 -> choose telepathic devotion", () => {
    expect(lookupWild(12, 77)).toEqual({
      kind: "choose",
      discipline: "telepathy",
      powerKinds: ["devotion"],
    });
    expect(lookupWild(12, 78)).toEqual({
      kind: "choose",
      discipline: "telepathy",
      powerKinds: ["devotion"],
    });
  });

  it("79 -> Astral Projection", () => {
    expect(lookupWild(12, 79)).toEqual({ kind: "power", name: "Astral Projection" });
  });

  it("85 -> choose psychoportive devotion", () => {
    expect(lookupWild(12, 85)).toEqual({
      kind: "choose",
      discipline: "psychoportation",
      powerKinds: ["devotion"],
    });
  });

  it("86-87 -> roll two times", () => {
    expect(lookupWild(12, 86)).toEqual({ kind: "roll", times: 2 });
    expect(lookupWild(12, 87)).toEqual({ kind: "roll", times: 2 });
  });

  it("88-89 -> roll three times", () => {
    expect(lookupWild(12, 88)).toEqual({ kind: "roll", times: 3 });
    expect(lookupWild(12, 89)).toEqual({ kind: "roll", times: 3 });
  });

  it("90 -> choose any two devotions", () => {
    expect(lookupWild(12, 90)).toEqual({
      kind: "chooseAny",
      sciences: 0,
      devotions: 2,
    });
  });

  it("91-99 -> roll on Table 13", () => {
    expect(lookupWild(12, 91)).toEqual({ kind: "table13" });
    expect(lookupWild(12, 99)).toEqual({ kind: "table13" });
  });

  it("100 -> choose devotion, then roll Table 13", () => {
    expect(lookupWild(12, 100)).toEqual({ kind: "chooseThenTable13" });
  });
});

describe("lookupWild Table 13", () => {
  it("1-2 -> Aura Sight", () => {
    expect(lookupWild(13, 1)).toEqual({ kind: "power", name: "Aura Sight" });
    expect(lookupWild(13, 2)).toEqual({ kind: "power", name: "Aura Sight" });
  });

  it("12 -> Sensitivity to Psychic Impressions", () => {
    expect(lookupWild(13, 12)).toEqual({
      kind: "power",
      name: "Sensitivity to Psychic Impressions",
    });
  });

  it("13-16 -> choose clairsentient science or devotion", () => {
    expect(lookupWild(13, 13)).toEqual({
      kind: "choose",
      discipline: "clairsentience",
      powerKinds: ["science", "devotion"],
    });
    expect(lookupWild(13, 16)).toEqual({
      kind: "choose",
      discipline: "clairsentience",
      powerKinds: ["science", "devotion"],
    });
  });

  it("17-18 -> Detonate", () => {
    expect(lookupWild(13, 17)).toEqual({ kind: "power", name: "Detonate" });
    expect(lookupWild(13, 18)).toEqual({ kind: "power", name: "Detonate" });
  });

  it("25-26 -> Telekinesis", () => {
    expect(lookupWild(13, 25)).toEqual({ kind: "power", name: "Telekinesis" });
    expect(lookupWild(13, 26)).toEqual({ kind: "power", name: "Telekinesis" });
  });

  it("27-30 -> choose psychokinetic science or devotion", () => {
    expect(lookupWild(13, 27)).toEqual({
      kind: "choose",
      discipline: "psychokinesis",
      powerKinds: ["science", "devotion"],
    });
    expect(lookupWild(13, 30)).toEqual({
      kind: "choose",
      discipline: "psychokinesis",
      powerKinds: ["science", "devotion"],
    });
  });

  it("31-32 -> Animal Affinity", () => {
    expect(lookupWild(13, 31)).toEqual({ kind: "power", name: "Animal Affinity" });
    expect(lookupWild(13, 32)).toEqual({ kind: "power", name: "Animal Affinity" });
  });

  it("43-44 -> Shadow-form", () => {
    expect(lookupWild(13, 43)).toEqual({ kind: "power", name: "Shadow-form" });
    expect(lookupWild(13, 44)).toEqual({ kind: "power", name: "Shadow-form" });
  });

  it("45-48 -> choose psychometabolic science or devotion", () => {
    expect(lookupWild(13, 45)).toEqual({
      kind: "choose",
      discipline: "psychometabolism",
      powerKinds: ["science", "devotion"],
    });
    expect(lookupWild(13, 48)).toEqual({
      kind: "choose",
      discipline: "psychometabolism",
      powerKinds: ["science", "devotion"],
    });
  });

  it("49-50 -> Domination", () => {
    expect(lookupWild(13, 49)).toEqual({ kind: "power", name: "Domination" });
    expect(lookupWild(13, 50)).toEqual({ kind: "power", name: "Domination" });
  });

  it("63-64 -> Mindlink", () => {
    expect(lookupWild(13, 63)).toEqual({ kind: "power", name: "Mindlink" });
    expect(lookupWild(13, 64)).toEqual({ kind: "power", name: "Mindlink" });
  });

  it("65-68 -> choose telepathic science or devotion", () => {
    expect(lookupWild(13, 65)).toEqual({
      kind: "choose",
      discipline: "telepathy",
      powerKinds: ["science", "devotion"],
    });
    expect(lookupWild(13, 68)).toEqual({
      kind: "choose",
      discipline: "telepathy",
      powerKinds: ["science", "devotion"],
    });
  });

  it("69-70 -> Banishment", () => {
    expect(lookupWild(13, 69)).toEqual({ kind: "power", name: "Banishment" });
    expect(lookupWild(13, 70)).toEqual({ kind: "power", name: "Banishment" });
  });

  it("77-78 -> Teleport Other", () => {
    expect(lookupWild(13, 77)).toEqual({ kind: "power", name: "Teleport Other" });
    expect(lookupWild(13, 78)).toEqual({ kind: "power", name: "Teleport Other" });
  });

  it("79-82 -> choose psychoportive science or devotion", () => {
    expect(lookupWild(13, 79)).toEqual({
      kind: "choose",
      discipline: "psychoportation",
      powerKinds: ["science", "devotion"],
    });
    expect(lookupWild(13, 82)).toEqual({
      kind: "choose",
      discipline: "psychoportation",
      powerKinds: ["science", "devotion"],
    });
  });

  it("83-85 -> roll two times", () => {
    expect(lookupWild(13, 83)).toEqual({ kind: "roll", times: 2 });
    expect(lookupWild(13, 85)).toEqual({ kind: "roll", times: 2 });
  });

  it("86-88 -> roll three times", () => {
    expect(lookupWild(13, 86)).toEqual({ kind: "roll", times: 3 });
    expect(lookupWild(13, 88)).toEqual({ kind: "roll", times: 3 });
  });

  it("89-92 -> choose any science or devotion", () => {
    expect(lookupWild(13, 89)).toEqual({
      kind: "chooseAny",
      sciences: 1,
      devotions: 0,
    });
    expect(lookupWild(13, 92)).toEqual({
      kind: "chooseAny",
      sciences: 1,
      devotions: 0,
    });
  });

  it("93-96 -> choose any science and two devotions", () => {
    expect(lookupWild(13, 93)).toEqual({
      kind: "chooseAny",
      sciences: 1,
      devotions: 2,
    });
    expect(lookupWild(13, 96)).toEqual({
      kind: "chooseAny",
      sciences: 1,
      devotions: 2,
    });
  });

  it("97-99 -> choose any science and three devotions", () => {
    expect(lookupWild(13, 97)).toEqual({
      kind: "chooseAny",
      sciences: 1,
      devotions: 3,
    });
    expect(lookupWild(13, 99)).toEqual({
      kind: "chooseAny",
      sciences: 1,
      devotions: 3,
    });
  });

  it("100 -> choose any two sciences and four devotions", () => {
    expect(lookupWild(13, 100)).toEqual({
      kind: "chooseAny",
      sciences: 2,
      devotions: 4,
    });
  });
});

describe("Table census", () => {
  it("Table 12 covers 1..100 exactly once with no gap or overlap", () => {
    const covered = new Set<number>();
    for (const entry of WILD_TABLE_12) {
      for (let i = entry.from; i <= entry.to; i++) {
        expect(covered.has(i)).toBe(false);
        covered.add(i);
      }
    }
    expect(covered.size).toBe(100);
    for (let i = 1; i <= 100; i++) {
      expect(covered.has(i)).toBe(true);
    }
  });

  it("Table 13 covers 1..100 exactly once with no gap or overlap", () => {
    const covered = new Set<number>();
    for (const entry of WILD_TABLE_13) {
      for (let i = entry.from; i <= entry.to; i++) {
        expect(covered.has(i)).toBe(false);
        covered.add(i);
      }
    }
    expect(covered.size).toBe(100);
    for (let i = 1; i <= 100; i++) {
      expect(covered.has(i)).toBe(true);
    }
  });
});

describe("Power name census", () => {
  it("every power name in both tables exists as a name in the pack", () => {
    const powers = readPowers();
    const packNames = new Set(powers.map((p) => p.name as string));

    const allNames = new Set<string>();
    for (const entry of [...WILD_TABLE_12, ...WILD_TABLE_13]) {
      if (entry.result.kind === "power") {
        allNames.add(entry.result.name);
      }
    }

    for (const name of allNames) {
      expect(packNames.has(name), `Power "${name}" not found in pack`).toBe(true);
    }
  });
});

describe("wildPsp", () => {
  it("single power with cost 7, maintenance 4, no levels gained -> 23", () => {
    expect(wildPsp([{ initialCost: 7, maintenanceCost: 4 }], 0)).toBe(7 + 4 * 4);
  });

  it("two powers add", () => {
    expect(
      wildPsp(
        [
          { initialCost: 7, maintenanceCost: 4 },
          { initialCost: 6, maintenanceCost: 3 },
        ],
        0
      )
    ).toBe(7 + 4 * 4 + 6 + 4 * 3);
  });

  it("levelsGained adds 4 each", () => {
    expect(wildPsp([{ initialCost: 7, maintenanceCost: 4 }], 1)).toBe(23 + 4);
    expect(wildPsp([{ initialCost: 7, maintenanceCost: 4 }], 5)).toBe(23 + 4 * 5);
  });

  it("empty powers with levels gained", () => {
    expect(wildPsp([], 3)).toBe(4 * 3);
    expect(wildPsp([], 0)).toBe(0);
  });
});
