import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adjustPsp,
  currentPsp,
  endPower,
  knownPowers,
  payMaintenance,
  relearnPower,
  rest,
  usePower,
  type PsionicActor,
} from "../../../src/sheets/character/psionic-actions";

const created: { content: unknown }[] = [];
const rendered: Record<string, unknown>[] = [];
let warn: ReturnType<typeof vi.fn>;
let info: ReturnType<typeof vi.fn>;

beforeEach(() => {
  created.length = 0;
  rendered.length = 0;
  warn = vi.fn();
  info = vi.fn();
  (globalThis as Record<string, unknown>).game = { i18n: { localize: (k: string) => k, format: (k: string, d: Record<string, string>) => `${k}:${JSON.stringify(d)}` } };
  (globalThis as Record<string, unknown>).ui = { notifications: { warn, info } };
  (globalThis as Record<string, unknown>).ChatMessage = {
    getSpeaker: () => ({ alias: "Tam" }),
    create: async (data: { content: unknown }) => created.push(data),
  };
  (globalThis as Record<string, unknown>).foundry = {
    applications: { handlebars: { renderTemplate: async (_p: string, ctx: Record<string, unknown>) => (rendered.push(ctx), "<card/>") } },
  };
});

const power = (id: string, over: Record<string, unknown> = {}) => {
  const updates: Record<string, unknown>[] = [];
  return {
    id, name: `Power ${id}`, type: "power",
    system: {
      discipline: "telepathy", kind: "devotion", abilityKey: "wis", abilityModifier: -4,
      initialCost: 7, maintenanceCost: 0, maintenanceUnit: "none", scoreBonus: 0, ...over,
    },
    update: async (d: Record<string, unknown>) => void updates.push(d),
    updates,
  };
};

function actor(opts: { psp?: number | null; maintained?: string[]; items?: unknown[]; max?: number; level?: number } = {}) {
  const updates: Record<string, unknown>[] = [];
  const a: PsionicActor = {
    name: "Tam", img: "t.png",
    items: (opts.items ?? [power("p1")]) as never,
    system: {
      abilities: { wis: { score: 14 } },
      psionics: { psp: opts.psp === undefined ? 20 : opts.psp, maintained: (opts.maintained ?? []).map((powerId) => ({ powerId })), max: opts.max ?? 40, level: opts.level ?? 3 },
    },
    update: async (d) => void updates.push(d),
  };
  return { a, updates };
}

describe("currentPsp", () => {
  it("is the pool, max when null, and clamped to max", () => {
    expect(currentPsp(actor({ psp: 12 }).a)).toBe(12);
    expect(currentPsp(actor({ psp: null }).a)).toBe(40);
    expect(currentPsp(actor({ psp: 99 }).a)).toBe(40);
  });
});

describe("usePower", () => {
  it("a roll at the score succeeds and pays the full cost", async () => {
    const { a, updates } = actor();
    await usePower(a, "p1", async () => 10);
    expect(updates).toEqual([{ "system.psionics.psp": 13 }]);
    expect(created).toHaveLength(1);
    expect(rendered[0]).toMatchObject({ roll: 10, score: 10, resultKey: "ADND2E.chat.psionic.result.success", special: true, cost: 7, remaining: 13, max: 40, powerName: "Power p1" });
  });
  it("a roll over the score fails and pays half rounded up", async () => {
    const { a, updates } = actor();
    await usePower(a, "p1", async () => 11);
    expect(updates).toEqual([{ "system.psionics.psp": 16 }]);
    expect(rendered[0]).toMatchObject({ resultKey: "ADND2E.chat.psionic.result.failure", cost: 4 });
  });
  it("a 20 is an automatic failure", async () => {
    const { a, updates } = actor();
    await usePower(a, "p1", async () => 20);
    expect(updates).toEqual([{ "system.psionics.psp": 16 }]);
    expect(rendered[0]).toMatchObject({ resultKey: "ADND2E.chat.psionic.result.automatic-failure", cost: 4 });
  });
  it("a 1 against a negative score is a minimum success and pays the full cost", async () => {
    const { a, updates } = actor({ items: [power("p1", { abilityModifier: -20 })] });
    await usePower(a, "p1", async () => 1);
    expect(updates).toEqual([{ "system.psionics.psp": 13 }]);
    expect(rendered[0]).toMatchObject({ score: -6, resultKey: "ADND2E.chat.psionic.result.minimum-success", cost: 7 });
  });
  it("adds the relearn bonus to the score", async () => {
    const { a } = actor({ items: [power("p1", { scoreBonus: 2 })] });
    await usePower(a, "p1", async () => 12);
    expect(rendered[0]).toMatchObject({ score: 12, resultKey: "ADND2E.chat.psionic.result.success" });
  });
  it("is refused (toast, no roll, no write, no card) when the pool is below the full cost", async () => {
    const { a, updates } = actor({ psp: 6 });
    const roll = vi.fn(async () => 5);
    await usePower(a, "p1", roll);
    expect(roll).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    expect(created).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.notEnoughPsp");
  });
  it("uses the full pool exactly at the cost, and a null pool means max", async () => {
    const exact = actor({ psp: 7 });
    await usePower(exact.a, "p1", async () => 5);
    expect(exact.updates).toEqual([{ "system.psionics.psp": 0 }]);
    const full = actor({ psp: null, max: 30 });
    await usePower(full.a, "p1", async () => 5);
    expect(full.updates).toEqual([{ "system.psionics.psp": 23 }]);
  });
  it("a successful maintained power is added to maintained once", async () => {
    const items = [power("p1", { maintenanceCost: 2, maintenanceUnit: "round" })];
    const first = actor({ items });
    await usePower(first.a, "p1", async () => 5);
    expect(first.updates).toEqual([{ "system.psionics.psp": 13, "system.psionics.maintained": [{ powerId: "p1" }] }]);
    const again = actor({ items, maintained: ["p1"] });
    await usePower(again.a, "p1", async () => 5);
    expect(again.updates).toEqual([{ "system.psionics.psp": 13 }]);
  });
  it("a failed maintained power is not added", async () => {
    const { a, updates } = actor({ items: [power("p1", { maintenanceCost: 2, maintenanceUnit: "round" })] });
    await usePower(a, "p1", async () => 15);
    expect(updates).toEqual([{ "system.psionics.psp": 16 }]);
  });
  it("refuses an actor with no psionicist class, and ignores an unknown power", async () => {
    const none = actor({ level: 0 });
    await usePower(none.a, "p1", async () => 5);
    expect(none.updates).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.noClass");
    const { a, updates } = actor();
    await usePower(a, "nope", async () => 5);
    expect(updates).toEqual([]);
    expect(created).toHaveLength(0);
  });
  it("rolls a real d20 by default and treats a missing ability as 0", async () => {
    (globalThis as Record<string, unknown>).Roll = class {
      dice = [{ total: 3 }];
      total = 3;
      async evaluate() { return this; }
    };
    const { a, updates } = actor({ items: [power("p1", { abilityKey: "zzz", abilityModifier: 5 })] });
    await usePower(a, "p1");
    expect(rendered[0]).toMatchObject({ roll: 3, score: 5 });
    expect(updates).toEqual([{ "system.psionics.psp": 13 }]);
    (globalThis as Record<string, unknown>).Roll = class {
      dice: { total: number }[] = [];
      total = 4;
      async evaluate() { return this; }
    };
    await usePower(actor().a, "p1");
    expect(rendered[1]).toMatchObject({ roll: 4 });
  });
});

describe("relearnPower", () => {
  it("raises scoreBonus by 1 when the budget allows", async () => {
    const p = power("p1", { scoreBonus: 1 });
    const { a } = actor({ items: [p], level: 3 });
    await relearnPower(a, "p1");
    expect(p.updates).toEqual([{ "system.scoreBonus": 2 }]);
    expect(info).toHaveBeenCalledWith('ADND2E.sheet.psionics.relearned:{"power":"Power p1"}');
    expect(warn).not.toHaveBeenCalled();
  });
  it("refuses with the learn reason when no budget remains", async () => {
    const p = power("p1");
    const { a } = actor({ items: [p], level: 1 });
    // level 1 has three devotion slots per Table 4; three owned devotions exhaust them
    a.items = [p, power("p2"), power("p3")] as never;
    await relearnPower(a, "p1");
    expect(p.updates).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.learn.no-budget");
  });
  it("refuses a non-psionicist and ignores an unknown power", async () => {
    const none = actor({ level: 0 });
    await relearnPower(none.a, "p1");
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.noClass");
    const p = power("p1");
    const { a } = actor({ items: [p] });
    await relearnPower(a, "nope");
    expect(p.updates).toEqual([]);
  });
  it("tolerates a power item with no update method", async () => {
    const p = power("p1");
    const { a } = actor({ items: [{ ...p, update: undefined }], level: 3 });
    await expect(relearnPower(a, "p1")).resolves.toBeUndefined();
  });
});

describe("knownPowers", () => {
  it("maps owned power items and skips other types", () => {
    const { a } = actor({ items: [power("p1", { scoreBonus: 2 }), { id: "x", name: "x", type: "weapon", system: {} }] });
    expect(knownPowers(a)).toEqual([{ id: "p1", name: "Power p1", discipline: "telepathy", kind: "devotion", scoreBonus: 2 }]);
  });
  it("defaults a missing scoreBonus to 0", () => {
    const { a } = actor({ items: [{ id: "p", name: "p", type: "power", system: { discipline: "telepathy", kind: "devotion" } }] });
    expect(knownPowers(a)[0]!.scoreBonus).toBe(0);
  });
});

describe("rest", () => {
  it("recovers PSPs (10 + 12 x 2 hours of sleep, capped at max)", async () => {
    const { a, updates } = actor({ psp: 10, max: 40 });
    await rest(a, "sleep", 2);
    expect(updates).toEqual([{ "system.psionics.psp": 34 }]);
  });
  it("writes the number below max, and null (full) when the recovered total reaches or passes max", async () => {
    const below = actor({ psp: 10, max: 40 });
    await rest(below.a, "sleep", 1); // 10 + 12 = 22
    expect(below.updates).toEqual([{ "system.psionics.psp": 22 }]);
    const exact = actor({ psp: 28, max: 40 });
    await rest(exact.a, "sleep", 1); // 28 + 12 = 40 = max
    expect(exact.updates).toEqual([{ "system.psionics.psp": null }]);
    const over = actor({ psp: 30, max: 40 });
    await rest(over.a, "sleep", 2); // capped at max
    expect(over.updates).toEqual([{ "system.psionics.psp": null }]);
  });
  it("is refused while a power is maintained", async () => {
    const { a, updates } = actor({ psp: 10, maintained: ["p1"] });
    await rest(a, "sleep", 2);
    expect(updates).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.restBlocked");
  });
  it("an orphan maintained entry (its power item is gone) does not block rest and is pruned in the same write", async () => {
    const { a, updates } = actor({ psp: 10, max: 40, items: [], maintained: ["ghost"] });
    await rest(a, "sleep", 2);
    expect(updates).toEqual([{ "system.psionics.psp": 34, "system.psionics.maintained": [] }]);
    expect(warn).not.toHaveBeenCalled();
  });
  it("refuses a dormant dual-class psionicist (derived level 0) exactly like no class", async () => {
    const { a, updates } = actor({ level: 0, max: 0 });
    await usePower(a, "p1", async () => 5);
    await rest(a, "sleep", 2);
    expect(updates).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenNthCalledWith(1, "ADND2E.sheet.psionics.noClass");
    expect(warn).toHaveBeenNthCalledWith(2, "ADND2E.sheet.psionics.noClass");
  });
  it("refuses a non-psionicist", async () => {
    const { a, updates } = actor({ level: 0 });
    await rest(a, "sleep", 2);
    expect(updates).toEqual([]);
  });
});

describe("payMaintenance", () => {
  const items = () => [power("p1", { maintenanceCost: 3, maintenanceUnit: "round" }), power("p2", { maintenanceCost: 5, maintenanceUnit: "round" })];
  it("deducts one unit of one power", async () => {
    const { a, updates } = actor({ psp: 20, items: items(), maintained: ["p1", "p2"] });
    await payMaintenance(a, "p1");
    expect(updates).toEqual([{ "system.psionics.psp": 17 }]);
  });
  it("ends a power it cannot pay, with a toast", async () => {
    const { a, updates } = actor({ psp: 2, items: items(), maintained: ["p1", "p2"] });
    await payMaintenance(a, "p1");
    expect(updates).toEqual([{ "system.psionics.psp": 2, "system.psionics.maintained": [{ powerId: "p2" }] }]);
    expect(warn).toHaveBeenCalledWith('ADND2E.sheet.psionics.maintenanceEnded:{"power":"Power p1"}');
  });
  it("null charges every maintained power in order and ends the ones it cannot pay", async () => {
    const { a, updates } = actor({ psp: 6, items: items(), maintained: ["p1", "p2"] });
    await payMaintenance(a, null);
    expect(updates).toEqual([{ "system.psionics.psp": 3, "system.psionics.maintained": [{ powerId: "p1" }] }]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it("drops a maintained entry whose power item is gone, free and without a toast", async () => {
    const { a, updates } = actor({ psp: 9, items: [], maintained: ["gone"] });
    await payMaintenance(a, null);
    expect(updates).toEqual([{ "system.psionics.psp": 9, "system.psionics.maintained": [] }]);
    expect(warn).not.toHaveBeenCalled();
  });
  it("does nothing for a power that is not maintained, and refuses a non-psionicist", async () => {
    const { a, updates } = actor({ items: items(), maintained: ["p1"] });
    await payMaintenance(a, "p2");
    expect(updates).toEqual([]);
    const none = actor({ level: 0 });
    await payMaintenance(none.a, null);
    expect(none.updates).toEqual([]);
  });
});

describe("adjustPsp", () => {
  it("adds PSPs below the maximum", async () => {
    const { a, updates } = actor({ psp: 20, max: 40 });
    await adjustPsp(a, 10);
    expect(updates).toEqual([{ "system.psionics.psp": 30 }]);
  });
  it("stores null when a gain reaches or passes the maximum", async () => {
    const exact = actor({ psp: 30, max: 40 });
    await adjustPsp(exact.a, 10);
    expect(exact.updates).toEqual([{ "system.psionics.psp": null }]);
    const over = actor({ psp: 30, max: 40 });
    await adjustPsp(over.a, 99);
    expect(over.updates).toEqual([{ "system.psionics.psp": null }]);
  });
  it("spends PSPs, treating a null pool as the maximum", async () => {
    const { a, updates } = actor({ psp: 30, max: 40 });
    await adjustPsp(a, -10);
    expect(updates).toEqual([{ "system.psionics.psp": 20 }]);
    const full = actor({ psp: null, max: 40 });
    await adjustPsp(full.a, -5);
    expect(full.updates).toEqual([{ "system.psionics.psp": 35 }]);
    const all = actor({ psp: 10, max: 40 });
    await adjustPsp(all.a, -10);
    expect(all.updates).toEqual([{ "system.psionics.psp": 0 }]);
  });
  it("refuses to spend more than the pool, with no write", async () => {
    const { a, updates } = actor({ psp: 5 });
    await adjustPsp(a, -6);
    expect(updates).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.notEnoughPsp");
  });
  it("ignores zero and non-integer amounts", async () => {
    const { a, updates } = actor();
    for (const d of [0, 1.5, NaN]) await adjustPsp(a, d);
    expect(updates).toEqual([]);
  });
  it("refuses a non-psionicist", async () => {
    const none = actor({ level: 0 });
    await adjustPsp(none.a, 5);
    expect(none.updates).toEqual([]);
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.noClass");
  });
});

describe("endPower", () => {
  it("removes the entry", async () => {
    const { a, updates } = actor({ maintained: ["p1", "p2"] });
    await endPower(a, "p1");
    expect(updates).toEqual([{ "system.psionics.maintained": [{ powerId: "p2" }] }]);
  });
  it("does nothing when the power is not maintained, and refuses a non-psionicist", async () => {
    const { a, updates } = actor({ maintained: ["p2"] });
    await endPower(a, "p1");
    expect(updates).toEqual([]);
    const none = actor({ level: 0, maintained: ["p1"] });
    await endPower(none.a, "p1");
    expect(none.updates).toEqual([]);
  });
});
