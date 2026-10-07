/* eslint-disable @typescript-eslint/no-explicit-any -- chat-card flags and contexts are inspected loosely */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyContestTangents, attackMode, recordButtonState, dropDefense, endContactAction, payUpkeep, raiseDefense, rollDefense } from "../../../src/sheets/character/psionic-combat";
import egoWhip from "../../../packs/powers/_source/ego-whip.json";
import mindBlankJson from "../../../packs/powers/_source/mind-blank.json";
import mindThrust from "../../../packs/powers/_source/mind-thrust.json";
import thoughtShield from "../../../packs/powers/_source/thought-shield.json";
import type { PsionicActor } from "../../../src/sheets/character/psionic-actions";

let warn: ReturnType<typeof vi.fn>;
let info: ReturnType<typeof vi.fn>;

beforeEach(() => {
  warn = vi.fn();
  info = vi.fn();
  (globalThis as Record<string, unknown>).game = { i18n: { localize: (k: string) => k, format: (k: string, d: Record<string, string>) => `${k}:${JSON.stringify(d)}` } };
  (globalThis as Record<string, unknown>).ui = { notifications: { warn, info } };
});

const power = (id: string, name: string, kind = "defense", initialCost = 1) => ({ id, name, type: "power", system: { kind, initialCost } });

function actor(opts: { psp?: number | null; level?: number; activeDefense?: string; contacts?: { target: string; name: string; tangents: number }[]; items?: unknown[] } = {}) {
  const updates: Record<string, unknown>[] = [];
  const a: PsionicActor = {
    name: "Tam", img: "t.png",
    items: (opts.items ?? [power("ts", "Thought Shield"), power("mt", "Mind Thrust", "devotion", 4), power("x", "Other Defense")]) as never,
    system: {
      abilities: {},
      psionics: { psp: opts.psp === undefined ? 20 : opts.psp, maintained: [], activeDefense: opts.activeDefense ?? "", contacts: opts.contacts ?? [], max: 40, level: opts.level ?? 3 },
    },
    update: async (d) => void updates.push(d),
  };
  return { a, updates };
}

describe("raiseDefense", () => {
  it("pays the initial cost and marks the defense active", async () => {
    const { a, updates } = actor();
    await raiseDefense(a, "ts");
    expect(updates).toEqual([{ "system.psionics.psp": 19, "system.psionics.activeDefense": "ts" }]);
  });
  it("is refused when the pool is short", async () => {
    const { a, updates } = actor({ psp: 0 });
    await raiseDefense(a, "ts");
    expect(updates).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.notEnoughPsp");
  });
  it("is refused for a non-defense-mode, a non-defense kind, or an unowned power", async () => {
    const { a, updates } = actor();
    await raiseDefense(a, "x");
    await raiseDefense(a, "mt");
    await raiseDefense(a, "nope");
    expect(updates).toEqual([]);
  });
  it("refuses the already-raised defense with an info toast", async () => {
    const { a, updates } = actor({ activeDefense: "ts" });
    await raiseDefense(a, "ts");
    expect(updates).toEqual([]);
    expect(info).toHaveBeenCalledWith("ADND2E.sheet.psionics.combat.alreadyRaised:{}");
  });
  it("refuses a non-psionicist", async () => {
    const { a, updates } = actor({ level: 0 });
    await raiseDefense(a, "ts");
    expect(updates).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.noClass");
  });
});

describe("dropDefense", () => {
  it("clears the active defense", async () => {
    const { a, updates } = actor({ activeDefense: "ts" });
    await dropDefense(a);
    expect(updates).toEqual([{ "system.psionics.activeDefense": "" }]);
  });
  it("does nothing when none is active", async () => {
    const { a, updates } = actor();
    await dropDefense(a);
    expect(updates).toEqual([]);
  });
  it("refuses a non-psionicist", async () => {
    const { a, updates } = actor({ level: 0, activeDefense: "ts" });
    await dropDefense(a);
    expect(updates).toEqual([]);
  });
});

describe("payUpkeep", () => {
  const partial = [{ target: "t1", name: "Orc", tangents: 2 }];
  const full = [{ target: "t2", name: "Ogre", tangents: 3 }];
  it("pays 1 PSP for a partial tangent", async () => {
    const { a, updates } = actor({ psp: 10, contacts: partial });
    await payUpkeep(a);
    expect(updates).toEqual([{ "system.psionics.psp": 9 }]);
  });
  it("does nothing with no partial tangent", async () => {
    const { a, updates } = actor({ contacts: full });
    await payUpkeep(a);
    expect(updates).toEqual([]);
    expect(info).toHaveBeenCalledWith("ADND2E.sheet.psionics.combat.noUpkeep:{}");
  });
  it("breaks the partial tangents (keeping full contact) at 0 PSP", async () => {
    const { a, updates } = actor({ psp: 0, contacts: [...partial, ...full] });
    await payUpkeep(a);
    expect(updates).toEqual([{ "system.psionics.contacts": full }]);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.combat.tangentsBroken");
  });
  it("refuses a non-psionicist", async () => {
    const { a, updates } = actor({ level: 0, contacts: partial });
    await payUpkeep(a);
    expect(updates).toEqual([]);
  });
});

describe("endContactAction", () => {
  it("removes the contact", async () => {
    const { a, updates } = actor({ contacts: [{ target: "t1", name: "Orc", tangents: 2 }, { target: "t2", name: "Ogre", tangents: 3 }] });
    await endContactAction(a, "t1");
    expect(updates).toEqual([{ "system.psionics.contacts": [{ target: "t2", name: "Ogre", tangents: 3 }] }]);
  });
  it("refuses a non-psionicist", async () => {
    const { a, updates } = actor({ level: 0 });
    await endContactAction(a, "t1");
    expect(updates).toEqual([]);
  });
});

/* ------------------------------------------------------------------------
 * Attack modes as psychic contests (Task 3). Real power data from the pack.
 * ------------------------------------------------------------------------ */

const real = (id: string, json: { name: string; system: Record<string, unknown> }) => ({ id, name: json.name, type: "power", system: json.system });

const messages: { id: string; flags: Record<string, Record<string, unknown>>; getFlag(s: string, k: string): unknown }[] = [];
const created: { speaker: unknown; content: string; flags: { adnd2e: { psionicContest: Record<string, any> } } }[] = [];
let renderContexts: Record<string, any>[] = [];
let uuidMap: Record<string, unknown> = {};
let isGM = false;

beforeEach(() => {
  messages.length = 0;
  created.length = 0;
  renderContexts = [];
  uuidMap = {};
  isGM = false;
  const g = (globalThis as Record<string, any>).game;
  g.user = { id: "u-att", get isGM() { return isGM; } };
  Object.defineProperty(g, "messages", { configurable: true, get: () => Object.assign(messages.slice(), { get: (id: string) => messages.find((m) => m.id === id) }) });
  (globalThis as Record<string, unknown>).ChatMessage = {
    create: vi.fn(async (d: never) => void created.push(d)),
    getSpeaker: ({ actor }: { actor: { name: string } }) => ({ alias: actor.name }),
  };
  (globalThis as Record<string, unknown>).foundry = {
    utils: { randomID: () => "cid1", fromUuidSync: (u: string) => uuidMap[u] ?? null },
    applications: { handlebars: { renderTemplate: async (_p: string, ctx: Record<string, any>) => (renderContexts.push(ctx), "<card/>") } },
  };
});

const queue = (...rolls: number[]) => {
  const q = [...rolls];
  return async () => q.shift() ?? 99;
};

function attacker(opts: { psp?: number; level?: number; wis?: number; contacts?: { target: string; name: string; tangents: number }[]; powerId?: string; power?: unknown } = {}) {
  const updates: Record<string, unknown>[] = [];
  const a = {
    uuid: "Actor.att", name: "Tam", img: "t.png",
    items: [opts.power ?? real("mt", mindThrust), real("ew", egoWhip), real("ts", thoughtShield)],
    system: { abilities: { wis: { score: opts.wis ?? 17 } }, psionics: { psp: opts.psp ?? 20, maintained: [], activeDefense: "", contacts: opts.contacts ?? [], max: 40, level: opts.level ?? 3 } },
    update: async (d: Record<string, unknown>) => void updates.push(d),
  } as unknown as PsionicActor;
  return { a, updates };
}

function target(opts: { defense?: ReturnType<typeof real>; wis?: number; level?: number; uuid?: string } = {}) {
  const writes: unknown[] = [];
  const actor = {
    uuid: opts.uuid ?? "Actor.tgt", name: "Orc", isOwner: true,
    items: opts.defense ? [opts.defense] : [],
    system: { abilities: { wis: { score: opts.wis ?? 12 } }, psionics: { level: opts.level ?? 3, activeDefense: opts.defense?.id ?? "" } },
    update: async (d: unknown) => void writes.push(d),
  };
  return { like: { name: "Orc", uuid: actor.uuid, actor: actor as never }, actor, writes };
}

const mindBlank = real("mb", mindBlankJson);
const ts = real("tsd", thoughtShield);

describe("attackMode - immediate contests (real powers)", () => {
  it("against an undefended target: Mind Thrust Wis 17 scores 15, both attacks succeed, two tangents, cost 2", async () => {
    const { a, updates } = attacker();
    const t = target();
    await attackMode(a, "mt", { roll: queue(10, 12), targets: () => [t.like], hasOnlineOwner: () => true, userId: "u-att" });
    expect(updates).toEqual([{ "system.psionics.psp": 18, "system.psionics.contacts": [{ target: "Actor.tgt", name: "Orc", tangents: 2 }] }]);
    expect(t.writes).toEqual([]);
    expect(created).toHaveLength(1);
    const flag = created[0]!.flags.adnd2e.psionicContest;
    expect(flag).toMatchObject({ id: "cid1", state: "resolved", applied: true, paid: 2, remaining: 18, defense: null, modifier: 0, startingTangents: 0, attackerUserId: "u-att", targetActorUuid: "Actor.tgt" });
    expect(flag.steps).toEqual([{ roll: 10, score: 15 }, { roll: 12, score: 15 }]);
    expect(flag.outcome.tangentsGained).toBe(2);
    expect(renderContexts[0]).toMatchObject({ pending: false, undefended: true, modifierText: "", showRecord: false, tangentText: "ADND2E.sheet.psionics.combat.tangents:{\"n\":\"2\"}" });
  });

  it("applies the Table 14 modifier to the attack score against a Mind Blank target (Wis 12 -> defense score 5; Mind Thrust +5 -> 20)", async () => {
    const { a, updates } = attacker();
    const t = target({ defense: mindBlank });
    // attack 3 needs a defense roll (3 <= 5): defense rolls 4 and the tie-break goes to the higher roll; attack 18 beats the defense score 5 outright
    await attackMode(a, "mt", { roll: queue(3, 18, 4), targets: () => [t.like], hasOnlineOwner: () => false, userId: "u-att" });
    const flag = created[0]!.flags.adnd2e.psionicContest;
    expect(flag.steps).toEqual([{ roll: 3, score: 20 }, { roll: 18, score: 20 }]);
    expect(flag.defense).toEqual({ name: "Mind Blank", score: 5 });
    expect(flag.modifier).toBe(5);
    expect(flag.outcome.steps.map((s: any) => [s.made, s.defenseRoll, s.result.winner, s.result.reason])).toEqual([[true, 4, "defender", "higher"], [true, null, "attacker", "automatic"]]);
    expect(updates).toEqual([{ "system.psionics.psp": 18, "system.psionics.contacts": [{ target: "Actor.tgt", name: "Orc", tangents: 1 }] }]);
    expect(renderContexts[0]!.modifierText).toBe("+5");
  });

  it("charges half (rounded up) when both attacks fail and writes no contacts", async () => {
    const { a, updates } = attacker();
    await attackMode(a, "mt", { roll: queue(19, 20), targets: () => [target().like], hasOnlineOwner: () => false, userId: "u-att" });
    expect(updates).toEqual([{ "system.psionics.psp": 19 }]);
    expect(created[0]!.flags.adnd2e.psionicContest.paid).toBe(1);
  });

  it("charges the full cost when only one attack succeeds", async () => {
    const { a, updates } = attacker();
    await attackMode(a, "mt", { roll: queue(5, 19), targets: () => [target().like], hasOnlineOwner: () => false, userId: "u-att" });
    expect(updates).toEqual([{ "system.psionics.psp": 18, "system.psionics.contacts": [{ target: "Actor.tgt", name: "Orc", tangents: 1 }] }]);
  });

  it("starting at 2 tangents, the first success makes full contact and the second attack is not made", async () => {
    const { a, updates } = attacker({ contacts: [{ target: "Actor.tgt", name: "Orc", tangents: 2 }] });
    await attackMode(a, "mt", { roll: queue(4, 6), targets: () => [target().like], hasOnlineOwner: () => false, userId: "u-att" });
    expect(updates).toEqual([{ "system.psionics.psp": 18, "system.psionics.contacts": [{ target: "Actor.tgt", name: "Orc", tangents: 3 }] }]);
    const flag = created[0]!.flags.adnd2e.psionicContest;
    expect(flag.outcome.steps.map((s: any) => s.made)).toEqual([true, false]);
    expect(renderContexts[0]!.steps[1].notMade).toBe(true);
    expect(renderContexts[0]!.tangentText).toBe("ADND2E.sheet.psionics.combat.fullContact");
  });

  it("an undefended Monster NPC target (no psionics block) is attacked as undefended", async () => {
    const { a } = attacker();
    const like = { name: "Ogre", uuid: "Actor.ogre", actor: { uuid: "Actor.ogre", name: "Ogre", items: [], system: {} } as never };
    await attackMode(a, "ew", { roll: queue(5, 5), targets: () => [like], hasOnlineOwner: () => true, userId: "u-att" });
    // Ego Whip Wis 17 - 3
    expect(created[0]!.flags.adnd2e.psionicContest.steps).toEqual([{ roll: 5, score: 14 }, { roll: 5, score: 14 }]);
    expect(created[0]!.flags.adnd2e.psionicContest.paid).toBe(4);
  });

  it("a non-psionicist target with an activeDefense id is undefended", async () => {
    const { a } = attacker();
    const t = target({ defense: ts, level: 0 });
    await attackMode(a, "mt", { roll: queue(5, 5), targets: () => [t.like], hasOnlineOwner: () => true, userId: "u-att" });
    expect(created[0]!.flags.adnd2e.psionicContest.defense).toBeNull();
  });

  it("a stale activeDefense id (item gone or not a defense) is undefended", async () => {
    const { a } = attacker();
    const t = target({ defense: ts });
    t.actor.system.psionics.activeDefense = "missing";
    await attackMode(a, "mt", { roll: queue(5, 5), targets: () => [t.like], hasOnlineOwner: () => true, userId: "u-att" });
    expect(created[0]!.flags.adnd2e.psionicContest.defense).toBeNull();
    created.length = 0;
    const notDefense = target({ defense: { ...ts, system: { ...ts.system, kind: "devotion" } } });
    await attackMode(a, "mt", { roll: queue(5, 5), targets: () => [notDefense.like], hasOnlineOwner: () => true, userId: "u-att" });
    expect(created[0]!.flags.adnd2e.psionicContest.defense).toBeNull();
  });
});

describe("attackMode - the pending path", () => {
  // Thought Shield, target Wis 14: defense score 14 - 3 = 11. Mind Thrust vs TS = -2 -> attack score 13.
  it("posts a pending card, pays now and writes no contacts when a defense roll is needed and an owner is online", async () => {
    const { a, updates } = attacker();
    const t = target({ defense: ts, wis: 14 });
    await attackMode(a, "mt", { roll: queue(10, 12), targets: () => [t.like], hasOnlineOwner: (x) => x === (t.actor as never), userId: "u-att" });
    expect(updates).toEqual([{ "system.psionics.psp": 18 }]);
    expect(t.writes).toEqual([]);
    const flag = created[0]!.flags.adnd2e.psionicContest;
    expect(flag).toMatchObject({ state: "pending", paid: 2, remaining: 18, modifier: -2, defense: { name: "Thought Shield", score: 11 }, attackerActorUuid: "Actor.att", attackerName: "Tam" });
    expect(flag.steps).toEqual([{ roll: 10, score: 13 }, { roll: 12, score: 13 }]);
    expect(flag.outcome).toBeUndefined();
    expect(renderContexts[0]).toMatchObject({ pending: true, showRoll: true, showRecord: false, modifierText: "-2" });
  });

  it("pays half when neither attack check succeeds", async () => {
    const { a, updates } = attacker();
    const t = target({ defense: ts, wis: 14 });
    // both attack rolls 14+ fail against 13; no defense roll is needed so this is immediate regardless of the online owner
    await attackMode(a, "mt", { roll: queue(14, 20), targets: () => [t.like], hasOnlineOwner: () => true, userId: "u-att" });
    expect(updates).toEqual([{ "system.psionics.psp": 19 }]);
    expect(created[0]!.flags.adnd2e.psionicContest.state).toBe("resolved");
  });

  it("is immediate when the owner is offline even though a defense roll is needed (the attacker rolls the defense)", async () => {
    const { a, updates } = attacker();
    const t = target({ defense: ts, wis: 14 });
    await attackMode(a, "mt", { roll: queue(10, 12, 4), targets: () => [t.like], hasOnlineOwner: () => false, userId: "u-att" });
    expect(created[0]!.flags.adnd2e.psionicContest.state).toBe("resolved");
    expect(updates[0]).toHaveProperty(["system.psionics.contacts"]);
  });

  it("is immediate when no defense roll is needed even with an owner online (defense score 5 is beaten outright)", async () => {
    const { a, updates } = attacker();
    const t = target({ defense: ts, wis: 8 });
    await attackMode(a, "mt", { roll: queue(10, 12), targets: () => [t.like], hasOnlineOwner: () => true, userId: "u-att" });
    const flag = created[0]!.flags.adnd2e.psionicContest;
    expect(flag.state).toBe("resolved");
    expect(flag.defense.score).toBe(5);
    expect(updates).toEqual([{ "system.psionics.psp": 18, "system.psionics.contacts": [{ target: "Actor.tgt", name: "Orc", tangents: 2 }] }]);
  });

  it("is immediate when the first success already makes full contact (the second attack needs no roll)", async () => {
    const { a } = attacker({ contacts: [{ target: "Actor.tgt", name: "Orc", tangents: 2 }] });
    const t = target({ defense: ts, wis: 8 });
    await attackMode(a, "mt", { roll: queue(10, 11), targets: () => [t.like], hasOnlineOwner: () => true, userId: "u-att" });
    expect(created[0]!.flags.adnd2e.psionicContest.state).toBe("resolved");
  });

  it("with the starting full contact the attack is refused before rolling (info toast, no write, no card)", async () => {
    const { a, updates } = attacker({ contacts: [{ target: "Actor.tgt", name: "Orc", tangents: 3 }] });
    const t = target({ defense: ts, wis: 14 });
    let rolled = 0;
    await attackMode(a, "mt", { roll: async () => (rolled++, 10), targets: () => [t.like], hasOnlineOwner: () => true, userId: "u-att" });
    expect(updates).toEqual([]);
    expect(created).toEqual([]);
    expect(rolled).toBe(0);
    expect(info).toHaveBeenCalledWith("ADND2E.sheet.psionics.combat.alreadyFullContact:{}");
  });

  it("pending with the starting full contact and a defense never happens; pending cost with one failure and one success is full", async () => {
    const { a, updates } = attacker();
    const t = target({ defense: ts, wis: 14 });
    await attackMode(a, "mt", { roll: queue(10, 19), targets: () => [t.like], hasOnlineOwner: () => true, userId: "u-att" });
    expect(updates).toEqual([{ "system.psionics.psp": 18 }]);
    expect(created[0]!.flags.adnd2e.psionicContest.state).toBe("pending");
  });

  it("an owner that is online but a first attack that auto-wins then needs no roll on the second: dry run follows tangents", async () => {
    // starting 2 tangents, defense 11, attack 12 beats it outright (full contact), 2nd attack not made -> immediate
    const { a } = attacker({ contacts: [{ target: "Actor.tgt", name: "Orc", tangents: 2 }] });
    const t = target({ defense: ts, wis: 14 });
    await attackMode(a, "mt", { roll: queue(12, 5), targets: () => [t.like], hasOnlineOwner: () => true, userId: "u-att" });
    expect(created[0]!.flags.adnd2e.psionicContest.state).toBe("resolved");
  });
});

describe("attackMode - switching targets breaks the old partial tangents (p.27)", () => {
  const held = [{ target: "Actor.b", name: "Bo", tangents: 2 }, { target: "Actor.d", name: "Di", tangents: 3 }];
  it("immediate path: both attacks fail on a new target -> B's partial tangents go in the same write as the PSP", async () => {
    const { a, updates } = attacker({ contacts: held });
    await attackMode(a, "mt", { roll: queue(19, 20), targets: () => [target().like], hasOnlineOwner: () => false, userId: "u-att" });
    expect(updates).toEqual([{ "system.psionics.psp": 19, "system.psionics.contacts": [{ target: "Actor.d", name: "Di", tangents: 3 }] }]);
  });
  it("pending path: the old partials are broken at attack time", async () => {
    const { a, updates } = attacker({ contacts: held });
    const t = target({ defense: ts, wis: 14 });
    await attackMode(a, "mt", { roll: queue(10, 12), targets: () => [t.like], hasOnlineOwner: () => true, userId: "u-att" });
    expect(created[0]!.flags.adnd2e.psionicContest.state).toBe("pending");
    expect(updates).toEqual([{ "system.psionics.psp": 18, "system.psionics.contacts": [{ target: "Actor.d", name: "Di", tangents: 3 }] }]);
  });
  it("the same target keeps its tangents (no contacts write when both attacks fail)", async () => {
    const { a, updates } = attacker({ contacts: [{ target: "Actor.tgt", name: "Orc", tangents: 2 }, held[1]!] });
    await attackMode(a, "mt", { roll: queue(19, 20), targets: () => [target().like], hasOnlineOwner: () => false, userId: "u-att" });
    expect(updates).toEqual([{ "system.psionics.psp": 19 }]);
  });
  it("a later applyContestTangents still records tangents on the attacked target", async () => {
    const writes: Record<string, unknown>[] = [];
    uuidMap["Actor.att"] = { isOwner: true, getFlag: () => [], update: async (d: Record<string, unknown>) => void writes.push(d), system: { psionics: { contacts: [{ target: "Actor.d", name: "Di", tangents: 3 }] } } };
    expect(await applyContestTangents({ id: "sw1", attackerActorUuid: "Actor.att", targetActorUuid: "Actor.tgt", targetName: "Orc", outcome: { tangentsGained: 1, steps: [], fullContact: false, anySuccess: true } } as never)).toBe(true);
    expect(writes[0]!["system.psionics.contacts"]).toEqual([{ target: "Actor.d", name: "Di", tangents: 3 }, { target: "Actor.tgt", name: "Orc", tangents: 1 }]);
  });
});

describe("attackMode - refusals leave no writes and no cards", () => {
  const deps = (t: unknown[]) => ({ roll: queue(5, 5), targets: () => t as never, hasOnlineOwner: () => true, userId: "u-att" });
  it("no target", async () => {
    const { a, updates } = attacker();
    await attackMode(a, "mt", deps([]));
    expect(updates).toEqual([]);
    expect(created).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.combat.noTarget");
  });
  it("a target whose token has no actor", async () => {
    const { a } = attacker();
    await attackMode(a, "mt", deps([{ name: "x", uuid: "u", actor: null }]));
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.combat.noTarget");
  });
  it("not an attack mode, an unowned power, or a non-psionicist", async () => {
    const { a, updates } = attacker();
    await attackMode(a, "ts", deps([target().like]));
    await attackMode(a, "nope", deps([target().like]));
    const np = attacker({ level: 0 });
    await attackMode(np.a, "mt", deps([target().like]));
    expect(updates).toEqual([]);
    expect(np.updates).toEqual([]);
    expect(created).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.noClass");
  });
  it("not enough PSPs", async () => {
    const { a, updates } = attacker({ psp: 1 });
    await attackMode(a, "mt", deps([target().like]));
    expect(updates).toEqual([]);
    expect(created).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.notEnoughPsp");
  });
  it("the target is the attacker (same actor or same uuid)", async () => {
    const { a, updates } = attacker();
    await attackMode(a, "mt", deps([{ name: "Tam", uuid: "Actor.att", actor: a as never }]));
    await attackMode(a, "mt", deps([{ name: "Tam", uuid: "Actor.att", actor: {} as never }]));
    expect(updates).toEqual([]);
    expect(created).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.combat.selfTarget");
  });
});

describe("attackMode - default dependencies", () => {
  it("reads the first targeted token, the online non-GM owners, the d20 roller and the user id", async () => {
    const { a } = attacker();
    const t = target({ defense: ts, wis: 14 });
    (t.actor as Record<string, unknown>).testUserPermission = (u: { id: string }) => u.id === "p1";
    const g = (globalThis as Record<string, any>).game;
    g.user = { id: "u-att", targets: new Set([{ name: "Orc", actor: t.actor }, { name: "Other", actor: null }]) };
    g.users = [{ id: "gm", isGM: true, active: true }, { id: "p1", isGM: false, active: true }];
    let n = 0;
    (globalThis as Record<string, unknown>).Roll = class { dice = [{ total: [10, 12][n++ % 2] }]; total = 0; async evaluate() { return this; } };
    await attackMode(a, "mt");
    const flag = created[0]!.flags.adnd2e.psionicContest;
    expect(flag.state).toBe("pending");
    expect(flag.attackerUserId).toBe("u-att");
    expect(flag.steps.map((s: any) => s.roll)).toEqual([10, 12]);
  });
  it("falls back to the roll total, and an offline or GM-only owner set means the attacker rolls the defense", async () => {
    const { a } = attacker();
    const t = target({ defense: ts, wis: 14 });
    const g = (globalThis as Record<string, any>).game;
    g.user = { id: "u-att", targets: new Set([{ name: "Orc", actor: t.actor }]) };
    g.users = [{ id: "p1", isGM: false, active: false }];
    (t.actor as Record<string, unknown>).testUserPermission = () => true;
    (globalThis as Record<string, unknown>).Roll = class { dice: unknown[] = []; total = 5; async evaluate() { return this; } };
    await attackMode(a, "mt");
    expect(created[0]!.flags.adnd2e.psionicContest.state).toBe("resolved");
    // no testUserPermission at all: nobody owns it
    created.length = 0;
    delete (t.actor as Record<string, unknown>).testUserPermission;
    g.users = [{ id: "p1", isGM: false, active: true }];
    await attackMode(a, "mt");
    expect(created[0]!.flags.adnd2e.psionicContest.state).toBe("resolved");
  });
});

describe("rollDefense", () => {
  function pendingMessage(id = "m1", contestId = "cid9") {
    const contest = {
      id: contestId, attackerActorUuid: "Actor.att", attackerUserId: "u-att", attackerName: "Tam", attackerImg: "t.png",
      targetActorUuid: "Actor.tgt", targetName: "Orc", powerName: "Mind Thrust",
      defense: { name: "Thought Shield", score: 11 }, modifier: -2,
      steps: [{ roll: 10, score: 13 }, { roll: 12, score: 13 }], startingTangents: 0,
      state: "pending", paid: 2, remaining: 18, max: 40,
    };
    const msg = { id, getFlag: (_s: string, k: string) => (k === "psionicContest" ? contest : undefined) };
    messages.push(msg as never);
    return contest;
  }
  const defender = (isOwner: boolean) => {
    uuidMap["Actor.tgt"] = { name: "Orc", isOwner };
  };

  it("lets the target's owner roll: one d20 for the contested attack, the other beats the defense score outright", async () => {
    pendingMessage();
    defender(true);
    // attack 10 vs defense roll 10: a tie goes to the defender; attack 12 > defense score 11 wins outright
    await rollDefense("m1", { roll: queue(10) });
    expect(created).toHaveLength(1);
    const flag = created[0]!.flags.adnd2e.psionicContest;
    expect(flag).toMatchObject({ id: "cid9", state: "resolved", applied: false, attackerUserId: "u-att" });
    expect(flag.outcome.tangentsGained).toBe(1);
    expect(flag.outcome.steps.map((s: any) => [s.defenseRoll, s.result.winner, s.result.reason])).toEqual([[10, "defender", "tie"], [null, "attacker", "automatic"]]);
    expect(created[0]!.speaker).toEqual({ alias: "Orc" });
    expect(renderContexts[0]).toMatchObject({ pending: false, showRecord: true, showRoll: false, paid: 2, remaining: 18 });
  });

  it("a GM may roll for an actor they do not own, falling back to the target name as the speaker", async () => {
    pendingMessage();
    isGM = true;
    await rollDefense("m1", { roll: queue(4) });
    expect(created[0]!.speaker).toEqual({ alias: "Orc" });
    expect(created[0]!.flags.adnd2e.psionicContest.outcome.tangentsGained).toBe(2);
  });

  it("refuses a non-owner non-GM", async () => {
    pendingMessage();
    defender(false);
    await rollDefense("m1", { roll: queue(4) });
    expect(created).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.chat.psionicContest.notYourDefense");
  });

  it("refuses a missing target actor for a non-GM", async () => {
    pendingMessage();
    await rollDefense("m1");
    expect(created).toEqual([]);
  });

  it("refuses a second answer (a resolved card with the same contest id already exists)", async () => {
    pendingMessage();
    defender(true);
    const answered = { id: "m2", getFlag: () => ({ id: "cid9", state: "resolved" }) };
    messages.push(answered as never);
    await rollDefense("m1", { roll: queue(4) });
    expect(created).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.chat.psionicContest.alreadyAnswered");
  });

  it("ignores a message that is missing, not a contest, already resolved or has no defense", async () => {
    await rollDefense("nope");
    messages.push({ id: "plain", getFlag: () => undefined } as never);
    await rollDefense("plain");
    const done = pendingMessage("done");
    done.state = "resolved";
    await rollDefense("done");
    const undefended = pendingMessage("und");
    (undefended as Record<string, unknown>).defense = null;
    await rollDefense("und");
    expect(created).toEqual([]);
  });

  it("two concurrent calls on one pending message post exactly one resolved card", async () => {
    pendingMessage();
    defender(true);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow = async () => (await gate, 4);
    const first = rollDefense("m1", { roll: slow });
    const second = rollDefense("m1", { roll: slow });
    release();
    await Promise.all([first, second]);
    expect(created).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith("ADND2E.chat.psionicContest.alreadyAnswered");
    // the in-flight guard is released afterwards (a failed roll can be retried)
    await rollDefense("m1", { roll: async () => { throw new Error("boom"); } }).catch(() => undefined);
    expect(created).toHaveLength(1);
    await rollDefense("m1", { roll: queue(4) });
    expect(created).toHaveLength(2);
  });

  it("rolls with the default d20 roller", async () => {
    pendingMessage();
    defender(true);
    (globalThis as Record<string, unknown>).Roll = class { dice = [{ total: 3 }]; total = 0; async evaluate() { return this; } };
    await rollDefense("m1");
    expect(created[0]!.flags.adnd2e.psionicContest.outcome.steps[0].defenseRoll).toBe(3);
  });
});

describe("applyContestTangents", () => {
  const resolved = (gained: number) => ({
    id: "cid5", attackerActorUuid: "Actor.att", targetActorUuid: "Actor.tgt", targetName: "Orc",
    outcome: { tangentsGained: gained, steps: [], fullContact: false, anySuccess: true },
  }) as never;
  const owned = (flagIds: string[] = [], contacts: unknown[] = []) => {
    const updates: Record<string, unknown>[] = [];
    uuidMap["Actor.att"] = { isOwner: true, getFlag: () => flagIds, update: async (d: Record<string, unknown>) => void updates.push(d), system: { psionics: { contacts } } };
    return updates;
  };

  it("records the tangents and the contest id in one update", async () => {
    const updates = owned(["old"], [{ target: "Actor.other", name: "Gnoll", tangents: 1 }]);
    expect(await applyContestTangents(resolved(2))).toBe(true);
    expect(updates).toEqual([{ "system.psionics.contacts": [{ target: "Actor.tgt", name: "Orc", tangents: 2 }], "flags.adnd2e.psionicApplied": ["old", "cid5"] }]);
  });
  it("is idempotent by contest id", async () => {
    const updates = owned(["cid5"]);
    expect(await applyContestTangents(resolved(2))).toBe(false);
    expect(updates).toEqual([]);
  });
  it("keeps only the last 50 ids", async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `i${i}`);
    const updates = owned(ids);
    await applyContestTangents(resolved(1));
    const list = (updates[0] as Record<string, string[]>)["flags.adnd2e.psionicApplied"]!;
    expect(list).toHaveLength(50);
    expect(list[0]).toBe("i1");
    expect(list[49]).toBe("cid5");
  });
  it("treats a missing flag as an empty list", async () => {
    const updates: Record<string, unknown>[] = [];
    uuidMap["Actor.att"] = { isOwner: true, getFlag: () => undefined, update: async (d: Record<string, unknown>) => void updates.push(d), system: { psionics: { contacts: [] } } };
    expect(await applyContestTangents(resolved(1))).toBe(true);
    expect((updates[0] as Record<string, unknown>)["flags.adnd2e.psionicApplied"]).toEqual(["cid5"]);
  });
  it("serializes concurrent calls: the same contest id applies once; two ids both record (no lost update)", async () => {
    const state = { contacts: [] as unknown[], applied: [] as string[], writes: 0 };
    uuidMap["Actor.att"] = {
      isOwner: true,
      getFlag: () => state.applied,
      system: { get psionics() { return { contacts: state.contacts }; } },
      update: async (d: Record<string, unknown>) => {
        await Promise.resolve();
        state.writes++;
        state.contacts = d["system.psionics.contacts"] as unknown[];
        state.applied = d["flags.adnd2e.psionicApplied"] as string[];
      },
    };
    const same = await Promise.all([applyContestTangents(resolved(1)), applyContestTangents(resolved(1))]);
    expect(same).toEqual([true, false]);
    expect(state.writes).toBe(1);
    const other = { ...(resolved(1) as object), id: "cid6" } as never;
    const both = await Promise.all([applyContestTangents(other), applyContestTangents({ ...(resolved(1) as object), id: "cid7" } as never)]);
    expect(both).toEqual([true, true]);
    expect(state.contacts).toEqual([{ target: "Actor.tgt", name: "Orc", tangents: 3 }]);
    expect(state.applied).toEqual(["cid5", "cid6", "cid7"]);
  });
  it("a rejected write does not poison the next call for the same actor", async () => {
    let calls = 0;
    const updates: unknown[] = [];
    uuidMap["Actor.att"] = { isOwner: true, getFlag: () => [], system: { psionics: { contacts: [] } }, update: async (d: unknown) => { if (calls++ === 0) throw new Error("nope"); updates.push(d); } };
    const bad = applyContestTangents(resolved(1));
    const good = applyContestTangents({ ...(resolved(1) as object), id: "cid8" } as never);
    await expect(bad).rejects.toThrow("nope");
    expect(await good).toBe(true);
    expect(updates).toHaveLength(1);
  });
  it("does nothing for no tangents gained, a missing actor, a non-owner, or no outcome", async () => {
    owned();
    expect(await applyContestTangents(resolved(0))).toBe(false);
    expect(await applyContestTangents({ id: "x" } as never)).toBe(false);
    uuidMap = {};
    expect(await applyContestTangents(resolved(1))).toBe(false);
    uuidMap["Actor.att"] = { isOwner: false };
    expect(await applyContestTangents(resolved(1))).toBe(false);
  });
});

describe("recordButtonState", () => {
  const c = (over: Record<string, unknown> = {}) => ({ id: "cid", state: "resolved", applied: false, outcome: { tangentsGained: 2 }, ...over }) as never;
  it("shows the button only when eligible", () => {
    expect(recordButtonState(c(), [], true)).toBe("button");
  });
  it("shows recorded to everyone when the id is already applied or the card is flagged applied", () => {
    expect(recordButtonState(c(), ["cid"], true)).toBe("recorded");
    expect(recordButtonState(c(), ["cid"], false)).toBe("recorded");
    expect(recordButtonState(c({ applied: true }), [], true)).toBe("recorded");
    expect(recordButtonState(c({ applied: true }), [], false)).toBe("recorded");
  });
  it("shows nothing to a non-owner/non-GM when not yet recorded", () => {
    expect(recordButtonState(c(), [], false)).toBe("none");
  });
  it("shows nothing when no tangents were gained or the contest is pending", () => {
    expect(recordButtonState(c({ outcome: { tangentsGained: 0 } }), [], true)).toBe("none");
    expect(recordButtonState(c({ outcome: undefined }), [], true)).toBe("none");
    expect(recordButtonState(c({ state: "pending" }), [], true)).toBe("none");
  });
});
