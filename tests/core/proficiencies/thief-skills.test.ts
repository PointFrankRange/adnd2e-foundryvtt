import { describe, expect, it } from "vitest";
import {
  THIEF_SKILLS,
  THIEF_SKILL_BASE,
  THIEF_RACIAL_ADJUSTMENTS,
  THIEF_DEXTERITY_ADJUSTMENTS,
  THIEF_ARMOR_ADJUSTMENTS,
  THIEF_SKILL_POINT_RULES,
  thiefSkillPointsAvailable,
  thiefSkillBaseScore,
  resolveThiefSkill,
  backstabMultiplier,
  pickPocketsDetectionThreshold,
} from "../../../src/core/proficiencies/thief-skills";

describe("thief-skill tables", () => {
  it("Table 26 base scores", () => {
    expect(THIEF_SKILL_BASE).toEqual({
      "pick-pockets": 15,
      "open-locks": 10,
      "find-remove-traps": 5,
      "move-silently": 10,
      "hide-in-shadows": 5,
      "detect-noise": 15,
      "climb-walls": 60,
      "read-languages": 0,
    });
    expect(THIEF_SKILLS).toHaveLength(8);
  });
  it("Table 27 racial adjustments — every row (PHB p.39)", () => {
    expect(THIEF_RACIAL_ADJUSTMENTS.human).toEqual({
      "pick-pockets": 0,
      "open-locks": 0,
      "find-remove-traps": 0,
      "move-silently": 0,
      "hide-in-shadows": 0,
      "detect-noise": 0,
      "climb-walls": 0,
      "read-languages": 0,
    });
    expect(THIEF_RACIAL_ADJUSTMENTS.dwarf).toEqual({
      "pick-pockets": 0,
      "open-locks": 10,
      "find-remove-traps": 15,
      "move-silently": 0,
      "hide-in-shadows": 0,
      "detect-noise": 0,
      "climb-walls": -10,
      "read-languages": -5,
    });
    expect(THIEF_RACIAL_ADJUSTMENTS.elf).toEqual({
      "pick-pockets": 5,
      "open-locks": -5,
      "find-remove-traps": 0,
      "move-silently": 5,
      "hide-in-shadows": 10,
      "detect-noise": 5,
      "climb-walls": 0,
      "read-languages": 0,
    });
    expect(THIEF_RACIAL_ADJUSTMENTS.gnome).toEqual({
      "pick-pockets": 0,
      "open-locks": 5,
      "find-remove-traps": 10,
      "move-silently": 5,
      "hide-in-shadows": 5,
      "detect-noise": 10,
      "climb-walls": -15,
      "read-languages": 0,
    });
    expect(THIEF_RACIAL_ADJUSTMENTS["half-elf"]).toEqual({
      "pick-pockets": 10,
      "open-locks": 0,
      "find-remove-traps": 0,
      "move-silently": 0,
      "hide-in-shadows": 5,
      "detect-noise": 0,
      "climb-walls": 0,
      "read-languages": 0,
    });
    expect(THIEF_RACIAL_ADJUSTMENTS.halfling).toEqual({
      "pick-pockets": 5,
      "open-locks": 5,
      "find-remove-traps": 5,
      "move-silently": 10,
      "hide-in-shadows": 15,
      "detect-noise": 5,
      "climb-walls": -15,
      "read-languages": -5,
    });
  });

  it("Table 28 dexterity adjustments — every row (PHB p.39)", () => {
    expect(THIEF_DEXTERITY_ADJUSTMENTS[9]).toEqual({
      "pick-pockets": -15,
      "open-locks": -10,
      "find-remove-traps": -10,
      "move-silently": -20,
      "hide-in-shadows": -10,
    });
    expect(THIEF_DEXTERITY_ADJUSTMENTS[10]).toEqual({
      "pick-pockets": -10,
      "open-locks": -5,
      "find-remove-traps": -10,
      "move-silently": -15,
      "hide-in-shadows": -5,
    });
    expect(THIEF_DEXTERITY_ADJUSTMENTS[11]).toEqual({
      "pick-pockets": -5,
      "open-locks": 0,
      "find-remove-traps": -5,
      "move-silently": -10,
      "hide-in-shadows": 0,
    });
    expect(THIEF_DEXTERITY_ADJUSTMENTS[12]).toEqual({
      "pick-pockets": 0,
      "open-locks": 0,
      "find-remove-traps": 0,
      "move-silently": -5,
      "hide-in-shadows": 0,
    });
    expect(THIEF_DEXTERITY_ADJUSTMENTS[13]).toEqual({});
    expect(THIEF_DEXTERITY_ADJUSTMENTS[14]).toEqual({});
    expect(THIEF_DEXTERITY_ADJUSTMENTS[15]).toEqual({});
    expect(THIEF_DEXTERITY_ADJUSTMENTS[16]).toEqual({
      "pick-pockets": 0,
      "open-locks": 5,
      "find-remove-traps": 0,
      "move-silently": 0,
      "hide-in-shadows": 0,
    });
    expect(THIEF_DEXTERITY_ADJUSTMENTS[17]).toEqual({
      "pick-pockets": 5,
      "open-locks": 10,
      "find-remove-traps": 0,
      "move-silently": 5,
      "hide-in-shadows": 5,
    });
    expect(THIEF_DEXTERITY_ADJUSTMENTS[18]).toEqual({
      "pick-pockets": 10,
      "open-locks": 15,
      "find-remove-traps": 5,
      "move-silently": 10,
      "hide-in-shadows": 10,
    });
    expect(THIEF_DEXTERITY_ADJUSTMENTS[19]).toEqual({
      "pick-pockets": 15,
      "open-locks": 20,
      "find-remove-traps": 10,
      "move-silently": 15,
      "hide-in-shadows": 15,
    });
  });

  it("Table 29 armor adjustments — every row (PHB p.39)", () => {
    expect(THIEF_ARMOR_ADJUSTMENTS.none).toEqual({
      "pick-pockets": 5,
      "open-locks": 0,
      "find-remove-traps": 0,
      "move-silently": 10,
      "hide-in-shadows": 5,
      "detect-noise": 0,
      "climb-walls": 10,
      "read-languages": 0,
    });
    expect(THIEF_ARMOR_ADJUSTMENTS.leather).toEqual({
      "pick-pockets": 0,
      "open-locks": 0,
      "find-remove-traps": 0,
      "move-silently": 0,
      "hide-in-shadows": 0,
      "detect-noise": 0,
      "climb-walls": 0,
      "read-languages": 0,
    });
    expect(THIEF_ARMOR_ADJUSTMENTS["elven-chain"]).toEqual({
      "pick-pockets": -20,
      "open-locks": -5,
      "find-remove-traps": -5,
      "move-silently": -10,
      "hide-in-shadows": -10,
      "detect-noise": -5,
      "climb-walls": -20,
      "read-languages": 0,
    });
    expect(THIEF_ARMOR_ADJUSTMENTS["padded-studded"]).toEqual({
      "pick-pockets": -30,
      "open-locks": -10,
      "find-remove-traps": -10,
      "move-silently": -20,
      "hide-in-shadows": -20,
      "detect-noise": -10,
      "climb-walls": -30,
      "read-languages": 0,
    });
  });

  it("THIEF_SKILLS is exactly the ThiefSkill union", () => {
    // THIEF_SKILL_BASE is a total Record<ThiefSkill, number>, so its keys are compile-time exhaustive
    expect([...THIEF_SKILLS].sort()).toEqual(Object.keys(THIEF_SKILL_BASE).sort());
  });
});

describe("thiefSkillPointsAvailable()", () => {
  it("60 at level 1, +30 per level after", () => {
    expect(thiefSkillPointsAvailable(1)).toBe(60);
    expect(thiefSkillPointsAvailable(2)).toBe(90);
    expect(thiefSkillPointsAvailable(10)).toBe(330);
  });
  it("exposes the per-skill caps", () => {
    expect(THIEF_SKILL_POINT_RULES).toEqual({
      level1Points: 60,
      pointsPerLevelAfter: 30,
      level1PerSkillCap: 30,
      perLevelPerSkillCap: 15,
      hardCap: 95,
    });
  });
});

describe("thiefSkillBaseScore()", () => {
  it("sums base + racial + dexterity + armor", () => {
    // halfling, DEX 17, leather: move-silently = 10 + 10 (race) + 5 (DEX 17) + 0 = 25
    expect(
      thiefSkillBaseScore("move-silently", { race: "halfling", dexterity: 17, armor: "leather" }),
    ).toBe(25);
  });
  it("skills outside Table 28 get no dexterity adjustment", () => {
    // climb-walls: 60 + 0 (human) + 0 (DEX not in table) + 10 (no armor) = 70
    expect(
      thiefSkillBaseScore("climb-walls", { race: "human", dexterity: 19, armor: "none" }),
    ).toBe(70);
  });
  it("clamps dexterity to [9, 19] for the adjustment lookup", () => {
    const at19 = thiefSkillBaseScore("open-locks", {
      race: "human",
      dexterity: 19,
      armor: "leather",
    });
    const at25 = thiefSkillBaseScore("open-locks", {
      race: "human",
      dexterity: 25,
      armor: "leather",
    });
    expect(at25).toBe(at19); // both use the DEX 19 row (+20) -> 10 + 20 = 30
    expect(at25).toBe(30);
  });
  it("clamps a below-minimum dexterity up to 9 for the lookup", () => {
    const at3 = thiefSkillBaseScore("open-locks", {
      race: "human",
      dexterity: 3,
      armor: "leather",
    });
    const at9 = thiefSkillBaseScore("open-locks", {
      race: "human",
      dexterity: 9,
      armor: "leather",
    });
    expect(at3).toBe(at9);
    expect(at3).toBe(0); // base 10 + DEX 9 open-locks -10
  });
  it("can be negative (gnome climb walls in heavy leather)", () => {
    // 60 + (-15) race + 0 DEX + (-30) armor = 15 ... use padded-studded for a negative case:
    expect(
      thiefSkillBaseScore("pick-pockets", { race: "human", dexterity: 9, armor: "padded-studded" }),
    ).toBe(15 - 15 - 30); // 15 base, DEX 9 -15, armor -30 = -30
  });
});

describe("resolveThiefSkill()", () => {
  it("adds allocated points and caps at 95", () => {
    expect(
      resolveThiefSkill("climb-walls", {
        race: "human",
        dexterity: 15,
        armor: "leather",
        allocatedPoints: 20,
      }),
    ).toBe(80); // 60 + 20
    expect(
      resolveThiefSkill("climb-walls", {
        race: "human",
        dexterity: 15,
        armor: "leather",
        allocatedPoints: 50,
      }),
    ).toBe(95); // 60 + 50 = 110 -> cap 95
  });
  it("does not floor a negative score", () => {
    expect(
      resolveThiefSkill("pick-pockets", {
        race: "human",
        dexterity: 9,
        armor: "padded-studded",
        allocatedPoints: 0,
      }),
    ).toBe(-30);
  });
});

describe("backstabMultiplier()", () => {
  it("PHB Table 30 by level band", () => {
    expect(backstabMultiplier(1)).toBe(2);
    expect(backstabMultiplier(4)).toBe(2);
    expect(backstabMultiplier(5)).toBe(3);
    expect(backstabMultiplier(8)).toBe(3);
    expect(backstabMultiplier(9)).toBe(4);
    expect(backstabMultiplier(12)).toBe(4);
    expect(backstabMultiplier(13)).toBe(5);
    expect(backstabMultiplier(20)).toBe(5);
  });
  it("rejects a bad level", () => {
    expect(() => backstabMultiplier(0)).toThrow(RangeError);
  });
});

describe("pickPocketsDetectionThreshold()", () => {
  it("100 - 3x victim level", () => {
    expect(pickPocketsDetectionThreshold(0)).toBe(100);
    expect(pickPocketsDetectionThreshold(9)).toBe(73);
    expect(pickPocketsDetectionThreshold(13)).toBe(61);
  });
  it("optional rule: a higher-level thief is harder to notice", () => {
    expect(pickPocketsDetectionThreshold(9, { thiefLevel: 15 })).toBe(73 + 6);
    expect(pickPocketsDetectionThreshold(9, { thiefLevel: 9 })).toBe(73); // not higher -> no bonus
    expect(pickPocketsDetectionThreshold(9, { thiefLevel: 3 })).toBe(73); // lower -> no bonus
  });
  it("rejects a non-integer or negative victim level", () => {
    expect(() => pickPocketsDetectionThreshold(-1)).toThrow(RangeError);
    expect(() => pickPocketsDetectionThreshold(2.5)).toThrow(RangeError);
  });
  it("rejects a non-integer thief level in the optional rule", () => {
    expect(() => pickPocketsDetectionThreshold(5, { thiefLevel: 2.5 })).toThrow(RangeError);
  });
});
