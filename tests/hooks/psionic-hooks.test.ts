import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerPsionicHooks } from "../../src/hooks/psionic-hooks";

type Handler = (message: unknown, changes?: unknown) => void;
let handler: Handler;
let actorHandler: Handler;
let effectHandler: (effect: unknown, options: unknown, userId: string) => void;
let rerendered: unknown[];
let updates: Record<string, unknown>[];
let uuidMap: Record<string, unknown>;

const contest = (over: Record<string, unknown> = {}) => ({
  id: "cid1", attackerActorUuid: "Actor.att", attackerUserId: "u-att", targetActorUuid: "Actor.tgt", targetName: "Orc", state: "resolved", applied: false,
  outcome: { tangentsGained: 2, steps: [], fullContact: false, anySuccess: true },
  ...over,
});
const message = (flag: unknown) => ({ getFlag: (_s: string, k: string) => (k === "psionicContest" ? flag : undefined) });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  updates = [];
  rerendered = [];
  uuidMap = {
    "Actor.att": { isOwner: true, getFlag: () => [], update: async (d: Record<string, unknown>) => void updates.push(d), system: { psionics: { contacts: [] } } },
  };
  (globalThis as Record<string, unknown>).game = { user: { id: "u-att" }, messages: { contents: [message(contest()), message(contest({ attackerActorUuid: "Actor.other" })), message(undefined)] } };
  (globalThis as Record<string, unknown>).ui = { chat: { updateMessage: async (m: unknown) => void rerendered.push(m) } };
  (globalThis as Record<string, unknown>).foundry = { utils: { fromUuidSync: (u: string) => uuidMap[u] ?? null } };
  (globalThis as Record<string, unknown>).Hooks = { on: vi.fn((name: string, fn: Handler) => void (name === "updateActor" ? (actorHandler = fn) : name === "createActiveEffect" ? (effectHandler = fn as never) : (handler = fn))) };
  registerPsionicHooks();
});

describe("issue #122: incapacitation breaks all psychic contacts (p.27)", () => {
  const actorWith = (contacts: unknown[]) => {
    const writes: Record<string, unknown>[] = [];
    return { writes, actor: { documentName: "Actor", name: "Tam", system: { psionics: { contacts } }, update: async (d: Record<string, unknown>) => void writes.push(d) } };
  };
  const info = vi.fn();
  beforeEach(() => {
    info.mockClear();
    (globalThis as Record<string, unknown>).ui = { ...((globalThis as Record<string, unknown>).ui as object), notifications: { info } };
    (globalThis as Record<string, any>).game.i18n = { format: (k: string, d: object) => `${k}:${JSON.stringify(d)}` };
  });
  it("clears every contact (full contacts included) when an incapacitating status is applied by this client", async () => {
    const { writes, actor } = actorWith([{ target: "t", name: "T", tangents: 3 }, { target: "u", name: "U", tangents: 1 }]);
    effectHandler({ statuses: new Set(["unconscious"]), parent: actor }, {}, "u-att");
    await flush();
    expect(writes).toEqual([{ "system.psionics.contacts": [] }]);
    expect(info).toHaveBeenCalledWith('ADND2E.sheet.psionics.combat.incapacitatedBroken:{"name":"Tam"}');
  });
  it("ignores stunned/held, effects with no status, other users' effects, non-actor parents, and actors with no contacts", async () => {
    const { writes, actor } = actorWith([{ target: "t", name: "T", tangents: 1 }]);
    effectHandler({ statuses: new Set(["stunned", "held"]), parent: actor }, {}, "u-att");
    effectHandler({ parent: actor }, {}, "u-att");
    effectHandler({ statuses: new Set(["dead"]), parent: actor }, {}, "someone-else");
    effectHandler({ statuses: new Set(["dead"]), parent: { documentName: "Item" } }, {}, "u-att");
    effectHandler({ statuses: new Set(["dead"]) }, {}, "u-att");
    const empty = actorWith([]);
    effectHandler({ statuses: new Set(["dead"]), parent: empty.actor }, {}, "u-att");
    const noPsionics = { documentName: "Actor", name: "Orc", system: {}, update: async () => undefined };
    effectHandler({ statuses: new Set(["dead"]), parent: noPsionics }, {}, "u-att");
    await flush();
    expect(writes).toEqual([]);
    expect(empty.writes).toEqual([]);
  });
});

describe("registerPsionicHooks", () => {
  it("registers on createChatMessage", () => {
    expect(((globalThis as unknown) as { Hooks: { on: ReturnType<typeof vi.fn> } }).Hooks.on).toHaveBeenCalledWith("createChatMessage", expect.any(Function));
  });

  it("records the tangents on the attacker's own client, once per contest id", async () => {
    handler(message(contest()));
    await flush();
    expect(updates).toEqual([{ "system.psionics.contacts": [{ target: "Actor.tgt", name: "Orc", tangents: 2 }], "flags.adnd2e.psionicApplied": ["cid1"] }]);
    (uuidMap["Actor.att"] as { getFlag: () => string[] }).getFlag = () => ["cid1"];
    handler(message(contest()));
    await flush();
    expect(updates).toHaveLength(1);
  });

  it("does nothing on another user's client", async () => {
    handler(message(contest({ attackerUserId: "someone-else" })));
    await flush();
    expect(updates).toEqual([]);
  });

  it("skips an immediate card (applied), a pending card, a card with no tangents and messages without a contest", async () => {
    handler(message(contest({ applied: true })));
    handler(message(contest({ state: "pending" })));
    handler(message(contest({ outcome: { tangentsGained: 0, steps: [], fullContact: false, anySuccess: false } })));
    handler(message(undefined));
    await flush();
    expect(updates).toEqual([]);
  });

  it("does nothing when the attacker actor is gone or not owned by this user", async () => {
    uuidMap = {};
    handler(message(contest()));
    uuidMap["Actor.att"] = { isOwner: false };
    handler(message(contest()));
    await flush();
    expect(updates).toEqual([]);
  });

  it("re-renders only the matching attacker's contest cards when psionicApplied changes", () => {
    const msgs = (globalThis as unknown as { game: { messages: { contents: unknown[] } } }).game.messages.contents;
    actorHandler({ uuid: "Actor.att" }, { flags: { adnd2e: { psionicApplied: ["cid1"] } } });
    expect(rerendered).toEqual([msgs[0]]);
    actorHandler({ uuid: "Actor.att" }, { "flags.adnd2e.psionicApplied": ["cid1"] });
    expect(rerendered).toEqual([msgs[0], msgs[0]]);
  });

  it("re-renders only the matching actor's wild-talent cards when wildApplied changes", () => {
    const wild = { getFlag: (_s: string, k: string) => (k === "wildTalent" ? { id: "w1", actorUuid: "Actor.att", dire: null } : undefined) };
    const other = { getFlag: (_s: string, k: string) => (k === "wildTalent" ? { id: "w2", actorUuid: "Actor.other", dire: null } : undefined) };
    (globalThis as unknown as { game: { messages: { contents: unknown[] } } }).game.messages.contents = [wild, other];
    actorHandler({ uuid: "Actor.att" }, { flags: { adnd2e: { wildApplied: ["w1"] } } });
    expect(rerendered).toEqual([wild]);
    actorHandler({ uuid: "Actor.att" }, { "flags.adnd2e.wildApplied": ["w1"] });
    expect(rerendered).toEqual([wild, wild]);
  });

  it("ignores unrelated actor updates and survives a missing chat log or message list", () => {
    actorHandler({ uuid: "Actor.att" }, { name: "x" });
    actorHandler({ uuid: "Actor.att" }, { flags: { adnd2e: { other: 1 } } });
    actorHandler({ uuid: "Actor.att" }, { flags: { core: { x: 1 } } });
    expect(rerendered).toEqual([]);
    (globalThis as Record<string, unknown>).ui = {};
    actorHandler({ uuid: "Actor.att" }, { flags: { adnd2e: { psionicApplied: [] } } });
    (globalThis as Record<string, unknown>).game = {};
    actorHandler({ uuid: "Actor.att" }, { flags: { adnd2e: { psionicApplied: [] } } });
    expect(rerendered).toEqual([]);
  });
});
