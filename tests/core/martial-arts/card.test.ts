import { describe, expect, it } from "vitest";
import { buildManeuverCardContext, buildMartialCardContext, resolveManeuverAttack, resolveMartialAttack } from "../../../src/core/martial-arts";

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

describe("buildManeuverCardContext", () => {
  const attackInput = {
    maneuverId: "kick:1", naturalD20: 12, thac0: 20, targetAc: 10, attackerArmorType: "none", opponentWeaponSize: null,
    situationalModifier: 0, targetArmorGroup: "mail" as const, styleDie: "1d4", level: 5, strengthAdj: 1,
  };
  it("an attack maneuver hit shows its name, cost, modifiers, formula, damage and effect text", () => {
    const ctx = buildManeuverCardContext({
      actorName: "Akira", actorImg: "a.png", styleName: "Karate", targetName: "Ogre",
      result: resolveManeuverAttack(attackInput), damageTotal: 6,
    });
    expect(ctx.maneuverKey).toBe("ADND2E.martialManeuvers.circleKick");
    expect(ctx.costKey).toBe("ADND2E.martialManeuverCosts.one");
    expect(ctx.breakdown).toEqual([{ labelKey: "ADND2E.chat.martialArts.mod.table21", amount: -1 }]);
    expect(ctx.resultKey).toBe("ADND2E.chat.martialArts.hit");
    expect(ctx.outcomeKey).toBe("ADND2E.martialManeuverEffects.circleKick");
    expect(ctx.formula).toBe("1d4+1d2+1");
    expect(ctx.damage).toBe(6);
    expect(ctx.blowKey).toBe("");
  });
  it("a miss shows the failure text and no damage", () => {
    const ctx = buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: null,
      result: resolveManeuverAttack({ ...attackInput, naturalD20: 3 }), damageTotal: 0,
    });
    expect(ctx.hit).toBe(false);
    expect(ctx.resultKey).toBe("ADND2E.chat.martialArts.miss");
    expect(ctx.outcomeKey).toBe("ADND2E.martialManeuverFailures.circleKick");
    expect(ctx.formula).toBe("");
    expect(ctx.damage).toBe(0);
  });
  it("a parry reports parried or the blow hits, with the round cost key for a whole-round maneuver", () => {
    const parried = buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: "Bandit",
      result: resolveManeuverAttack({ ...attackInput, maneuverId: "block:2", naturalD20: 15 }), damageTotal: 0,
    });
    expect(parried.resultKey).toBe("ADND2E.chat.martialArts.parried");
    expect(parried.costKey).toBe("ADND2E.martialManeuverCosts.two");
    const notParried = buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: "Bandit",
      result: resolveManeuverAttack({ ...attackInput, maneuverId: "block:1", naturalD20: 2 }), damageTotal: 0,
    });
    expect(notParried.resultKey).toBe("ADND2E.chat.martialArts.notParried");
    const round = buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: null,
      result: resolveManeuverAttack({ ...attackInput, maneuverId: "strike:2", naturalD20: 14 }), damageTotal: 5,
    });
    expect(round.costKey).toBe("ADND2E.martialManeuverCosts.round");
    const none = buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: null,
      result: resolveManeuverAttack({ ...attackInput, maneuverId: "strike:1", naturalD20: 14 }), damageTotal: 5,
    });
    expect(none.costKey).toBe("ADND2E.martialManeuverCosts.none");
  });
});
