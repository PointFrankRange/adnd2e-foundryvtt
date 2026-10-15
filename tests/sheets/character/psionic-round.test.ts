import { beforeEach, describe, expect, it, vi } from "vitest";
import { noteInitiation, onCombatUpdate, payRoundUpkeep } from "../../../src/sheets/character/psionic-round";

let rules: Record<string, boolean>;
vi.mock("../../../src/settings", () => ({ getOptionalRules: () => rules }));

const warn = vi.fn();
const created: { content: string }[] = [];
let combats: unknown[];
let activeGM: { id: string } | null;

beforeEach(() => {
  rules = { psionicAutoUpkeep: true };
  warn.mockClear();
  created.length = 0;
  combats = [];
  activeGM = { id: "gm" };
  const g = globalThis as Record<string, unknown>;
  g.game = {
    get combats() { return combats; },
    user: { id: "gm" },
    users: { get activeGM() { return activeGM; } },
    i18n: { format: (k: string, d: Record<string, string>) => `${k}:${JSON.stringify(d)}` },
  };
  g.ui = { notifications: { warn } };
  g.ChatMessage = { create: async (d: { content: string }) => void created.push(d) };
});

function combat(opts: { started?: boolean; round?: number; withCombatant?: boolean; flag?: unknown } = {}) {
  const flags: Record<string, unknown> = opts.flag === undefined ? {} : { psionicRound: opts.flag };
  const sets: unknown[] = [];
  const combatant = { actor: null as unknown, getFlag: (_s: string, k: string) => flags[k], setFlag: async (_s: string, k: string, v: unknown) => void sets.push([k, v]) };
  return {
    sets,
    combat: { id: "c1", started: opts.started ?? true, round: opts.round ?? 2, combatants: [combatant], getCombatantsByActor: () => (opts.withCombatant === false ? [] : [combatant]) },
  };
}
const power = (over: Record<string, unknown> = {}) => ({ name: "Mind Thrust", system: { kind: "devotion", ...over } });

describe("noteInitiation", () => {
  it("is not in combat without a started combat holding the actor", async () => {
    expect(await noteInitiation({ name: "Tam" }, power())).toEqual({ inCombat: false });
    const stopped = combat({ started: false });
    combats = [stopped.combat];
    expect(await noteInitiation({ name: "Tam" }, power())).toEqual({ inCombat: false });
    const empty = combat({ withCombatant: false });
    combats = [empty.combat];
    expect(await noteInitiation({ name: "Tam" }, power())).toEqual({ inCombat: false });
  });
  it("tallies the first power on the combatant flag with no warning", async () => {
    const c = combat();
    combats = [c.combat];
    expect(await noteInitiation({ name: "Tam" }, power())).toEqual({ inCombat: true });
    expect(c.sets).toEqual([["psionicRound", { combatId: "c1", round: 2, count: 1 }]]);
    expect(warn).not.toHaveBeenCalled();
  });
  it("warns on a second power in the same round but still goes on", async () => {
    const c = combat({ flag: { combatId: "c1", round: 2, count: 1 } });
    combats = [c.combat];
    await noteInitiation({ name: "Tam" }, power());
    expect(c.sets).toEqual([["psionicRound", { combatId: "c1", round: 2, count: 2 }]]);
    expect(warn).toHaveBeenCalledWith('ADND2E.sheet.psionics.combat.secondPower:{"name":"Tam"}');
  });
  it("a defense mode (by kind or by name) is not tallied", async () => {
    const c = combat({ flag: { combatId: "c1", round: 2, count: 1 } });
    combats = [c.combat];
    await noteInitiation({ name: "Tam" }, power({ kind: "defense" }));
    await noteInitiation({ name: "Tam" }, { name: "Mind Blank", system: { kind: "devotion" } });
    expect(c.sets).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });
});

const psionicActor = (over: Record<string, unknown> = {}) => {
  const updates: Record<string, unknown>[] = [];
  return {
    updates,
    actor: {
      name: "Tam",
      system: { psionics: { level: 3, psp: 10, max: 30, maintained: [{ powerId: "p1" }, { powerId: "gone" }], contacts: [{ tangents: 1 }, { tangents: 3 }], ...over } },
      items: [{ id: "p1", name: "Telekinesis", type: "power", system: { maintenanceCost: 4, maintenanceUnit: "round" } }],
      update: async (d: Record<string, unknown>) => void updates.push(d),
    },
  };
};

describe("payRoundUpkeep", () => {
  it("pays a per-round power and the tangent PSP, and posts one summary card", async () => {
    const { actor, updates } = psionicActor();
    const c = combat();
    (c.combat.combatants[0] as { actor: unknown }).actor = actor;
    await payRoundUpkeep(c.combat as never, 3);
    expect(updates).toEqual([{ "system.psionics.psp": 5 }]);
    expect(created).toHaveLength(1);
    expect(created[0]!.content).toContain("ADND2E.chat.psionicContest.upkeepPaid");
  });
  it("ends an unaffordable power and breaks tangents when nothing is left; keeps full contacts", async () => {
    const { actor, updates } = psionicActor({ psp: 2 });
    const c = combat();
    (c.combat.combatants[0] as { actor: unknown }).actor = actor;
    await payRoundUpkeep(c.combat as never, 3);
    // 4 PSP power cannot be paid (pool 2); the tangent PSP is paid (pool 2 -> 1)
    expect(updates).toEqual([{ "system.psionics.psp": 1, "system.psionics.maintained": [{ powerId: "gone" }] }]);
    expect(created[0]!.content).toContain("upkeepEnded");
    const broke = psionicActor({ psp: 0 });
    (c.combat.combatants[0] as { actor: unknown }).actor = broke.actor;
    created.length = 0;
    await payRoundUpkeep(c.combat as never, 4);
    expect(broke.updates[0]).toMatchObject({ "system.psionics.contacts": [{ tangents: 3 }] });
    expect(created[0]!.content).toContain("upkeepBroken");
  });
  it("skips actors without psionics or with nothing to pay, and posts no card when nothing happened", async () => {
    const c = combat();
    const none = { name: "Orc", system: {}, items: [], update: async () => undefined };
    const idle = psionicActor({ maintained: [], contacts: [{ tangents: 3 }] });
    (c.combat.combatants[0] as { actor: unknown }).actor = none;
    await payRoundUpkeep(c.combat as never, 3);
    (c.combat.combatants[0] as { actor: unknown }).actor = idle.actor;
    await payRoundUpkeep(c.combat as never, 3);
    (c.combat.combatants[0] as { actor: unknown }).actor = null;
    await payRoundUpkeep(c.combat as never, 3);
    expect(idle.updates).toEqual([]);
    expect(created).toEqual([]);
  });
  it("a null pool means full and an item with no cost fields pays nothing", async () => {
    const { actor, updates } = psionicActor({ psp: null, maintained: [{ powerId: "p2" }], contacts: [] });
    (actor.items as unknown[]).push({ id: "p2", name: "Odd", type: "power", system: { maintenanceUnit: "round" } });
    const c = combat();
    (c.combat.combatants[0] as { actor: unknown }).actor = actor;
    await payRoundUpkeep(c.combat as never, 3);
    expect(updates).toEqual([{ "system.psionics.psp": 30 }]);
  });
});

describe("onCombatUpdate", () => {
  const withActor = () => {
    const { actor, updates } = psionicActor();
    const c = combat();
    (c.combat.combatants[0] as { actor: unknown }).actor = actor;
    return { c, updates };
  };
  it("pays when the round advances past the first, on the active GM, with the rule on", async () => {
    const { c, updates } = withActor();
    await onCombatUpdate(c.combat as never, { round: 2 }, { direction: 1 });
    expect(updates).toHaveLength(1);
  });
  it("does nothing for the first round, a step back, a non-round change, the rule off or a non-active GM", async () => {
    const { c, updates } = withActor();
    await onCombatUpdate(c.combat as never, { round: 1 }, { direction: 1 });
    await onCombatUpdate(c.combat as never, { round: 3 }, { direction: -1 });
    await onCombatUpdate(c.combat as never, { round: 3 }, {});
    await onCombatUpdate(c.combat as never, {}, { direction: 1 });
    rules = { psionicAutoUpkeep: false };
    await onCombatUpdate(c.combat as never, { round: 3 }, { direction: 1 });
    rules = { psionicAutoUpkeep: true };
    activeGM = { id: "other-gm" };
    await onCombatUpdate(c.combat as never, { round: 3 }, { direction: 1 });
    activeGM = null;
    await onCombatUpdate(c.combat as never, { round: 3 }, { direction: 1 });
    expect(updates).toEqual([]);
  });
});
