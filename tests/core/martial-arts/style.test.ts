import { describe, expect, it } from "vitest";
import { STYLE_FORMS, STYLE_METHODS, damageDieFor, freshStyleUpdate, resolveActiveStyleId, styleStats } from "../../../src/core/martial-arts";

describe("damageDieFor — rounds up to the nearest game die", () => {
  it.each([
    [1, "1"], [2, "1d2"], [3, "1d3"], [4, "1d4"], [5, "1d6"], [6, "1d6"], [7, "1d8"], [9, "1d10"], [11, "1d12"], [13, "1d20"], [30, "1d20"],
  ])("total %i → %s", (total, die) => {
    expect(damageDieFor(total)).toBe(die);
  });
});

describe("styleStats — Table 18 derivation reproduces Table 17", () => {
  const TABLE_17: [string, "hard" | "soft" | "hardSoft", (typeof STYLE_METHODS)[number], number, string, string][] = [
    ["Aikijutsu", "soft", "throw", -3, "1", "body"],
    ["Atemi", "hard", "vitalArea", -1, "1d4", "handFoot"],
    ["Jujutsu", "hardSoft", "lock", -2, "1d2", "body"],
    ["Karate", "hard", "strike", -1, "1d4", "hand"],
    ["Kung fu", "hardSoft", "strike", -2, "1d3", "hand"],
    ["Ninjutsu", "hardSoft", "movement", -2, "1d2", "legs"],
    ["Sumo", "hardSoft", "push", -2, "1d2", "hand"],
    ["Tae Kwon Do", "hard", "kick", -1, "1d4", "foot"],
  ];
  it.each(TABLE_17)("%s", (_name, form, method, ac, die, attack) => {
    const s = styleStats(form, method);
    expect(s.acMod).toBe(ac);
    expect(s.damageDie).toBe(die);
    expect(s.principalAttack).toBe(attack);
    expect(s.extraAttacks).toBe(1);
  });
  it("a weapon principal method has no fixed damage mod or die", () => {
    const s = styleStats("hard", "weapon");
    expect(s.damageMod).toBeNull();
    expect(s.damageDie).toBeNull();
    expect(s.principalAttack).toBe("handArm");
  });
  it("lists the forms and methods", () => {
    expect([...STYLE_FORMS]).toEqual(["hard", "soft", "hardSoft"]);
    expect(STYLE_METHODS).toHaveLength(9);
  });
});

describe("resolveActiveStyleId", () => {
  it("keeps a stored id that is owned", () => expect(resolveActiveStyleId(["a", "b"], "b")).toBe("b"));
  it("falls back to the first owned style", () => expect(resolveActiveStyleId(["a", "b"], "gone")).toBe("a"));
  it("is blank with no styles", () => expect(resolveActiveStyleId([], "x")).toBe(""));
});

describe("freshStyleUpdate", () => {
  it("resets a dropped style to one invested slot and no known maneuvers", () => {
    expect(freshStyleUpdate()).toEqual({ "system.slotsInvested": 1, "system.knownManeuvers": [], "system.knownWeaponGroups": [] });
  });
});
