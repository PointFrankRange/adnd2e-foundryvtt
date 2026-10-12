import { describe, expect, it } from "vitest";
import { buildMartialCardContext, resolveMartialAttack } from "../../../src/core/martial-arts";

// needed = 18 - 10 = 8; bonus = -1 (armor) -4 (weapon) -1 (situational) = -6; total = 14 - 6 = 8 → a hit
const input = { naturalD20: 14, thac0: 18, targetAc: 10, attackerArmorType: "studded-leather", opponentWeaponSize: "L", situationalModifier: -1, strengthDamageAdj: 1 };

describe("buildMartialCardContext", () => {
  it("lists only the non-zero modifiers and the blow with its damage", () => {
    const ctx = buildMartialCardContext({
      actorName: "Akira", actorImg: "a.png", styleName: "Karate", targetName: "Ogre",
      result: resolveMartialAttack(input),
    });
    expect(ctx.breakdown).toEqual([
      { labelKey: "ADND2E.chat.martialArts.mod.armor", amount: -1 },
      { labelKey: "ADND2E.chat.martialArts.mod.weaponSize", amount: -4 },
      { labelKey: "ADND2E.chat.martialArts.mod.situational", amount: -1 },
    ]);
    expect(ctx.hit).toBe(true);
    expect(ctx.resultKey).toBe("ADND2E.chat.martialArts.hit");
    expect(ctx.blowKey).toBe("ADND2E.martialBlows.vitalsPunch");
    expect(ctx.damage).toBe(3);
    expect(ctx.targetName).toBe("Ogre");
  });
  it("a miss has no blow and the miss key", () => {
    const ctx = buildMartialCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: null,
      result: resolveMartialAttack({ ...input, naturalD20: 2, attackerArmorType: "none", opponentWeaponSize: null, situationalModifier: 0 }),
    });
    expect(ctx.breakdown).toEqual([]);
    expect(ctx.hit).toBe(false);
    expect(ctx.resultKey).toBe("ADND2E.chat.martialArts.miss");
    expect(ctx.blowKey).toBe("");
    expect(ctx.damage).toBe(0);
  });
});
