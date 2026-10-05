import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetKitPowers, resetPower, usePower, type KitPowerActor } from "../../../src/sheets/character/kit-power-actions";

const created: unknown[] = [];
let warn: ReturnType<typeof vi.fn>;

beforeEach(() => {
  created.length = 0;
  warn = vi.fn();
  (globalThis as Record<string, unknown>).game = { i18n: { localize: (k: string) => k, format: (k: string) => k } };
  (globalThis as Record<string, unknown>).ui = { notifications: { warn } };
  (globalThis as Record<string, unknown>).ChatMessage = {
    getSpeaker: () => ({ alias: "Tam" }),
    create: async (data: unknown) => created.push(data),
  };
  (globalThis as Record<string, unknown>).foundry = {
    applications: { handlebars: { renderTemplate: async () => "<card/>" } },
  };
});

const kit = (powers: unknown[]) => ({
  id: "k1", name: "Kit", type: "kit",
  system: {
    chassisId: "fighter",
    qualifications: { abilityMinimums: {}, races: [], alignments: [] },
    xpModifierPercent: 0, effects: [], equipment: { armor: { mode: "inherit", names: [] }, weapons: { mode: "inherit", names: [] } },
    forbiddenWeaponProficiencies: [], grantedFeatures: [], powers,
  },
});
const cls = { id: "c1", name: "Fighter", type: "class", system: { chassisId: "fighter" } };
const daily = { id: "shape", name: "Shapechange", uses: 2, per: "day", scope: "mammals", params: [] };
const free = { id: "sense", name: "Sense", uses: 0, per: "at-will", scope: "", params: [] };

function actor(usage: Record<string, { used: number }>, powers: unknown[] = [daily, free]) {
  const updates: Record<string, unknown>[] = [];
  const a: KitPowerActor = {
    name: "Tam", img: "t.png",
    items: [cls, kit(powers)],
    system: { kitPowers: usage },
    update: async (d) => void updates.push(d),
  };
  return { a, updates };
}

describe("usePower", () => {
  it("spends one use, writes the counter and posts a card", async () => {
    const { a, updates } = actor({});
    await usePower(a, "k1", "shape");
    expect(updates).toEqual([{ "system.kitPowers.k1:shape": { used: 1 } }]);
    expect(created).toHaveLength(1);
  });
  it("warns and does nothing when no uses remain", async () => {
    const { a, updates } = actor({ "k1:shape": { used: 2 } });
    await usePower(a, "k1", "shape");
    expect(updates).toEqual([]);
    expect(created).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it("an at-will power posts a card without writing a counter", async () => {
    const { a, updates } = actor({});
    await usePower(a, "k1", "sense");
    expect(updates).toEqual([]);
    expect(created).toHaveLength(1);
  });
  it("ignores an unknown kit or power", async () => {
    const { a, updates } = actor({});
    await usePower(a, "nope", "shape");
    await usePower(a, "k1", "nope");
    expect(updates).toEqual([]);
    expect(created).toHaveLength(0);
  });
  it("ignores a kit whose class the actor does not own", async () => {
    const { a, updates } = actor({});
    a.items = [kit([daily])];
    await usePower(a, "k1", "shape");
    expect(updates).toEqual([]);
  });
});

describe("resetPower", () => {
  it("zeroes one power's counter", async () => {
    const { a, updates } = actor({ "k1:shape": { used: 2 } });
    await resetPower(a, "k1", "shape");
    expect(updates).toEqual([{ "system.kitPowers.k1:shape": { used: 0 } }]);
  });
  it("does nothing when the power is unused or unknown", async () => {
    const { a, updates } = actor({});
    await resetPower(a, "k1", "shape");
    await resetPower(a, "k1", "nope");
    expect(updates).toEqual([]);
  });
});

describe("resetKitPowers", () => {
  it("zeroes every used power of the frequency in one update", async () => {
    const { a, updates } = actor({ "k1:shape": { used: 1 } });
    await resetKitPowers(a, "day");
    expect(updates).toEqual([{ "system.kitPowers.k1:shape": { used: 0 } }]);
  });
  it("makes no update when there is nothing to reset", async () => {
    const { a, updates } = actor({});
    await resetKitPowers(a, "day");
    await resetKitPowers(a, "encounter");
    expect(updates).toEqual([]);
  });
  it("tolerates an actor with no kitPowers object", async () => {
    const { a, updates } = actor({});
    delete (a.system as { kitPowers?: unknown }).kitPowers;
    await resetKitPowers(a, "day");
    expect(updates).toEqual([]);
  });
});
