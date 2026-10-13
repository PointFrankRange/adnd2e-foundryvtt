import { describe, expect, it } from "vitest";
import { buildManeuverCardContext, buildMartialCardContext, buildSkillCardContext, resolveLeap, resolveManeuverAttack, resolveMartialAttack, resolveSpeed } from "../../../src/core/martial-arts";

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

const attackInput = {
  maneuverId: "kick:1", naturalD20: 12, thac0: 20, targetAc: 10, attackerArmorType: "none", opponentWeaponSize: null,
  situationalModifier: 0, targetArmorGroup: "mail" as const, styleDie: "1d4", level: 5, strengthAdj: 1,
};

describe("buildManeuverCardContext", () => {
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
    expect(ctx.noStyleDie).toBe(false);
  });
  it("notes a missing style die only for an attack that uses it, on a style with none", () => {
    const base = { actorName: "A", actorImg: "", styleName: "S", targetName: null, damageTotal: 0 };
    const kick = resolveManeuverAttack({ ...attackInput, styleDie: null });
    expect(buildManeuverCardContext({ ...base, result: kick, styleDieIsNull: true }).noStyleDie).toBe(true);
    expect(buildManeuverCardContext({ ...base, result: kick }).noStyleDie).toBe(false);
    const fist = resolveManeuverAttack({ ...attackInput, maneuverId: "strike:1", styleDie: null });
    expect(buildManeuverCardContext({ ...base, result: fist, styleDieIsNull: true }).noStyleDie).toBe(false);
    const parry = resolveManeuverAttack({ ...attackInput, maneuverId: "block:1", styleDie: null });
    expect(buildManeuverCardContext({ ...base, result: parry, styleDieIsNull: true }).noStyleDie).toBe(false);
    // Feint takes its damage from Table 16, and a touch rolls nothing: neither is a style-die attack
    const feint = resolveManeuverAttack({ ...attackInput, maneuverId: "movement:1", styleDie: null });
    expect(buildManeuverCardContext({ ...base, result: feint, styleDieIsNull: true }).noStyleDie).toBe(false);
    const touch = resolveManeuverAttack({ ...attackInput, maneuverId: "vitalArea:2", styleDie: null });
    expect(buildManeuverCardContext({ ...base, result: touch, styleDieIsNull: true }).noStyleDie).toBe(false);
    const circle = resolveManeuverAttack({ ...attackInput, maneuverId: "kick:1", styleDie: null });
    expect(buildManeuverCardContext({ ...base, result: circle, styleDieIsNull: true }).noStyleDie).toBe(true);
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

describe("maneuver card effects (SP18 B2)", () => {
  const base = { ...attackInput, targetArmorGroup: "light" as const };
  const card = (maneuverId: string, naturalD20 = 15, extra: Record<string, unknown> = {}) =>
    buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: "Ogre",
      result: resolveManeuverAttack({ ...base, maneuverId, naturalD20 }), damageTotal: 0, ...extra,
    });

  it("lists a condition effect with its save line and button data", () => {
    const e = card("vitalArea:3").effects;
    expect(e).toEqual([{
      id: "paralyzed", labelKey: "ADND2E.martialEffects.paralyzed", saveKey: "ADND2E.chat.martialArts.saveAt", saveMod: "-2",
      condition: "paralyzed", rounds: "2d4", damage: null, deferred: false,
    }]);
  });
  it("Choke Hold's unconscious effect is deferred; an immediate effect is not", () => {
    expect(card("lock:1").effects[0]).toMatchObject({ id: "unconscious", condition: "unconscious", deferred: true });
    expect(card("vitalArea:2").effects[0]).toMatchObject({ condition: "stunned", deferred: false });
  });
  it("a zero save modifier uses the plain save line; no save has none", () => {
    expect(card("vitalArea:2").effects[0]).toMatchObject({ saveKey: "ADND2E.chat.martialArts.save", saveMod: "", condition: "stunned", rounds: "1d4" });
    expect(card("throw:3").effects[0]).toMatchObject({ saveKey: "", saveMod: "", condition: "prone", rounds: null });
  });
  it("a non-condition effect has no button data", () => {
    expect(card("lock:3").effects[0]).toMatchObject({ id: "limbUseless", condition: null, rounds: null, saveKey: "ADND2E.chat.martialArts.save" });
  });
  it("Distance Death lists four alternatives and the double-damage one carries its rolled total", () => {
    const e = card("vitalArea:4", 15, { doubleDamageTotal: 6 }).effects;
    expect(e.map((x) => x.id)).toEqual(["pain", "stunned", "paralyzed", "doubleDamage"]);
    expect(e[1]).toMatchObject({ saveKey: "ADND2E.chat.martialArts.saveAt", saveMod: "-2" });
    expect(e[2]).toMatchObject({ saveMod: "-4" });
    expect(e[3]).toMatchObject({ damage: 6, condition: null });
  });
  it("a miss and a parry show no effects", () => {
    expect(card("vitalArea:3", 2).effects).toEqual([]);
    expect(card("block:1", 15).effects).toEqual([]);
  });
});

describe("Feint and skill cards (SP18 B3)", () => {
  const feint = {
    maneuverId: "movement:1", naturalD20: 14, thac0: 20, targetAc: 10, attackerArmorType: "none", opponentWeaponSize: null,
    situationalModifier: 0, targetArmorGroup: "none" as const, styleDie: "1d4", level: 5, strengthAdj: 1,
  };
  it("a Feint card shows the blow, a +3 maneuver row and costs 2 attacks, with no separate formula", () => {
    const ctx = buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: null, result: resolveManeuverAttack(feint), damageTotal: 3,
    });
    expect(ctx.blowKey).toBe("ADND2E.martialBlows.vitalsPunch");
    expect(ctx.costKey).toBe("ADND2E.martialManeuverCosts.two");
    expect(ctx.breakdown).toEqual([{ labelKey: "ADND2E.chat.martialArts.mod.maneuver", amount: 3 }]);
    expect(ctx.formula).toBe("");
    expect(ctx.damage).toBe(3);
  });
  it("a Leap card prints both distances and offers Prone on a failed landing", () => {
    const landed = buildSkillCardContext({
      actorName: "A", actorImg: "", styleName: "S", maneuverId: "movement:4", skill: "leap",
      result: resolveLeap({ naturalD20: 15, thac0: 20, situationalModifier: 0, level: 10 }),
    });
    expect(landed.noRoll).toBe(false);
    expect(landed.hit).toBe(true);
    expect(landed.resultKey).toBe("ADND2E.chat.martialArts.landed");
    expect(landed.lines).toEqual([
      { key: "ADND2E.chat.martialArts.leapStanding", n1: 14, n2: 13 },
      { key: "ADND2E.chat.martialArts.leapRunning", n1: 18, n2: 20 },
    ]);
    expect(landed.effects).toEqual([]);
    const fell = buildSkillCardContext({
      actorName: "A", actorImg: "", styleName: "S", maneuverId: "movement:4", skill: "leap",
      result: resolveLeap({ naturalD20: 3, thac0: 20, situationalModifier: 0, level: 10 }),
    });
    expect(fell.resultKey).toBe("ADND2E.chat.martialArts.fell");
    expect(fell.effects).toEqual([{
      id: "prone", labelKey: "ADND2E.martialEffects.prone", saveKey: "", saveMod: "", condition: "prone", rounds: null, damage: null, deferred: false,
    }]);
  });
  it("a Speed card reports the extra attacks, or none on a failure", () => {
    const ok = buildSkillCardContext({
      actorName: "A", actorImg: "", styleName: "S", maneuverId: "movement:5", skill: "speed", result: resolveSpeed({ naturalD20: 4, dexterity: 13 }),
    });
    expect(ok.resultKey).toBe("ADND2E.chat.martialArts.speedYes");
    expect(ok.lines).toEqual([
      { key: "ADND2E.chat.martialArts.speedExtra", n1: 2 },
      { key: "ADND2E.chat.martialArts.speedOnce" },
    ]);
    const no = buildSkillCardContext({
      actorName: "A", actorImg: "", styleName: "S", maneuverId: "movement:5", skill: "speed", result: resolveSpeed({ naturalD20: 18, dexterity: 13 }),
    });
    expect(no.resultKey).toBe("ADND2E.chat.martialArts.speedNo");
    expect(no.lines).toEqual([{ key: "ADND2E.chat.martialArts.speedOnce" }]);
  });
  it("a Levitation card has no roll and states rate, duration and rules", () => {
    const ctx = buildSkillCardContext({ actorName: "A", actorImg: "", styleName: "S", maneuverId: "mental:7", skill: "levitation", level: 7 });
    expect(ctx.noRoll).toBe(true);
    expect(ctx.lines).toEqual([
      { key: "ADND2E.chat.martialArts.levitationRate", n1: 5 },
      { key: "ADND2E.chat.martialArts.levitationDuration", n1: 7 },
      { key: "ADND2E.chat.martialArts.levitationRules" },
    ]);
    expect(ctx.costKey).toBe("ADND2E.martialManeuverCosts.round");
  });
});
