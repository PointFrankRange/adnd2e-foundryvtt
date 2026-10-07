import { describe, expect, it } from "vitest";
import {
  POWER_FREQUENCIES,
  buildPowerRows,
  buildPowerUseCardContext,
  canUsePower,
  normalizePowers,
  powerKey,
  powerRemaining,
  powerUses,
  resetKeys,
  spendPower,
  usageResetUpdate,
  usagePruneKeys,
  usageSpendUpdate,
  usedCount,
  type KitPower,
} from "../../../src/core/kits";

const daily: KitPower = { id: "shape", name: "Shapechange", uses: 2, per: "day", scope: "mammals", params: [{ key: "duration", value: "1 hour" }], usesByLevel: [] };
const weekly: KitPower = { id: "rally", name: "Rally", uses: 1, per: "week", scope: "", params: [], usesByLevel: [] };
const fight: KitPower = { id: "feint", name: "Feint", uses: 3, per: "encounter", scope: "", params: [], usesByLevel: [] };
const free: KitPower = { id: "sense", name: "Sense", uses: 0, per: "at-will", scope: "", params: [], usesByLevel: [] };

describe("POWER_FREQUENCIES", () => {
  it("lists the four frequencies", () => {
    expect([...POWER_FREQUENCIES]).toEqual(["day", "week", "encounter", "at-will"]);
  });
});

describe("normalizePowers", () => {
  it("keeps a well-formed power", () => {
    expect(
      normalizePowers([{ id: "shape", name: "Shapechange", uses: 2, per: "day", scope: "mammals", params: [{ key: "duration", value: "1 hour" }] }]),
    ).toEqual([daily]);
  });
  it("drops blank, non-slug and duplicate ids, blank names and invalid frequencies", () => {
    const out = normalizePowers([
      { id: "", name: "A", uses: 1, per: "day" },
      { id: "Bad.Id", name: "B", uses: 1, per: "day" },
      { id: 5, name: "C", uses: 1, per: "day" },
      { id: "ok", name: "", uses: 1, per: "day" },
      { id: "ok", name: 7, uses: 1, per: "day" },
      { id: "ok", name: "D", uses: 1, per: "yearly" },
      { id: "good", name: "E", uses: 1, per: "day" },
      { id: "good", name: "F", uses: 1, per: "week" },
    ]);
    expect(out.map((p) => p.id)).toEqual(["good"]);
    expect(out[0]!.name).toBe("E");
  });
  it("treats zero, negative or non-integer uses as at-will, and at-will as zero uses", () => {
    const out = normalizePowers([
      { id: "a", name: "A", uses: 0, per: "day" },
      { id: "b", name: "B", uses: -2, per: "week" },
      { id: "c", name: "C", uses: 1.5, per: "day" },
      { id: "d", name: "D", uses: "x", per: "day" },
      { id: "e", name: "E", uses: 4, per: "at-will" },
    ]);
    for (const p of out) {
      expect(p.per).toBe("at-will");
      expect(p.uses).toBe(0);
    }
    expect(out).toHaveLength(5);
  });
  it("defaults scope to blank and drops malformed params", () => {
    const [p] = normalizePowers([
      { id: "a", name: "A", uses: 1, per: "day", scope: 3, params: [{ key: "k", value: "v" }, { key: "", value: "x" }, { key: "n", value: 4 }, null, "s"] },
    ]);
    expect(p!.scope).toBe("");
    expect(p!.params).toEqual([{ key: "k", value: "v" }]);
  });
  it("treats a non-array params as none", () => {
    const [p] = normalizePowers([{ id: "a", name: "A", uses: 1, per: "day", params: "nope" }]);
    expect(p!.params).toEqual([]);
  });
});

describe("usage maths", () => {
  it("powerKey joins kit and power ids", () => {
    expect(powerKey("kitA", "shape")).toBe("kitA:shape");
  });
  it("usedCount reads a count, defaulting to 0 for missing or malformed entries", () => {
    const usage = { "k:a": { used: 2 }, "k:b": { used: -1 }, "k:c": { used: "x" } } as never;
    expect(usedCount(usage, "k", "a")).toBe(2);
    expect(usedCount(usage, "k", "b")).toBe(0);
    expect(usedCount(usage, "k", "c")).toBe(0);
    expect(usedCount(usage, "k", "missing")).toBe(0);
  });
  it("powerRemaining: null at-will, otherwise uses minus used, floored at 0", () => {
    expect(powerRemaining(free, 5)).toBeNull();
    expect(powerRemaining(daily, 0)).toBe(2);
    expect(powerRemaining(daily, 1)).toBe(1);
    expect(powerRemaining(daily, 9)).toBe(0);
  });
  it("canUsePower: at-will always, others while uses remain", () => {
    expect(canUsePower(free, 99)).toBe(true);
    expect(canUsePower(daily, 1)).toBe(true);
    expect(canUsePower(daily, 2)).toBe(false);
  });
  it("spendPower adds one use, never past the limit, and never counts at-will", () => {
    expect(spendPower(daily, 0)).toBe(1);
    expect(spendPower(daily, 2)).toBe(2);
    expect(spendPower(free, 0)).toBe(0);
  });
});

describe("buildPowerRows", () => {
  it("builds display rows with remaining, canUse and canReset", () => {
    const usage = { "k1:shape": { used: 2 }, "k1:rally": { used: 0 } };
    const rows = buildPowerRows("k1", [daily, weekly, free], usage);
    expect(rows[0]).toEqual({
      id: "shape", name: "Shapechange", per: "day", atWill: false, uses: 2, used: 2, remaining: 0,
      scope: "mammals", params: [{ key: "duration", value: "1 hour" }], canUse: false, canReset: true, locked: false,
    });
    expect(rows[1]).toMatchObject({ id: "rally", remaining: 1, canUse: true, canReset: false, locked: false });
    expect(rows[2]).toMatchObject({ id: "sense", atWill: true, remaining: null, canUse: true, canReset: false, locked: false });
  });
});

describe("reset and prune updates", () => {
  const kits = [{ id: "k1", powers: [daily, weekly, fight, free] }, { id: "k2", powers: [daily] }];
  const usage = { "k1:shape": { used: 1 }, "k1:rally": { used: 1 }, "k1:feint": { used: 0 }, "k2:shape": { used: 2 }, "gone:x": { used: 4 } };
  it("resetKeys lists used, non-at-will powers of the given frequency across kits", () => {
    expect(resetKeys(kits, usage, "day")).toEqual(["k1:shape", "k2:shape"]);
    expect(resetKeys(kits, usage, "week")).toEqual(["k1:rally"]);
    expect(resetKeys(kits, usage, "encounter")).toEqual([]);
    expect(resetKeys(kits, usage, "at-will")).toEqual([]);
  });
  it("usageResetUpdate sets each key's used to 0", () => {
    expect(usageResetUpdate(["k1:shape", "k2:shape"])).toEqual({
      "system.kitPowers.k1:shape": { used: 0 },
      "system.kitPowers.k2:shape": { used: 0 },
    });
    expect(usageResetUpdate([])).toEqual({});
  });
  it("usageSpendUpdate sets one key", () => {
    expect(usageSpendUpdate("k1:shape", 2)).toEqual({ "system.kitPowers.k1:shape": { used: 2 } });
  });
  it("usagePruneKeys lists every counter key of the kit and nothing else", () => {
    expect(usagePruneKeys(usage, "k1")).toEqual(["k1:shape", "k1:rally", "k1:feint"]);
    expect(usagePruneKeys(usage, "nothing")).toEqual([]);
  });
});

describe("buildPowerUseCardContext", () => {
  it("carries the power, scope, params, remaining uses and a localized frequency key", () => {
    const ctx = buildPowerUseCardContext({
      actorName: "Tam", actorImg: "a.png", power: daily, remaining: 1,
    });
    expect(ctx).toEqual({
      actorName: "Tam", actorImg: "a.png", powerName: "Shapechange", scope: "mammals",
      params: [{ key: "duration", value: "1 hour" }], atWill: false, remaining: 1, uses: 2,
      perKey: "ADND2E.sheet.kits.per.day",
    });
  });
  it("marks an at-will power", () => {
    const ctx = buildPowerUseCardContext({ actorName: "Tam", actorImg: "a.png", power: free, remaining: null });
    expect(ctx.atWill).toBe(true);
    expect(ctx.perKey).toBe("ADND2E.sheet.kits.per.at-will");
  });
});

const dispel: KitPower = {
  id: "dispel-evil", name: "Dispel Evil", uses: 0, per: "day", scope: "", params: [],
  usesByLevel: [{ minLevel: 1, uses: 0 }, { minLevel: 5, uses: 1 }, { minLevel: 10, uses: 2 }, { minLevel: 15, uses: 3 }, { minLevel: 20, uses: 4 }],
};

describe("level-scaled uses (SP11 Plan C)", () => {
  it("powerUses picks the highest bracket at or below the level, 0 below the first, and the flat uses with no table", () => {
    expect([1, 4, 5, 9, 10, 14, 15, 19, 20, 25].map((l) => powerUses(dispel, l))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(powerUses({ ...dispel, usesByLevel: [{ minLevel: 5, uses: 1 }] }, 3)).toBe(0);
    expect(powerUses(daily, 12)).toBe(2);
  });
  it("remaining / canUse / spend follow the level; a scaled power at 0 uses is locked, not at-will", () => {
    expect(powerRemaining(dispel, 0, 4)).toBe(0);
    expect(canUsePower(dispel, 0, 4)).toBe(false);
    expect(powerRemaining(dispel, 0, 5)).toBe(1);
    expect(canUsePower(dispel, 0, 5)).toBe(true);
    expect(spendPower(dispel, 0, 5)).toBe(1);
    expect(spendPower(dispel, 1, 5)).toBe(1);
    expect(spendPower(dispel, 0, 4)).toBe(0);
    expect(powerRemaining(dispel, 3, 10)).toBe(0);
  });
  it("buildPowerRows resolves uses at the class level and flags a locked row", () => {
    const [row4] = buildPowerRows("k1", [dispel], {}, 4);
    expect(row4).toMatchObject({ uses: 0, remaining: 0, canUse: false, locked: true, atWill: false, per: "day" });
    const [row10] = buildPowerRows("k1", [dispel], { "k1:dispel-evil": { used: 1 } }, 10);
    expect(row10).toMatchObject({ uses: 2, used: 1, remaining: 1, canUse: true, locked: false, canReset: true });
    const [flat] = buildPowerRows("k1", [daily], {});
    expect(flat).toMatchObject({ uses: 2, locked: false });
  });
  it("normalizePowers keeps a scaled power's per, sorts brackets, drops bad ones, and rejects scaled at-will", () => {
    const [p] = normalizePowers([
      {
        id: "dispel-evil", name: "Dispel Evil", uses: 9, per: "day",
        usesByLevel: [{ minLevel: 5, uses: 1 }, { minLevel: 1, uses: 0 }, { minLevel: 5, uses: 9 }, { minLevel: 0, uses: 1 }, { minLevel: 2.5, uses: 1 }, { minLevel: 3, uses: -1 }, null, { minLevel: "x", uses: 1 }],
      },
    ]);
    expect(p).toMatchObject({ id: "dispel-evil", per: "day", uses: 0 });
    expect(p!.usesByLevel).toEqual([{ minLevel: 1, uses: 0 }, { minLevel: 5, uses: 1 }]);
    expect(normalizePowers([{ id: "x", name: "X", per: "at-will", usesByLevel: [{ minLevel: 1, uses: 1 }] }])).toEqual([]);
    expect(normalizePowers([{ id: "y", name: "Y", uses: 2, per: "day", usesByLevel: "nope" }])[0]!.usesByLevel).toEqual([]);
  });
  it("the use card shows the resolved uses when given", () => {
    expect(buildPowerUseCardContext({ actorName: "T", actorImg: "i", power: dispel, remaining: 0, uses: 1 }).uses).toBe(1);
    expect(buildPowerUseCardContext({ actorName: "T", actorImg: "i", power: daily, remaining: 1 }).uses).toBe(2);
  });
});
