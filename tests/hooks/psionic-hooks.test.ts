import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerPsionicHooks } from "../../src/hooks/psionic-hooks";

type Handler = (message: unknown, changes?: unknown) => void;
let handler: Handler;
let actorHandler: Handler;
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
  (globalThis as Record<string, unknown>).Hooks = { on: vi.fn((name: string, fn: Handler) => void (name === "updateActor" ? (actorHandler = fn) : (handler = fn))) };
  registerPsionicHooks();
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
