/* eslint-disable @typescript-eslint/no-explicit-any -- chat-card flags and views are inspected loosely */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyDire, resetWildTest, testWildTalent, highestClassLevel, type ApplyDeps, type PackPower, type WildActor, type WildFlag } from "../../../src/sheets/character/psionic-wild";
import { derivePsionics } from "../../../src/data/derive/character/psionics";
import allRoundVision from "../../../packs/powers/_source/all-round-vision.json";
import combatMind from "../../../packs/powers/_source/combat-mind.json";
import contact from "../../../packs/powers/_source/contact.json";
import dangerSense from "../../../packs/powers/_source/danger-sense.json";
import feelLight from "../../../packs/powers/_source/feel-light.json";
import mindlink from "../../../packs/powers/_source/mindlink.json";

const PACK = [allRoundVision, combatMind, contact, dangerSense, feelLight, mindlink] as unknown as PackPower[];

let warn: ReturnType<typeof vi.fn>;
let info: ReturnType<typeof vi.fn>;
let messages: { content: string; flags: any }[];
let counter = 0;

beforeEach(() => {
  warn = vi.fn();
  info = vi.fn();
  messages = [];
  counter = 0;
  const g = globalThis as Record<string, unknown>;
  g.game = { i18n: { localize: (k: string) => k, format: (k: string, d: Record<string, string>) => `${k}:${JSON.stringify(d)}` }, user: { isGM: false } };
  g.ui = { notifications: { warn, info } };
  g.foundry = {
    utils: { randomID: () => `id${++counter}` },
    applications: { handlebars: { renderTemplate: async (_p: string, ctx: unknown) => JSON.stringify(ctx) } },
  };
  g.ChatMessage = { getSpeaker: () => ({}), create: async (m: { content: string; flags: unknown }) => void messages.push(m as never) };
});

const seq = (...n: number[]) => {
  const q = [...n];
  return async () => q.shift() ?? 50;
};
const view = (i = 0) => JSON.parse(messages[i]!.content) as Record<string, any>;
const flagOf = (i = 0): WildFlag => messages[i]!.flags.adnd2e.wildTalent;

function makeActor(o: { items?: any[]; scores?: { wis: number; int: number; con: number }; psionics?: { level: number; wild?: boolean }; wildTalent?: Partial<WildActor["system"]["wildTalent"]>; owner?: boolean; baseWis?: number } = {}) {
  const updates: Record<string, unknown>[] = [];
  const created: Record<string, unknown>[][] = [];
  const store: { applied: string[] } = { applied: [] };
  const s = o.scores ?? { wis: 17, int: 9, con: 16 };
  const actor: WildActor = {
    uuid: "Actor.pc", name: "Brun", img: "b.png",
    items: o.items ?? [{ id: "c1", name: "Cleric", type: "class", system: { chassisId: "cleric", level: 3 } }, { id: "r1", name: "Dwarf", type: "race", system: { raceId: "dwarf" } }],
    system: {
      abilities: { wis: { score: s.wis }, int: { score: s.int }, con: { score: s.con } },
      psionics: o.psionics ?? { level: 0, wild: false },
      wildTalent: { tested: false, found: false, levelAtDiscovery: 0, ...o.wildTalent },
    },
    _source: { system: { abilities: { wis: { score: o.baseWis ?? s.wis }, int: { score: s.int }, con: { score: s.con } } } },
    isOwner: o.owner ?? true,
    getFlag: () => store.applied,
    update: async (d) => {
      updates.push(d);
      const f = d["flags.adnd2e.wildApplied"] as string[] | undefined;
      if (f) store.applied = f;
    },
    createEmbeddedDocuments: async (_t, docs) => void created.push(docs),
  };
  return { actor, updates, created, store };
}

const baseDeps = (over: Record<string, unknown> = {}) => ({
  settingOn: () => true,
  readPack: async () => PACK,
  rollSave: vi.fn(async () => true),
  rollD6: vi.fn(async () => 4),
  chooseDialog: vi.fn(async (o: { name: string }[]) => o[0]!.name),
  ...over,
});

const wildPsp = (docs: Record<string, unknown>[]) =>
  derivePsionics({
    classes: [{ chassisId: "cleric", level: 3 }], scores: { wis: 17, int: 9, con: 16 },
    wild: { found: true, levelAtDiscovery: 3, powers: docs.map((d) => ({ initialCost: (d.system as any).initialCost, maintenanceCost: (d.system as any).maintenanceCost })) },
  });

describe("testWildTalent: the chance and the talent test", () => {
  it("the book example, a dwarf cleric (Wis 17 Int 9 Con 16, level 3): chance 2; a roll of 2 finds a talent", async () => {
    const { actor, updates } = makeActor();
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(2, 3) }));
    const v = view();
    expect(v.chance).toBe(2);
    expect(v.parts).toEqual({ wis: 2, con: 1, int: 0, level: 0 });
    expect(v.total).toBe(4);
    expect(v.halved).toBe(true);
    expect(v.talent).toBe(true);
    expect(updates).toEqual([{ "system.wildTalent.tested": true, "system.wildTalent.found": true, "system.wildTalent.levelAtDiscovery": 3 }]);
  });
  it("a roll of 3 does not find one", async () => {
    const { actor, updates, created } = makeActor();
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(3) }));
    expect(view().talent).toBe(false);
    expect(updates).toEqual([{ "system.wildTalent.tested": true, "system.wildTalent.found": false }]);
    expect(created).toEqual([]);
    expect(info).toHaveBeenCalledWith("ADND2E.sheet.wildTalent.notFoundToast:{}");
  });
  it("a roll of 3 with a psychic surgeon (-2) finds one", async () => {
    const { actor } = makeActor();
    await testWildTalent(actor, { surgeon: true }, baseDeps({ roll100: seq(3, 3) }));
    expect(view().talent).toBe(true);
    expect(view().surgeon).toBe(true);
    expect(view().effectiveRoll).toBe(1);
  });
  it("a human fighter with no race item is not halved: chance 4", async () => {
    const { actor } = makeActor({ items: [{ id: "c1", name: "Fighter", type: "class", system: { chassisId: "fighter", level: 3 } }] });
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(4, 3) }));
    expect(view().chance).toBe(4);
    expect(view().halved).toBe(false);
    expect(view().talent).toBe(true);
  });
  it("the highest class level counts (a dual-class actor)", () => {
    const { actor } = makeActor({ items: [{ id: "a", name: "A", type: "class", system: { chassisId: "fighter", level: 2 } }, { id: "b", name: "B", type: "class", system: { chassisId: "mage", level: 5 } }] });
    expect(highestClassLevel(actor)).toBe(5);
    expect(highestClassLevel(makeActor({ items: [] }).actor)).toBe(0);
  });
});

describe("testWildTalent: granting powers", () => {
  it("Table 12 roll 3 grants Danger Sense; levelAtDiscovery and the PSP maximum follow (4 + 4x3 = 16)", async () => {
    const { actor, created } = makeActor();
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(2, 3) }));
    expect(created).toHaveLength(1);
    expect(created[0]!.map((d) => d.name)).toEqual(["Danger Sense"]);
    expect(created[0]![0]).not.toHaveProperty("_id");
    expect(view().powers).toEqual(["Danger Sense"]);
    expect(info).toHaveBeenCalledWith('ADND2E.sheet.wildTalent.foundToast:{"n":1}');
    const derived = wildPsp(created[0]!);
    expect(derived?.max).toBe(16);
    expect(derived?.wild).toBe(true);
  });
  it("Table 12 roll 91-99 then Table 13 roll 63 grants Mindlink plus its prerequisite Contact (32 + 4 = 36 PSP)", async () => {
    const { actor, created } = makeActor();
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(1, 95, 63) }));
    expect(created[0]!.map((d) => d.name)).toEqual(["Mindlink", "Contact"]);
    expect(wildPsp(created[0]!)?.max).toBe(36);
  });
  it("a held prerequisite is not granted twice", async () => {
    const { actor, created } = makeActor({ items: [{ id: "p1", name: "Contact", type: "power", system: {} }, { id: "c1", name: "Cleric", type: "class", system: { chassisId: "cleric", level: 3 } }] });
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(1, 95, 63) }));
    expect(created[0]!.map((d) => d.name)).toEqual(["Mindlink"]);
  });
  it("'roll two times' grants two distinct powers in ONE create call and one update", async () => {
    const { actor, created, updates } = makeActor();
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(1, 86, 1, 2) }));
    expect(created).toHaveLength(1);
    expect(created[0]!.map((d) => d.name)).toEqual(["All-Round Vision", "Combat Mind"]);
    expect(updates).toHaveLength(1);
  });
  it("a duplicate roll is skipped", async () => {
    const { actor, created } = makeActor();
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(1, 86, 3, 3) }));
    expect(created[0]!.map((d) => d.name)).toEqual(["Danger Sense"]);
  });
  it("a power already held is skipped: nothing is created, the talent is still found", async () => {
    const { actor, created, updates } = makeActor({ items: [{ id: "p1", name: "Danger Sense", type: "power", system: {} }, { id: "c1", name: "Cleric", type: "class", system: { chassisId: "cleric", level: 3 } }] });
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(2, 3) }));
    expect(created).toEqual([]);
    expect(updates).toHaveLength(1);
    expect(view().noPowers).toBe(true);
  });
  it("a 'choose' result lists the eligible powers (not held) and grants the pick", async () => {
    const { actor, created } = makeActor({ items: [{ id: "p1", name: "Feel Light", type: "power", system: {} }, { id: "c1", name: "Cleric", type: "class", system: { chassisId: "cleric", level: 3 } }] });
    const chooseDialog = vi.fn(async () => "Combat Mind");
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(2, 13), chooseDialog }));
    expect(chooseDialog).toHaveBeenCalledWith([
      { name: "All-Round Vision", discipline: "clairsentience", kind: "devotion" },
      { name: "Combat Mind", discipline: "clairsentience", kind: "devotion" },
      { name: "Danger Sense", discipline: "clairsentience", kind: "devotion" },
    ]);
    expect(created[0]!.map((d) => d.name)).toEqual(["Combat Mind"]);
  });
  it("cancelling the choose dialog (or a pick that was not offered) grants nothing", async () => {
    const { actor, created } = makeActor();
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(2, 13), chooseDialog: vi.fn(async () => null) }));
    expect(created).toEqual([]);
    const second = makeActor();
    await testWildTalent(second.actor, { surgeon: false }, baseDeps({ roll100: seq(2, 13), chooseDialog: vi.fn(async () => "Nonexistent") }));
    expect(second.created).toEqual([]);
  });
  it("a choose with nothing eligible does not open the dialog", async () => {
    const { actor, created } = makeActor();
    const chooseDialog = vi.fn(async () => "x");
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(2, 22), chooseDialog }));
    expect(chooseDialog).not.toHaveBeenCalled();
    expect(created).toEqual([]);
  });
  it("'choose any two devotions' (Table 12 roll 90) asks twice, without repeating the first pick", async () => {
    const { actor, created } = makeActor();
    const chooseDialog = vi.fn(async (o: { name: string }[]) => o[0]!.name);
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(2, 90), chooseDialog }));
    expect(chooseDialog).toHaveBeenCalledTimes(2);
    expect(created[0]!.map((d) => d.name)).toEqual(["All-Round Vision", "Combat Mind"]);
  });
  it("Table 12 roll 100: choose a devotion, then roll on Table 13 (Mindlink)", async () => {
    const { actor, created } = makeActor();
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(2, 100, 63), chooseDialog: vi.fn(async () => "Danger Sense") }));
    expect(created[0]!.map((d) => d.name)).toEqual(["Danger Sense", "Mindlink", "Contact"]);
  });
  it("Table 13 'choose any science or devotion' offers both kinds; 'a science and two devotions' asks three times", async () => {
    const one = makeActor();
    const dialog = vi.fn(async (o: { name: string }[]) => o[o.length - 1]!.name);
    await testWildTalent(one.actor, { surgeon: false }, baseDeps({ roll100: seq(2, 95, 89), chooseDialog: dialog }));
    expect((dialog.mock.calls[0] as unknown as [{ name: string }[]])[0].map((o) => o.name)).toContain("Mindlink");
    expect(one.created[0]!.map((d) => d.name)).toEqual(["Mindlink", "Contact"]);
    const many = makeActor();
    const dialog2 = vi.fn(async (o: { name: string }[]) => o[0]!.name);
    await testWildTalent(many.actor, { surgeon: false }, baseDeps({ roll100: seq(2, 95, 93), chooseDialog: dialog2 }));
    expect(dialog2).toHaveBeenCalledTimes(3);
  });
  it("a prerequisite that is not in the pack is skipped", async () => {
    const { actor, created } = makeActor();
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(1, 95, 63), readPack: async () => PACK.filter((p) => p.name !== "Contact") }));
    expect(created[0]!.map((d) => d.name)).toEqual(["Mindlink"]);
  });
  it("a table name missing from the pack grants nothing", async () => {
    const { actor, created } = makeActor();
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(2, 12) }));
    expect(created).toEqual([]);
  });
});

describe("testWildTalent: refusals leave no write and no card", () => {
  const refused = async (actor: WildActor, deps: Record<string, unknown>, key: string, updates: unknown[], created: unknown[]) => {
    await testWildTalent(actor, { surgeon: false }, baseDeps({ roll100: seq(1), ...deps }));
    expect(warn).toHaveBeenCalledWith(key);
    expect(updates).toEqual([]);
    expect(created).toEqual([]);
    expect(messages).toEqual([]);
  };
  it("the setting is off", async () => {
    const { actor, updates, created } = makeActor();
    await refused(actor, { settingOn: () => false }, "ADND2E.sheet.wildTalent.settingOff", updates, created);
  });
  it("an active psionicist", async () => {
    const { actor, updates, created } = makeActor({ psionics: { level: 3, wild: false } });
    await refused(actor, {}, "ADND2E.sheet.wildTalent.psionicist", updates, created);
  });
  it("already tested", async () => {
    const { actor, updates, created } = makeActor({ wildTalent: { tested: true } });
    await refused(actor, {}, "ADND2E.sheet.wildTalent.alreadyTested", updates, created);
  });
  it("a talent already found", async () => {
    const { actor, updates, created } = makeActor({ wildTalent: { found: true }, psionics: { level: 3, wild: true } });
    await refused(actor, {}, "ADND2E.sheet.wildTalent.alreadyFound", updates, created);
  });
});

describe("dire consequences", () => {
  const applyDeps = (actor: WildActor, over: Partial<ApplyDeps> = {}): Partial<ApplyDeps> => ({
    confirm: async () => true,
    userIsGM: () => false,
    getFlag: () => flagOf(),
    getActor: () => actor,
    ...over,
  });
  const failedSave = (roll: number, extra: Record<string, unknown> = {}) => baseDeps({ roll100: seq(roll), rollSave: vi.fn(async () => false), ...extra });

  it("roll 97 (Wisdom), a failed save and a 1d6 of 4 stores 4; Apply lowers the BASE Wisdom 17 -> 13", async () => {
    const { actor, updates } = makeActor();
    const deps = failedSave(97);
    await testWildTalent(actor, { surgeon: false }, deps);
    expect(deps.rollSave).toHaveBeenCalledWith(actor, "ppd", { penalty: 0 });
    expect(flagOf().dire).toEqual({ ability: "wis", points: 4, applied: false });
    expect(view().showApply).toBe(true);
    expect(view().lossPoints).toBe(4);
    expect(updates).toHaveLength(1); // the test's own update; the loss is not applied yet
    expect(await applyDire("m1", applyDeps(actor))).toBe(true);
    expect(updates[1]).toEqual({ "flags.adnd2e.wildApplied": [flagOf().id], "system.abilities.wis.score": 13 });
  });
  it("the loss reads the BASE score, not the prepared one", async () => {
    const { actor, updates } = makeActor({ baseWis: 15 });
    await testWildTalent(actor, { surgeon: false }, failedSave(97));
    await applyDire("m1", applyDeps(actor));
    expect(updates[1]!["system.abilities.wis.score"]).toBe(11);
  });
  it("98 hits Intelligence and 99 hits Constitution", async () => {
    for (const [roll, key] of [[98, "int"], [99, "con"]] as const) {
      messages = [];
      const { actor, updates } = makeActor();
      await testWildTalent(actor, { surgeon: false }, failedSave(roll));
      expect(flagOf(0).dire?.ability).toBe(key);
      await applyDire("m1", applyDeps(actor, { getFlag: () => flagOf(0) }));
      expect(updates[1]![`system.abilities.${key}.score`]).toBe((key === "int" ? 9 : 16) - 4);
    }
  });
  it("never goes below 3", async () => {
    const { actor, updates } = makeActor({ baseWis: 5 });
    await testWildTalent(actor, { surgeon: false }, failedSave(97, { rollD6: vi.fn(async () => 6) }));
    await applyDire("m1", applyDeps(actor));
    expect(updates[1]!["system.abilities.wis.score"]).toBe(3);
  });
  it("roll 100 with a failed save (at -5) sets Wisdom, Intelligence and Constitution to 3", async () => {
    const { actor, updates } = makeActor();
    const deps = failedSave(100);
    await testWildTalent(actor, { surgeon: false }, deps);
    expect(deps.rollSave).toHaveBeenCalledWith(actor, "ppd", { penalty: -5 });
    expect(deps.rollD6).not.toHaveBeenCalled();
    expect(flagOf().dire).toEqual({ ability: "all", points: "all", applied: false });
    await applyDire("m1", applyDeps(actor));
    expect(updates[1]).toEqual({
      "flags.adnd2e.wildApplied": [flagOf().id],
      "system.abilities.wis.score": 3, "system.abilities.int.score": 3, "system.abilities.con.score": 3,
    });
  });
  it("a passed save stores no loss and shows no Apply button", async () => {
    const { actor } = makeActor();
    const deps = baseDeps({ roll100: seq(97), rollSave: vi.fn(async () => true) });
    await testWildTalent(actor, { surgeon: false }, deps);
    expect(flagOf().dire).toBeNull();
    expect(view().showApply).toBe(false);
    expect(view().saved).toBe(true);
    expect(deps.rollD6).not.toHaveBeenCalled();
    expect(await applyDire("m1", applyDeps(actor))).toBe(false);
  });
  it("the dire check uses the rolled number even with a psychic surgeon (97 stays dire)", async () => {
    const { actor } = makeActor();
    await testWildTalent(actor, { surgeon: true }, failedSave(97));
    expect(flagOf().dire?.ability).toBe("wis");
  });
  it("a high-chance character still gets the dire card on 97 (no talent on that roll)", async () => {
    const { actor, created } = makeActor({ scores: { wis: 18, int: 18, con: 18 }, items: [{ id: "c1", name: "Fighter", type: "class", system: { chassisId: "fighter", level: 9 } }] });
    await testWildTalent(actor, { surgeon: false }, failedSave(97));
    expect(view().chance).toBe(12);
    expect(created).toEqual([]);
    expect(flagOf().dire?.points).toBe(4);
  });

  it("Apply is refused for a non-owner non-GM (no write)", async () => {
    const { actor, updates } = makeActor({ owner: false });
    await testWildTalent(actor, { surgeon: false }, failedSave(97));
    expect(await applyDire("m1", applyDeps(actor))).toBe(false);
    expect(warn).toHaveBeenCalledWith("ADND2E.chat.wildTalent.notYours");
    expect(updates).toHaveLength(1);
  });
  it("a GM may apply to someone else's character", async () => {
    const { actor, updates } = makeActor({ owner: false });
    await testWildTalent(actor, { surgeon: false }, failedSave(97));
    expect(await applyDire("m1", applyDeps(actor, { userIsGM: () => true }))).toBe(true);
    expect(updates).toHaveLength(2);
  });
  it("Apply twice applies once", async () => {
    const { actor, updates } = makeActor();
    await testWildTalent(actor, { surgeon: false }, failedSave(97));
    const [a, b] = await Promise.all([applyDire("m1", applyDeps(actor)), applyDire("m1", applyDeps(actor))]);
    expect([a, b]).toEqual([true, false]);
    expect(updates).toHaveLength(2);
    expect(info).toHaveBeenCalledWith("ADND2E.chat.wildTalent.alreadyApplied:{}");
  });
  it("a cancelled confirmation writes nothing", async () => {
    const { actor, updates } = makeActor();
    await testWildTalent(actor, { surgeon: false }, failedSave(97));
    expect(await applyDire("m1", applyDeps(actor, { confirm: async () => false }))).toBe(false);
    expect(updates).toHaveLength(1);
  });
  it("does nothing for an unknown card, a card with no loss, or a missing actor", async () => {
    const { actor, updates } = makeActor();
    await testWildTalent(actor, { surgeon: false }, failedSave(97));
    expect(await applyDire("m1", applyDeps(actor, { getFlag: () => undefined }))).toBe(false);
    expect(await applyDire("m1", applyDeps(actor, { getFlag: () => ({ ...flagOf(), dire: null }) }))).toBe(false);
    expect(await applyDire("m1", applyDeps(actor, { getActor: () => null }))).toBe(false);
    expect(updates).toHaveLength(1);
  });
  it("falls back to the prepared score when the source is unavailable, and to 3 as a last resort", async () => {
    const { actor, updates } = makeActor();
    delete (actor as { _source?: unknown })._source;
    await testWildTalent(actor, { surgeon: false }, failedSave(97));
    await applyDire("m1", applyDeps(actor));
    expect(updates[1]!["system.abilities.wis.score"]).toBe(13);
    messages = [];
    const bare = makeActor();
    delete (bare.actor as { _source?: unknown })._source;
    delete (bare.actor.system.abilities as Record<string, unknown>).wis;
    await testWildTalent(bare.actor, { surgeon: false }, failedSave(97));
    await applyDire("m2", applyDeps(bare.actor, { getFlag: () => flagOf(0) }));
    expect(bare.updates[1]!["system.abilities.wis.score"]).toBe(3);
  });
});

describe("resetWildTest", () => {
  it("a GM re-enables the test and keeps the talent", async () => {
    const { actor, updates } = makeActor({ wildTalent: { tested: true, found: true } });
    await resetWildTest(actor, { userIsGM: () => true });
    expect(updates).toEqual([{ "system.wildTalent.tested": false }]);
    expect(info).toHaveBeenCalledWith("ADND2E.sheet.wildTalent.resetDone:{}");
  });
  it("a player is refused", async () => {
    const { actor, updates } = makeActor({ wildTalent: { tested: true } });
    await resetWildTest(actor, { userIsGM: () => false });
    expect(updates).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.wildTalent.gmOnly");
  });
  it("defaults to the current user's GM flag", async () => {
    const { actor, updates } = makeActor({ wildTalent: { tested: true } });
    await resetWildTest(actor);
    expect(updates).toEqual([]);
    (globalThis as any).game.user.isGM = true;
    await resetWildTest(actor);
    expect(updates).toEqual([{ "system.wildTalent.tested": false }]);
  });
});
