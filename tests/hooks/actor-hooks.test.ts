import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerActorHooks } from "../../src/hooks/actor-hooks";

type Handler = (actor: unknown, data: unknown) => void;
let handler: Handler;
let changes: Record<string, unknown>[];
const actor = (type: string) => ({ type, updateSource: (c: Record<string, unknown>) => void changes.push(c) });

beforeEach(() => {
  changes = [];
  (globalThis as Record<string, unknown>).Hooks = {
    on: vi.fn((name: string, fn: Handler) => {
      if (name === "preCreateActor") handler = fn;
    }),
  };
  registerActorHooks();
});

describe("preCreateActor link default", () => {
  it("links a new character", () => {
    handler(actor("character"), { name: "Bob" });
    expect(changes).toEqual([{ "prototypeToken.actorLink": true }]);
  });
  it("tolerates null creation data", () => {
    handler(actor("character"), null);
    expect(changes).toHaveLength(1);
  });
  it("respects an explicit value", () => {
    handler(actor("character"), { prototypeToken: { actorLink: false } });
    expect(changes).toEqual([]);
  });
  it("leaves npc and creature unlinked", () => {
    handler(actor("npc"), {});
    handler(actor("creature"), {});
    expect(changes).toEqual([]);
  });
});
