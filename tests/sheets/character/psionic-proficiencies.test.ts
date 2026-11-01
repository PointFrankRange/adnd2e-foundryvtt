import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultProficiencyDeps, endFocus, endHarness, expireProficiencyEffects, harnessSubconscious, meditativeFocus, type ProficiencyActor, type ProficiencyDeps,
} from "../../../src/sheets/character/psionic-proficiencies";

const warn = vi.fn();
const info = vi.fn();
const checks = vi.fn();
vi.mock("../../../src/sheets/character/proficiency-actions", () => ({ rollNonweaponCheck: (...a: unknown[]) => checks(...a) }));
vi.mock("../../../src/sheets/character/psionic-round", () => ({ noteInitiation: async () => ({ inCombat: false }) }));
vi.mock("../../../src/settings", () => ({ getOptionalRules: () => ({ psionicArmorPenalties: false }) }));

beforeEach(() => {
  warn.mockClear();
  info.mockClear();
  checks.mockReset();
  const g = globalThis as Record<string, unknown>;
  g.game = { i18n: { localize: (k: string) => k, format: (k: string, d: Record<string, string>) => `${k}:${JSON.stringify(d)}` }, time: { worldTime: 1000 } };
  g.ui = { notifications: { warn, info } };
});

const nwp = (name: string) => ({ id: `nwp-${name}`, name, type: "nonweaponProficiency", system: {} });
function actor(over: Record<string, unknown> = {}, items: unknown[] = [nwp("Harness Subconscious"), nwp("Meditative Focus")]) {
  const updates: Record<string, unknown>[] = [];
  const a = {
    name: "Tam", img: "t.png", items,
    system: { abilities: {}, psionics: { psp: null, maintained: [], activeDefense: "", contacts: [], max: 40, level: 3, ...over } },
    update: async (d: Record<string, unknown>) => void updates.push(d),
  } as unknown as ProficiencyActor;
  return { a, updates };
}
const deps = (pass: boolean | null = true): ProficiencyDeps => ({ check: async () => pass, now: () => 5000 });

describe("harnessSubconscious", () => {
  it("a full pool and a passed check raises the pool by 20% and sets the 72-hour expiry", async () => {
    const { a, updates } = actor();
    await harnessSubconscious(a, deps());
    expect(updates).toEqual([{ "system.psionics.harness": { bonus: 8, expiresAt: 5000 + 259200 }, "system.psionics.psp": 48 }]);
    expect(info).toHaveBeenCalledWith('ADND2E.sheet.psionics.proficiencies.harnessed:{"bonus":8}');
  });
  it("a failed or blocked check changes nothing", async () => {
    const { a, updates } = actor();
    await harnessSubconscious(a, deps(false));
    await harnessSubconscious(a, deps(null));
    expect(updates).toEqual([]);
  });
  it("needs the proficiency, a full pool, and no boost already running", async () => {
    await harnessSubconscious(actor({}, []).a, deps());
    expect(warn).toHaveBeenCalledWith('ADND2E.sheet.psionics.proficiencies.notKnown:{"name":"Harness Subconscious"}');
    await harnessSubconscious(actor({ psp: 39 }).a, deps());
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.proficiencies.harnessNeedsFull");
    await harnessSubconscious(actor({ harness: { bonus: 8, expiresAt: 1 } }).a, deps());
    expect(info).toHaveBeenCalledWith("ADND2E.sheet.psionics.proficiencies.harnessActive:{}");
  });
  it("a non-psionicist is refused", async () => {
    const { a, updates } = actor({ level: 0 });
    await harnessSubconscious(a, deps());
    expect(updates).toEqual([]);
  });
});

describe("endHarness", () => {
  it("removes the gained points: a full boosted pool goes back to full (null)", async () => {
    const { a, updates } = actor({ max: 48, psp: null, harness: { bonus: 8, expiresAt: 1 } });
    await endHarness(a);
    expect(updates).toEqual([{ "system.psionics.harness": { bonus: 0, expiresAt: null }, "system.psionics.psp": null }]);
  });
  it("a spent pool loses the same points but never goes below 0", async () => {
    const { a, updates } = actor({ max: 48, psp: 5, harness: { bonus: 8, expiresAt: 1 } });
    await endHarness(a);
    expect(updates[0]!["system.psionics.psp"]).toBe(0);
    const mid = actor({ max: 48, psp: 30, harness: { bonus: 8, expiresAt: 1 } });
    await endHarness(mid.a);
    expect(mid.updates[0]!["system.psionics.psp"]).toBe(22);
  });
  it("does nothing without an active boost", async () => {
    const { a, updates } = actor();
    await endHarness(a);
    expect(updates).toEqual([]);
  });
});

describe("meditativeFocus / endFocus", () => {
  it("a passed check sets the discipline and the 24-hour expiry", async () => {
    const { a, updates } = actor();
    await meditativeFocus(a, "telepathy", deps());
    expect(updates).toEqual([{ "system.psionics.focus": { discipline: "telepathy", expiresAt: 5000 + 86400 } }]);
  });
  it("a failed check, an unknown discipline, a missing proficiency or an active focus change nothing", async () => {
    const { a, updates } = actor();
    await meditativeFocus(a, "telepathy", deps(false));
    await meditativeFocus(a, "astrology", deps());
    expect(warn).toHaveBeenCalledWith("ADND2E.sheet.psionics.proficiencies.pickDiscipline");
    await meditativeFocus(actor({}, []).a, "telepathy", deps());
    await meditativeFocus(actor({ focus: { discipline: "telepathy", expiresAt: 1 } }).a, "psychokinesis", deps());
    expect(info).toHaveBeenCalledWith("ADND2E.sheet.psionics.proficiencies.focusActive:{}");
    expect(updates).toEqual([]);
  });
  it("endFocus clears an active focus and ignores none", async () => {
    const { a, updates } = actor({ focus: { discipline: "telepathy", expiresAt: 1 } });
    await endFocus(a);
    expect(updates).toEqual([{ "system.psionics.focus": { discipline: "", expiresAt: null } }]);
    const none = actor();
    await endFocus(none.a);
    expect(none.updates).toEqual([]);
  });
});

describe("expireProficiencyEffects", () => {
  it("ends only what has expired, on psionic actors", async () => {
    const ended = actor({ max: 48, harness: { bonus: 8, expiresAt: 100 }, focus: { discipline: "telepathy", expiresAt: 100 } });
    const running = actor({ max: 48, harness: { bonus: 8, expiresAt: 9999 }, focus: { discipline: "telepathy", expiresAt: 9999 } });
    const plain = actor({ level: 0 });
    const noState = actor();
    const orc = { system: {}, items: [], update: async () => undefined } as unknown as ProficiencyActor;
    await expireProficiencyEffects([ended.a, running.a, plain.a, noState.a, orc], 500);
    expect(ended.updates.map((u) => Object.keys(u)[0])).toEqual(["system.psionics.harness", "system.psionics.focus"]);
    expect(running.updates).toEqual([]);
    expect(plain.updates).toEqual([]);
    expect(noState.updates).toEqual([]);
  });
});

describe("default deps", () => {
  it("check runs the system's non-weapon check; now is the world time", async () => {
    checks.mockResolvedValue(true);
    const { a } = actor();
    expect(await defaultProficiencyDeps.check(a, "id1")).toBe(true);
    expect(checks).toHaveBeenCalledWith(a, "id1");
    expect(defaultProficiencyDeps.now()).toBe(1000);
  });
});
