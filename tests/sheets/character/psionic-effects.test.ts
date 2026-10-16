import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyPsionicEffect, contactedAttack, defaultRollDice, defaultRollSave, type EffectDeps, type EffectTarget } from "../../../src/sheets/character/psionic-effects";
import type { PsionicActor, PsionicItem } from "../../../src/sheets/character/psionic-actions";

const rolls = { saved: vi.fn() };
vi.mock("../../../src/sheets/character/combat-rolls", () => ({ rollSave: (...a: unknown[]) => rolls.saved(...a) }));
vi.mock("../../../src/sheets/character/psionic-round", () => ({ noteInitiation: async () => ({ inCombat: false }) }));
const requests: unknown[] = [];
vi.mock("../../../src/relay/relay-client", () => ({ requestApply: async (_t: unknown, r: unknown) => (requests.push(r), true) }));
vi.mock("../../../src/settings", () => ({ getOptionalRules: () => ({ psionicArmorPenalties: false }) }));

let contexts: Record<string, unknown>[] = [];
const warn = vi.fn();

beforeEach(() => {
  contexts = [];
  warn.mockClear();
  const g = globalThis as Record<string, unknown>;
  g.game = { i18n: { localize: (k: string) => k, format: (k: string, d: Record<string, string>) => `${k}:${JSON.stringify(d)}` } };
  g.ui = { notifications: { warn } };
  g.ChatMessage = { create: vi.fn(async () => undefined), getSpeaker: () => ({ alias: "Tam" }) };
  g.foundry = { applications: { handlebars: { renderTemplate: async (_p: string, c: Record<string, unknown>) => (contexts.push(c), "<card/>") } } };
});

const mode = (name: string): PsionicItem => ({ id: "m", name, type: "power", system: { abilityKey: "wis", abilityModifier: 0, scoreBonus: 0, initialCost: 4 } }) as never;
const attacker = (psp = 20): PsionicActor => ({ name: "Tam", img: "t.png", items: [], system: { abilities: { wis: { score: 15 } }, psionics: { psp, maintained: [], activeDefense: "", contacts: [], max: 40, level: 3 } }, update: async () => undefined }) as never;
const target = (over: Partial<EffectTarget["actor"]["system"]> = {}, powers: string[] = ["Telekinesis", "ESP"]): EffectTarget => ({
  uuid: "Actor.t", name: "Orc",
  actor: { items: powers.map((n, i) => ({ id: `p${i}`, name: n, type: "power", system: {} })) as never, system: { attributes: { hp: { value: 30 } }, saves: { ppd: { rollModifier: 0 } }, ...over } },
});
const deps = (over: Partial<EffectDeps> = {}, natural = 10): EffectDeps & { psp: number[] } => {
  const psp: number[] = [];
  return { roll: async () => natural, rollDice: async () => 3, rollSave: async () => false, writePsp: async (r) => void psp.push(r), psp, ...over };
};

describe("contactedAttack", () => {
  it("refuses with a toast when the pool is below the cost (no roll, no write, no card)", async () => {
    const d = deps();
    await contactedAttack(attacker(2), mode("Mind Thrust"), target(), d);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.notEnoughPsp");
    expect(d.psp).toEqual([]);
    expect(contexts).toEqual([]);
  });
  it("a failed check pays half and says there is no effect", async () => {
    const d = deps({}, 19); // Wis 15, 19 > 15
    await contactedAttack(attacker(), mode("Mind Thrust"), target(), d);
    expect(d.psp).toEqual([18]);
    expect(contexts[0]).toMatchObject({ success: false, lines: [], paid: 2, remaining: 18 });
  });
  it("Mind Thrust loses a random power of the target for 2d6 days; a target without powers loses nothing", async () => {
    const dice: string[] = [];
    const d = deps({ rollDice: async (f) => (dice.push(f), f === "2d6" ? 7 : 2) });
    await contactedAttack(attacker(), mode("Mind Thrust"), target(), d);
    expect(dice).toEqual(["2d6", "1d2"]);
    expect((contexts[0] as { lines: string[] }).lines).toEqual(['ADND2E.chat.psionicEffect.mindThrustLose:{"power":"ESP","days":"7"}']);
    await contactedAttack(attacker(), mode("Mind Thrust"), target({}, []), deps());
    expect((contexts[1] as { lines: string[] }).lines).toEqual(["ADND2E.chat.psionicEffect.mindThrustNone:{}"]);
  });
  it("Ego Whip and Id Insinuation roll their durations", async () => {
    await contactedAttack(attacker(), mode("Ego Whip"), target(), deps());
    expect((contexts[0] as { lines: string[] }).lines[0]).toContain("dazed");
    await contactedAttack(attacker(), mode("Id Insinuation"), target(), deps({}, 15)); // roll = score: special
    expect((contexts[1] as { lines: string[] }).lines[0]).toContain("idTurn");
  });
  it("Psychic Crush: rolls the save, then 1d8 only on a failure; the power score result skips the save", async () => {
    const saves = vi.fn(async () => false);
    await contactedAttack(attacker(), mode("Psychic Crush"), target(), deps({ rollSave: saves }));
    expect(saves).toHaveBeenCalled();
    expect((contexts[0] as { lines: string[] }).lines[0]).toContain("crushHurt");
    const made = vi.fn(async () => true);
    await contactedAttack(attacker(), mode("Psychic Crush"), target(), deps({ rollSave: made }));
    expect((contexts[1] as { lines: string[] }).lines[0]).toContain("crushResisted");
    const auto = vi.fn(async () => true);
    await contactedAttack(attacker(), mode("Psychic Crush"), target(), deps({ rollSave: auto }, 15));
    expect(auto).not.toHaveBeenCalled();
    expect((contexts[2] as { lines: string[] }).lines[0]).toContain("crushHurt");
  });
  it("a target with no save to roll gets the manual-save line", async () => {
    await contactedAttack(attacker(), mode("Psionic Blast"), target(), deps({ rollSave: async () => null }));
    expect((contexts[0] as { lines: string[] }).lines).toEqual(['ADND2E.chat.psionicEffect.saveManual:{"save":"death"}']);
  });
  it("Psionic Blast with a failed save states the 80% loss from the target's hit points", async () => {
    await contactedAttack(attacker(), mode("Psionic Blast"), target(), deps());
    expect((contexts[0] as { lines: string[] }).lines[0]).toContain('"lost":"24"');
    await contactedAttack(attacker(), mode("Psionic Blast"), target({ attributes: undefined }), deps());
    expect((contexts[1] as { lines: string[] }).lines[0]).toContain("blastLoseUnknown");
  });
  it("posts the apply actions on the card flag (Ego Whip daze) and marks the card as applyable", async () => {
    await contactedAttack(attacker(), mode("Ego Whip"), target(), deps());
    const create = (globalThis as unknown as { ChatMessage: { create: ReturnType<typeof vi.fn> } }).ChatMessage.create;
    const created = create.mock.calls.at(-1)![0] as { flags: { adnd2e: { psionicEffect: unknown } } };
    expect(created.flags.adnd2e.psionicEffect).toEqual({ attackerActorUuid: "", targetUuid: "Actor.t", apply: [{ kind: "condition", conditionId: "dazed", rounds: 3 }], applied: false });
    expect(contexts.at(-1)).toMatchObject({ hasApply: true });
  });
  it("a natural 20 fails and adds the book note for Psychic Crush", async () => {
    await contactedAttack(attacker(), mode("Psychic Crush"), target(), deps({}, 20));
    expect(contexts[0]).toMatchObject({ success: false, note: "ADND2E.chat.psionicEffect.crushNat20" });
  });
});

describe("the Apply button (issue #180)", () => {
  const flagOf = (over: Record<string, unknown> = {}) => ({ attackerActorUuid: "Actor.att", targetUuid: "Actor.t", apply: [{ kind: "damage", amount: 4 }, { kind: "condition", conditionId: "dazed", rounds: 2 }], applied: false, ...over });
  const setup = (flag: unknown, opts: { isGM?: boolean; owner?: boolean; target?: boolean } = {}) => {
    const updates: Record<string, unknown>[] = [];
    const g = globalThis as Record<string, unknown>;
    (g.game as Record<string, unknown>).user = { isGM: opts.isGM ?? false };
    (g.game as Record<string, unknown>).messages = { get: (id: string) => (id === "m1" ? { getFlag: () => flag, update: async (d: Record<string, unknown>) => void updates.push(d) } : undefined) };
    (g.foundry as Record<string, unknown>).utils = { fromUuidSync: (u: string) => (u === "Actor.att" ? { isOwner: opts.owner ?? false } : opts.target === false ? null : { isOwner: false }) };
    requests.length = 0;
    return updates;
  };
  it("the attacker's owner applies each action through the relay and the card is marked applied", async () => {
    const updates = setup(flagOf(), { owner: true });
    await applyPsionicEffect("m1");
    expect(requests).toEqual([{ kind: "damage", targetUuid: "Actor.t", amount: 4 }, { kind: "condition", targetUuid: "Actor.t", conditionId: "dazed", rounds: 2 }]);
    expect(updates).toEqual([{ "flags.adnd2e.psionicEffect.applied": true }]);
  });
  it("a GM may apply too", async () => {
    const updates = setup(flagOf(), { isGM: true });
    await applyPsionicEffect("m1");
    expect(updates).toHaveLength(1);
  });
  it("anyone else is refused; an applied card, a card with nothing to apply and an unknown message do nothing", async () => {
    setup(flagOf());
    await applyPsionicEffect("m1");
    expect(warn).toHaveBeenCalledWith("ADND2E.chat.psionicEffect.notYours");
    setup(flagOf({ applied: true }), { isGM: true });
    await applyPsionicEffect("m1");
    setup(flagOf({ apply: [] }), { isGM: true });
    await applyPsionicEffect("m1");
    setup(undefined, { isGM: true });
    await applyPsionicEffect("m1");
    await applyPsionicEffect("nope");
    const updates = setup(flagOf(), { isGM: true });
    await applyPsionicEffect("nope");
    expect(requests).toEqual([]);
    expect(updates).toEqual([]);
  });
  it("a missing target warns and leaves the card unapplied", async () => {
    const updates = setup(flagOf(), { isGM: true, target: false });
    await applyPsionicEffect("m1");
    expect(warn).toHaveBeenCalledWith("ADND2E.chat.psionicEffect.noTarget");
    expect(updates).toEqual([]);
  });
  it("a second click while the first is in flight does not apply twice", async () => {
    const updates = setup(flagOf(), { isGM: true });
    await Promise.all([applyPsionicEffect("m1"), applyPsionicEffect("m1")]);
    expect(requests).toHaveLength(2);
    expect(updates).toHaveLength(1);
  });
});

describe("defaults", () => {
  it("defaultRollDice evaluates a Roll", async () => {
    (globalThis as Record<string, unknown>).Roll = class { total = 9; async evaluate() { return this; } };
    expect(await defaultRollDice("2d6")).toBe(9);
  });
  it("defaultRollSave rolls through the PC save roller only for a target that has a save", async () => {
    rolls.saved.mockResolvedValue(true);
    expect(await defaultRollSave(target().actor)).toBe(true);
    expect(rolls.saved).toHaveBeenCalledWith(expect.anything(), "ppd");
    expect(await defaultRollSave(target({ saves: undefined }).actor)).toBeNull();
  });
});
