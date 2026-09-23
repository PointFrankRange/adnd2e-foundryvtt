import { describe, expect, it } from "vitest";
import {
  SUB_ABILITIES,
  effectiveSubScore,
  mainScoreFromSubs,
  subAbilitiesEnabled,
  subScoreSeedUpdate,
} from "../../../src/core/abilities/sub-abilities";

describe("SUB_ABILITIES", () => {
  it("names two sub-abilities for each of the six abilities", () => {
    expect(SUB_ABILITIES).toEqual({
      str: ["muscle", "stamina"],
      dex: ["aim", "balance"],
      con: ["health", "fitness"],
      int: ["reason", "knowledge"],
      wis: ["intuition", "willpower"],
      cha: ["leadership", "appearance"],
    });
  });
});

describe("subAbilitiesEnabled", () => {
  it("requires BOTH the master switch and the sub-ability toggle", () => {
    expect(subAbilitiesEnabled({ skillsAndPowersEnabled: true, subAbilityScores: true })).toBe(true);
    expect(subAbilitiesEnabled({ skillsAndPowersEnabled: true, subAbilityScores: false })).toBe(false);
    expect(subAbilitiesEnabled({ skillsAndPowersEnabled: false, subAbilityScores: true })).toBe(false);
    expect(subAbilitiesEnabled({ skillsAndPowersEnabled: false, subAbilityScores: false })).toBe(false);
  });
});

describe("effectiveSubScore", () => {
  it("returns the authored sub-score when set", () => {
    expect(effectiveSubScore(12, 10)).toBe(12);
  });
  it("falls back to the main score when the sub-score is null", () => {
    expect(effectiveSubScore(null, 14)).toBe(14);
  });
});

describe("mainScoreFromSubs", () => {
  it("averages two authored sub-scores", () => {
    expect(mainScoreFromSubs(10, 10, 99)).toBe(10);
    expect(mainScoreFromSubs(18, 14, 99)).toBe(16);
  });
  it("rounds a .5 average UP (Math.round tie-break)", () => {
    expect(mainScoreFromSubs(14, 15, 10)).toBe(15);
    expect(mainScoreFromSubs(10, 11, 10)).toBe(11);
    expect(mainScoreFromSubs(1, 2, 10)).toBe(2);
  });
  it("a null sub-score falls back to the main score, per side", () => {
    expect(mainScoreFromSubs(null, null, 14)).toBe(14);
    expect(mainScoreFromSubs(12, null, 14)).toBe(13);
    expect(mainScoreFromSubs(null, 13, 14)).toBe(14); // (14 + 13) / 2 = 13.5 -> 14
  });
  it("clamps the result to [1, 25]", () => {
    expect(mainScoreFromSubs(25, 25, 10)).toBe(25);
    expect(mainScoreFromSubs(null, null, 30)).toBe(25);
    expect(mainScoreFromSubs(1, 1, 10)).toBe(1);
    expect(mainScoreFromSubs(null, null, 0)).toBe(1);
  });
});

describe("subScoreSeedUpdate", () => {
  const scores = (over: Record<string, unknown> = {}) =>
    ({
      str: { score: 17 }, dex: { score: 12 }, con: { score: 15 },
      int: { score: 10 }, wis: { score: 9 }, cha: { score: 13 },
      ...over,
    }) as Parameters<typeof subScoreSeedUpdate>[0];

  it("seeds every null sub-score from its ability's authored score (12 entries when no sub key exists)", () => {
    const update = subScoreSeedUpdate(scores());
    expect(Object.keys(update)).toHaveLength(12);
    expect(update["system.abilities.str.sub.a"]).toBe(17);
    expect(update["system.abilities.str.sub.b"]).toBe(17);
    expect(update["system.abilities.wis.sub.a"]).toBe(9);
    expect(update["system.abilities.cha.sub.b"]).toBe(13);
  });

  it("treats a null sub object the same as a missing one", () => {
    expect(Object.keys(subScoreSeedUpdate(scores({ str: { score: 17, sub: null } })))).toHaveLength(12);
  });

  it("never overwrites an authored (non-null) sub-score", () => {
    const update = subScoreSeedUpdate(scores({ str: { score: 17, sub: { a: 18, b: null } } }));
    expect(update).not.toHaveProperty("system.abilities.str.sub.a");
    expect(update["system.abilities.str.sub.b"]).toBe(17);
  });

  it("returns an empty update when everything is already authored", () => {
    const full = Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map((k) => [k, { score: 10, sub: { a: 10, b: 10 } }]),
    );
    expect(subScoreSeedUpdate(scores(full))).toEqual({});
  });

  it("clamps a seeded value to [1, 25]", () => {
    const update = subScoreSeedUpdate(scores({ str: { score: 30 }, dex: { score: 0 } }));
    expect(update["system.abilities.str.sub.a"]).toBe(25);
    expect(update["system.abilities.dex.sub.a"]).toBe(1);
  });
});
