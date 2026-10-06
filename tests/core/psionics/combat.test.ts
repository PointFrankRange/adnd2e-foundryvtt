import { describe, expect, it } from "vitest";
import {
  ATTACK_MODES, DEFENSE_MODES, FULL_CONTACT, attackModifier, breakTangents, endContact, isAttackMode, isDefenseMode, isFullContact,
  maintainedCheck, needsDefenseRoll, recordTangents, resolveContest, resolveSeries, tangentsOn, upkeepDue, type Contact,
} from "../../../src/core/psionics";

describe("Table 14 (PHBR5 p.26)", () => {
  const want: Record<string, number[]> = {
    "Mind Thrust": [5, -2, -4, -4, -5],
    "Ego Whip": [5, 0, -3, -4, -3],
    "Id Insinuation": [-3, 2, 4, -1, -3],
    "Psychic Crush": [1, -3, -1, -3, -4],
    "Psionic Blast": [2, 3, 0, -1, -2],
  };
  it("matches every cell, in the book's defense order", () => {
    expect([...DEFENSE_MODES]).toEqual(["Mind Blank", "Thought Shield", "Mental Barrier", "Intellect Fortress", "Tower of Iron Will"]);
    expect([...ATTACK_MODES]).toEqual(Object.keys(want));
    for (const [attack, row] of Object.entries(want)) DEFENSE_MODES.forEach((d, i) => expect(attackModifier(attack, d), `${attack} vs ${d}`).toBe(row[i]));
  });
  it("no defense, unknown names and case/whitespace", () => {
    expect(attackModifier("Ego Whip", null)).toBe(0);
    expect(attackModifier("Ego Whip", "Nothing")).toBe(0);
    expect(attackModifier("Fireball", "Mind Blank")).toBe(0);
    expect(attackModifier("  ego whip ", "mind BLANK")).toBe(5);
    expect(isAttackMode(" psychic crush")).toBe(true);
    expect(isAttackMode("Contact")).toBe(false);
    expect(isDefenseMode("tower of iron will")).toBe(true);
    expect(isDefenseMode("Mind Thrust")).toBe(false);
  });
});

describe("resolveContest: the book's example (attack score 15, defense score 12)", () => {
  const r = (attackRoll: number, defenseRoll: number | null) => resolveContest({ attackRoll, attackScore: 15, defenseRoll, defenseScore: 12 });
  it("11 vs 6: attacker, higher roll", () => expect(r(11, 6)).toEqual({ attackSuccess: true, winner: "attacker", reason: "higher" }));
  it("3 vs 9: defender, higher roll", () => expect(r(3, 9)).toEqual({ attackSuccess: true, winner: "defender", reason: "higher" }));
  it("4 vs 18: attacker, only the attack succeeded", () => expect(r(4, 18)).toEqual({ attackSuccess: true, winner: "attacker", reason: "attacker-only" }));
  it("16 vs 10: defender, the attack failed", () => expect(r(16, 10)).toEqual({ attackSuccess: false, winner: "defender", reason: "attack-failed" }));
  it("19 vs 15: defender wins by default (both failed)", () => expect(r(19, 15)).toEqual({ attackSuccess: false, winner: "defender", reason: "attack-failed" }));
  it("8 vs 8: a tie goes to the defender", () => expect(r(8, 8)).toEqual({ attackSuccess: true, winner: "defender", reason: "tie" }));
  it("15 vs (none): the attack roll beats the defense score, so the attacker wins automatically", () => {
    expect(r(15, null)).toEqual({ attackSuccess: true, winner: "attacker", reason: "automatic" });
    expect(needsDefenseRoll(15, 15, 12)).toBe(false);
    expect(needsDefenseRoll(11, 15, 12)).toBe(true);
    expect(needsDefenseRoll(16, 15, 12)).toBe(false); // attack failed: no defense roll needed
  });
  it("natural 1 always succeeds (even against a negative attack score) and a 20 always fails", () => {
    expect(resolveContest({ attackRoll: 1, attackScore: -3, defenseRoll: 1, defenseScore: 12 })).toEqual({ attackSuccess: true, winner: "defender", reason: "tie" });
    expect(resolveContest({ attackRoll: 1, attackScore: -3, defenseRoll: 5, defenseScore: 12 })).toEqual({ attackSuccess: true, winner: "defender", reason: "higher" });
    expect(resolveContest({ attackRoll: 1, attackScore: -3, defenseRoll: 18, defenseScore: 12 })).toEqual({ attackSuccess: true, winner: "attacker", reason: "attacker-only" });
    expect(resolveContest({ attackRoll: 20, attackScore: 30, defenseRoll: null, defenseScore: 5 })).toEqual({ attackSuccess: false, winner: "defender", reason: "attack-failed" });
  });
  it("boundary: an attack roll equal to the defense score is NOT automatic (the defense roll is still needed); one above is", () => {
    expect(needsDefenseRoll(12, 15, 12)).toBe(true);
    expect(needsDefenseRoll(13, 15, 12)).toBe(false);
    expect(resolveContest({ attackRoll: 12, attackScore: 15, defenseRoll: 11, defenseScore: 12 })).toEqual({ attackSuccess: true, winner: "attacker", reason: "higher" });
    expect(resolveContest({ attackRoll: 13, attackScore: 15, defenseRoll: null, defenseScore: 12 })).toEqual({ attackSuccess: true, winner: "attacker", reason: "automatic" });
    expect(() => resolveContest({ attackRoll: 12, attackScore: 15, defenseRoll: null, defenseScore: 12 })).toThrow();
  });
  it("unopposed: no defender at all", () => {
    expect(resolveContest({ attackRoll: 10, attackScore: 12, defenseRoll: null, defenseScore: null })).toEqual({ attackSuccess: true, winner: "attacker", reason: "unopposed" });
    expect(resolveContest({ attackRoll: 13, attackScore: 12, defenseRoll: null, defenseScore: null })).toEqual({ attackSuccess: false, winner: "defender", reason: "attack-failed" });
    expect(needsDefenseRoll(10, 12, null)).toBe(false);
  });
  it("a needed defense roll that is missing is a programming error", () => {
    expect(() => resolveContest({ attackRoll: 5, attackScore: 15, defenseRoll: null, defenseScore: 12 })).toThrow();
  });
});

describe("maintainedCheck (p.24): +1 to the score; a failed check counts as a success of 1", () => {
  it("applies the bonus and the failure rule", () => {
    expect(maintainedCheck(10, 9)).toEqual({ result: "success", success: true, special: true, roll: 10, score: 10 });
    expect(maintainedCheck(15, 9)).toEqual({ result: "minimum-success", success: true, special: false, roll: 1, score: 10 });
    expect(maintainedCheck(20, 30)).toEqual({ result: "minimum-success", success: true, special: false, roll: 1, score: 31 }); // a natural 20 is ignored too
  });
});

describe("resolveSeries (the one-two punch)", () => {
  it("two attacks, each resolved; tangents add up", () => {
    const out = resolveSeries([{ roll: 4, score: 15 }, { roll: 5, score: 15 }], 12, [18, 18], 0);
    expect(out.tangentsGained).toBe(2);
    expect(out.fullContact).toBe(false);
    expect(out.anySuccess).toBe(true);
    expect(out.steps.map((s) => s.made)).toEqual([true, true]);
  });
  it("stops after full contact: the second attack is not made", () => {
    const out = resolveSeries([{ roll: 4, score: 15 }, { roll: 5, score: 15 }], null, [null, null], 2);
    expect(out.tangentsGained).toBe(1);
    expect(out.fullContact).toBe(true);
    expect(out.steps.map((s) => s.made)).toEqual([true, false]);
    expect(out.steps[1]).toEqual({ made: false, result: null, defenseRoll: null });
  });
  it("both attacks fail: no tangents, no success (the cost is half)", () => {
    const out = resolveSeries([{ roll: 19, score: 15 }, { roll: 20, score: 15 }], 12, [null, null], 0);
    expect(out).toMatchObject({ tangentsGained: 0, anySuccess: false, fullContact: false });
  });
  it("a defender win produces no tangent; a missing needed defense roll throws", () => {
    expect(resolveSeries([{ roll: 3, score: 15 }], 12, [9], 0)).toMatchObject({ tangentsGained: 0, anySuccess: true });
    expect(() => resolveSeries([{ roll: 3, score: 15 }], 12, [null], 0)).toThrow();
  });
  it("starting tangents already at 3 make no attack", () => {
    expect(resolveSeries([{ roll: 3, score: 15 }], null, [null], 3).steps[0]!.made).toBe(false);
  });
});

describe("contacts", () => {
  const c = (target: string, tangents: number): Contact => ({ target, name: target.toUpperCase(), tangents });
  it("recordTangents adds, caps at 3 and reaches full contact", () => {
    expect(recordTangents([], "a", "A", 2)).toEqual([{ target: "a", name: "A", tangents: 2 }]);
    expect(recordTangents([c("a", 2)], "a", "A", 5)[0]!.tangents).toBe(FULL_CONTACT);
    expect(isFullContact(c("a", 3))).toBe(true);
    expect(isFullContact(c("a", 2))).toBe(false);
    expect(recordTangents([c("a", 2)], "a", "A", 0)).toEqual([c("a", 2)]);
  });
  it("tangents on a different target break the old partial tangents but keep full contacts", () => {
    const next = recordTangents([c("a", 2), c("b", 3)], "c", "C", 1);
    expect(next.map((x) => [x.target, x.tangents])).toEqual([["b", 3], ["c", 1]]);
  });
  it("breakTangents and endContact", () => {
    expect(breakTangents([c("a", 2), c("b", 3)]).map((x) => x.target)).toEqual(["b"]);
    expect(breakTangents([c("a", 2), c("b", 2)], "a").map((x) => x.target)).toEqual(["b"]);
    expect(endContact([c("a", 2), c("b", 3)], "b").map((x) => x.target)).toEqual(["a"]);
  });
  it("upkeep is 1 PSP while any partial tangent exists, else 0; tangentsOn", () => {
    expect(upkeepDue([c("a", 1)])).toBe(1);
    expect(upkeepDue([c("a", 3)])).toBe(0);
    expect(upkeepDue([])).toBe(0);
    expect(tangentsOn([c("a", 2)], "a")).toBe(2);
    expect(tangentsOn([c("a", 2)], "z")).toBe(0);
  });
});
