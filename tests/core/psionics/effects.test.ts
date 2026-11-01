import { describe, expect, it } from "vitest";
import { effectApplyActions, effectLines, effectPlan, failureNote, type EffectOutcome } from "../../../src/core/psionics";

const ok = { success: true, special: false, natural20: false };
const outcome = (over: Partial<EffectOutcome> = {}): EffectOutcome => ({ saveFailed: null, duration: null, damage: null, lostPower: null, hp: null, ...over });

describe("effectPlan (the effect of a successful check on a contacted mind)", () => {
  it("a failed check or a name that is not an attack mode has no effect", () => {
    expect(effectPlan("Mind Thrust", { ...ok, success: false })).toBeNull();
    expect(effectPlan("Mind Blank", ok)).toBeNull();
  });
  it("Mind Thrust: loses a power for 2d6 days", () => {
    expect(effectPlan("Mind Thrust", ok)).toEqual({ kind: "losePower", save: null, duration: { dice: "2d6", unit: "days" }, damageDice: null, special: null });
  });
  it("Ego Whip: dazed 1d4 rounds (names are case- and space-insensitive)", () => {
    expect(effectPlan(" ego whip ", ok)).toMatchObject({ kind: "daze", duration: { dice: "1d4", unit: "rounds" } });
  });
  it("Id Insinuation: idle 1d4 rounds; a roll at the power score turns the target on its allies", () => {
    expect(effectPlan("Id Insinuation", ok)).toMatchObject({ kind: "idle", special: null });
    expect(effectPlan("Id Insinuation", { ...ok, special: true })).toMatchObject({ kind: "idle", special: "turnOnAllies" });
  });
  it("Psychic Crush: save vs paralyzation then 1d8; the power score result makes the save fail", () => {
    expect(effectPlan("Psychic Crush", ok)).toMatchObject({ kind: "crush", save: { label: "paralyzation", autoFail: false }, damageDice: "1d8" });
    expect(effectPlan("Psychic Crush", { ...ok, special: true })!.save).toEqual({ label: "paralyzation", autoFail: true });
  });
  it("Psionic Blast: save vs death; the power score result also knocks the target out for a turn", () => {
    expect(effectPlan("Psionic Blast", ok)).toMatchObject({ kind: "blast", save: { label: "death", autoFail: false }, special: null });
    expect(effectPlan("Psionic Blast", { ...ok, special: true })!.special).toBe("passOut");
  });
});

describe("failureNote", () => {
  it("only Id Insinuation and Psychic Crush have a natural-20 note", () => {
    expect(failureNote("Id Insinuation", true)).toBe("idNat20");
    expect(failureNote("Psychic Crush", true)).toBe("crushNat20");
    expect(failureNote("Ego Whip", true)).toBeNull();
    expect(failureNote("Psychic Crush", false)).toBeNull();
  });
});

describe("effectLines", () => {
  const plan = (mode: string, special = false) => effectPlan(mode, { success: true, special, natural20: false })!;
  it("a save that could not be rolled asks the target to roll it", () => {
    expect(effectLines(plan("Psychic Crush"), outcome())).toEqual([{ key: "saveManual", params: { save: "paralyzation" } }]);
    expect(effectLines(plan("Psionic Blast"), outcome())).toEqual([{ key: "saveManual", params: { save: "death" } }]);
  });
  it("Mind Thrust names the lost power or says there is none", () => {
    expect(effectLines(plan("Mind Thrust"), outcome({ duration: 7, lostPower: "ESP" }))).toEqual([{ key: "mindThrustLose", params: { power: "ESP", days: 7 } }]);
    expect(effectLines(plan("Mind Thrust"), outcome({ duration: 7 }))).toEqual([{ key: "mindThrustNone", params: {} }]);
  });
  it("Ego Whip and Id Insinuation report the rolled duration", () => {
    expect(effectLines(plan("Ego Whip"), outcome({ duration: 3 }))[0]).toEqual({ key: "dazed", params: { rounds: 3, unit: "rounds" } });
    expect(effectLines(plan("Id Insinuation"), outcome({ duration: 2 }))[0]).toEqual({ key: "idIdle", params: { rounds: 2 } });
    expect(effectLines(plan("Id Insinuation", true), outcome({ duration: 2 }))[0]).toEqual({ key: "idTurn", params: { rounds: 2 } });
  });
  it("Psychic Crush: damage on a failed save, none on a made one", () => {
    expect(effectLines(plan("Psychic Crush"), outcome({ saveFailed: true, damage: 5 }))).toEqual([{ key: "crushHurt", params: { damage: 5 } }]);
    expect(effectLines(plan("Psychic Crush"), outcome({ saveFailed: true }))).toEqual([{ key: "crushHurt", params: { damage: 0 } }]);
    expect(effectLines(plan("Psychic Crush"), outcome({ saveFailed: false }))).toEqual([{ key: "crushResisted", params: {} }]);
  });
  it("Psionic Blast: 80% of the remaining hit points (rounded down), the pass-out extra, or resisted", () => {
    expect(effectLines(plan("Psionic Blast"), outcome({ saveFailed: true, hp: 33 }))).toEqual([{ key: "blastLose", params: { lost: 26 } }]);
    expect(effectLines(plan("Psionic Blast"), outcome({ saveFailed: true }))).toEqual([{ key: "blastLoseUnknown", params: {} }]);
    expect(effectLines(plan("Psionic Blast", true), outcome({ saveFailed: true, hp: 10 })).map((l) => l.key)).toEqual(["blastLose", "blastPassOut"]);
    expect(effectLines(plan("Psionic Blast"), outcome({ saveFailed: false, hp: 10 }))).toEqual([{ key: "blastResisted", params: {} }]);
  });
});

describe("effectApplyActions (what the Apply button does)", () => {
  const plan = (mode: string, special = false) => effectPlan(mode, { success: true, special, natural20: false })!;
  it("Psychic Crush: damage only on a failed save", () => {
    expect(effectApplyActions(plan("Psychic Crush"), outcome({ saveFailed: true, damage: 5 }))).toEqual([{ kind: "damage", amount: 5 }]);
    expect(effectApplyActions(plan("Psychic Crush"), outcome({ saveFailed: false, damage: 5 }))).toEqual([]);
    expect(effectApplyActions(plan("Psychic Crush"), outcome({ saveFailed: null }))).toEqual([]);
    expect(effectApplyActions(plan("Psychic Crush"), outcome({ saveFailed: true }))).toEqual([]);
  });
  it("Id Insinuation stuns for the rolled rounds, but a roll at the power score (turn on allies) is left to the GM", () => {
    expect(effectApplyActions(plan("Id Insinuation"), outcome({ duration: 3 }))).toEqual([{ kind: "condition", conditionId: "stunned", rounds: 3 }]);
    expect(effectApplyActions(plan("Id Insinuation", true), outcome({ duration: 3 }))).toEqual([]);
    expect(effectApplyActions(plan("Id Insinuation"), outcome())).toEqual([]);
  });
  it("Ego Whip dazes for the rolled rounds", () => {
    expect(effectApplyActions(plan("Ego Whip"), outcome({ duration: 2 }))).toEqual([{ kind: "condition", conditionId: "dazed", rounds: 2 }]);
    expect(effectApplyActions(plan("Ego Whip"), outcome())).toEqual([]);
  });
  it("Mind Thrust and Psionic Blast apply nothing", () => {
    expect(effectApplyActions(plan("Mind Thrust"), outcome({ duration: 7, lostPower: "ESP" }))).toEqual([]);
    expect(effectApplyActions(plan("Psionic Blast"), outcome({ saveFailed: true, hp: 30 }))).toEqual([]);
  });
});
