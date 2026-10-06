import { beforeEach, describe, expect, it, vi } from "vitest";
import { dropDefense, endContactAction, payUpkeep, raiseDefense } from "../../../src/sheets/character/psionic-combat";
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
