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
  it("Table 27 spot-checks (human is all zero)", () => {
    for (const skill of THIEF_SKILLS) expect(THIEF_RACIAL_ADJUSTMENTS.human[skill]).toBe(0);
    expect(THIEF_RACIAL_ADJUSTMENTS.dwarf["find-remove-traps"]).toBe(15);
    expect(THIEF_RACIAL_ADJUSTMENTS.halfling["hide-in-shadows"]).toBe(15);
    expect(THIEF_RACIAL_ADJUSTMENTS.gnome["climb-walls"]).toBe(-15);
  });
  it("Table 28 spot-checks (only five skills, DEX 13-15 all zero)", () => {
    expect(THIEF_DEXTERITY_ADJUSTMENTS[9]["move-silently"]).toBe(-20);
    expect(THIEF_DEXTERITY_ADJUSTMENTS[19]["open-locks"]).toBe(20);
    expect(THIEF_DEXTERITY_ADJUSTMENTS[13]["pick-pockets"] ?? 0).toBe(0);
    expect(THIEF_DEXTERITY_ADJUSTMENTS[16]["open-locks"]).toBe(5);
  });
  it("Table 29 spot-checks (leather is all zero)", () => {
    for (const skill of THIEF_SKILLS) expect(THIEF_ARMOR_ADJUSTMENTS.leather[skill]).toBe(0);
    expect(THIEF_ARMOR_ADJUSTMENTS.none["climb-walls"]).toBe(10);
    expect(THIEF_ARMOR_ADJUSTMENTS["padded-studded"]["pick-pockets"]).toBe(-30);
    expect(THIEF_ARMOR_ADJUSTMENTS["elven-chain"]["move-silently"]).toBe(-10);
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
    const at19 = thiefSkillBaseScore("open-locks", { race: "human", dexterity: 19, armor: "leather" });
    const at25 = thiefSkillBaseScore("open-locks", { race: "human", dexterity: 25, armor: "leather" });
    expect(at25).toBe(at19); // both use the DEX 19 row (+20) -> 10 + 20 = 30
    expect(at25).toBe(30);
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
      resolveThiefSkill("climb-walls", { race: "human", dexterity: 15, armor: "leather", allocatedPoints: 20 }),
    ).toBe(80); // 60 + 20
    expect(
      resolveThiefSkill("climb-walls", { race: "human", dexterity: 15, armor: "leather", allocatedPoints: 50 }),
    ).toBe(95); // 60 + 50 = 110 -> cap 95
  });
  it("does not floor a negative score", () => {
    expect(
      resolveThiefSkill("pick-pockets", { race: "human", dexterity: 9, armor: "padded-studded", allocatedPoints: 0 }),
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
});
