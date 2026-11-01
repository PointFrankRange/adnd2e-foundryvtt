import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: [string, ...unknown[]][] = [];
vi.mock("../../../src/sheets/character/psionic-actions", () => ({
  usePower: async (...a: unknown[]) => void calls.push(["use", ...a]),
  relearnPower: async (...a: unknown[]) => void calls.push(["relearn", ...a]),
  rest: async (...a: unknown[]) => void calls.push(["rest", ...a]),
  adjustPsp: async (...a: unknown[]) => void calls.push(["adjust", ...a]),
  payMaintenance: async (...a: unknown[]) => void calls.push(["maintenance", ...a]),
  endPower: async (...a: unknown[]) => void calls.push(["end", ...a]),
}));
vi.mock("../../../src/sheets/character/psionic-combat", () => ({
  attackMode: async (...a: unknown[]) => void calls.push(["attack", ...a]),
  dropDefense: async (...a: unknown[]) => void calls.push(["dropDefense", ...a]),
  endContactAction: async (...a: unknown[]) => void calls.push(["endContact", ...a]),
  payUpkeep: async (...a: unknown[]) => void calls.push(["upkeep", ...a]),
  raiseDefense: async (...a: unknown[]) => void calls.push(["raise", ...a]),
}));

import { buildPsionicsInput, hasPsionics, PSIONIC_ACTIONS, psionicActionHandlers, type PsionicSheet } from "../../../src/sheets/character/psionic-sheet";

const actor = (psionics: unknown) => ({ system: { psionics: psionics as never, abilities: { wis: { score: 17 }, con: { score: 16 } } } });
const base = { psp: null, max: 40, level: 3, maintained: [{ powerId: "p1" }] };

describe("hasPsionics", () => {
  it("is true only with a derived psionic level above 0", () => {
    expect(hasPsionics(actor({ ...base }))).toBe(true);
    expect(hasPsionics(actor({ ...base, level: 0 }))).toBe(false);
    expect(hasPsionics(actor(undefined))).toBe(false);
  });
});

describe("buildPsionicsInput", () => {
  const power = { id: "p1", name: "Mind Thrust", type: "power", system: { discipline: "telepathy", scoreBonus: 1 } };
  const plate = { id: "a1", name: "Plate", type: "armor", system: { armorType: "plate-mail", equipped: true, isShield: false } };
  it("is null without psionics", () => {
    expect(buildPsionicsInput(actor({ ...base, level: 0 }), [], false)).toBeNull();
    expect(buildPsionicsInput(actor(undefined), [], false)).toBeNull();
  });
  it("assembles the pool, ability scores, powers and defaults", () => {
    const input = buildPsionicsInput(actor({ ...base }), [power, plate], false)!;
    expect(input).toMatchObject({ psp: null, max: 40, level: 3, wild: false, activeDefense: "", contacts: [], abilityScores: { wis: 17, con: 16 } });
    expect(input.powers).toEqual([{ id: "p1", name: "Mind Thrust", discipline: "telepathy", scoreBonus: 1 }]);
    expect(input.armorPenalty).toEqual({ value: 0, armor: null });
  });
  it("applies the armor penalty only with the rule on and not for a wild talent", () => {
    expect(buildPsionicsInput(actor({ ...base }), [plate], true)!.armorPenalty).toEqual({ value: -3, armor: "Plate" });
    expect(buildPsionicsInput(actor({ ...base, wild: true }), [plate], true)!.armorPenalty).toEqual({ value: 0, armor: null });
  });
  it("passes through the raised defense, contacts and wild flag", () => {
    const input = buildPsionicsInput(actor({ ...base, wild: true, activeDefense: "d1", contacts: [{ target: "t", name: "T", tangents: 1 }] }), [], false)!;
    expect(input).toMatchObject({ wild: true, activeDefense: "d1", contacts: [{ target: "t", name: "T", tangents: 1 }] });
  });
});

describe("PSIONIC_ACTIONS", () => {
  beforeEach(() => {
    calls.length = 0;
  });
  type Field = { value: string };
  // the node test environment has no DOM: a sheet's element is a selector -> field map
  const sheet = (fields: Record<string, Field> = {}, isEditable = true): PsionicSheet => ({
    document: { id: "actor" },
    element: { querySelector: (sel: string) => fields[sel] ?? null } as never,
    isEditable,
  });
  const btn = (data: Record<string, string> = {}) => ({ dataset: data });
  const run = (id: string, s: PsionicSheet, data: Record<string, string> = {}) => PSIONIC_ACTIONS[id]!(s, btn(data));

  it("registers the 15 psionic action ids and no wild-talent action", () => {
    expect(Object.keys(PSIONIC_ACTIONS).sort()).toEqual([
      "adjustPsionicPsp", "endPsionicPower", "payPsionicMaintenance", "psionicAttack", "psionicDropDefense", "psionicEndContact", "psionicEndFocus",
      "psionicEndHarness", "psionicFocus", "psionicHarness", "psionicPayUpkeep", "psionicRaiseDefense", "psionicRest", "relearnPsionicPower", "usePsionicPower",
    ]);
  });
  it("dispatches per-power actions with the power id, and ignores a missing id", async () => {
    const s = sheet();
    await run("usePsionicPower", s, { powerId: "p1" });
    await run("relearnPsionicPower", s, { powerId: "p2" });
    await run("endPsionicPower", s, { powerId: "p3" });
    await run("psionicAttack", s, { powerId: "p4" });
    await run("usePsionicPower", s);
    await run("relearnPsionicPower", s);
    await run("endPsionicPower", s);
    await run("psionicAttack", s);
    expect(calls.map((c) => [c[0], c[2]])).toEqual([["use", "p1"], ["relearn", "p2"], ["end", "p3"], ["attack", "p4"]]);
  });
  it("pays one power's maintenance or all of it", async () => {
    await run("payPsionicMaintenance", sheet(), { powerId: "p1" });
    await run("payPsionicMaintenance", sheet());
    expect(calls.map((c) => c[2])).toEqual(["p1", null]);
  });
  it("rest reads the activity and hours fields; zero hours does nothing", async () => {
    await run("psionicRest", sheet({ "[data-psionic-activity]": { value: "sleep" }, "[data-psionic-hours]": { value: "6" } }));
    await run("psionicRest", sheet({ "[data-psionic-hours]": { value: "0" } }));
    await run("psionicRest", sheet());
    expect(calls).toEqual([["rest", { id: "actor" }, "sleep", 6]]);
  });
  it("rest defaults the activity to resting", async () => {
    await run("psionicRest", sheet({ "[data-psionic-hours]": { value: "2" } }));
    expect(calls).toEqual([["rest", { id: "actor" }, "rest", 2]]);
  });
  it("adjust applies a whole non-zero delta and clears the field", async () => {
    const field = { value: "-10" };
    await run("adjustPsionicPsp", sheet({ "[data-psionic-adjust]": field }));
    expect(calls).toEqual([["adjust", { id: "actor" }, -10]]);
    expect(field.value).toBe("");
    await run("adjustPsionicPsp", sheet({ "[data-psionic-adjust]": { value: "0" } }));
    await run("adjustPsionicPsp", sheet({ "[data-psionic-adjust]": { value: "1.5" } }));
    await run("adjustPsionicPsp", sheet());
    expect(calls).toHaveLength(1);
  });
  it("raise reads the defense select; drop, upkeep and end contact dispatch", async () => {
    await run("psionicRaiseDefense", sheet({ "[data-psionic-defense]": { value: "d1" } }));
    await run("psionicRaiseDefense", sheet());
    await run("psionicDropDefense", sheet());
    await run("psionicPayUpkeep", sheet());
    await run("psionicEndContact", sheet(), { target: "Actor.t" });
    await run("psionicEndContact", sheet());
    expect(calls.map((c) => [c[0], c[2]])).toEqual([["raise", "d1"], ["dropDefense", undefined], ["upkeep", undefined], ["endContact", "Actor.t"]]);
  });
  it("does nothing on a sheet that is not editable", async () => {
    const s = sheet({ "[data-psionic-adjust]": { value: "5" }, "[data-psionic-defense]": { value: "d1" }, "[data-psionic-hours]": { value: "3" } }, false);
    for (const id of Object.keys(PSIONIC_ACTIONS)) await run(id, s, { powerId: "p1", target: "t" });
    expect(calls).toEqual([]);
  });
  it("psionicActionHandlers runs each handler with this = the sheet", async () => {
    const handlers = psionicActionHandlers();
    await handlers.usePsionicPower!.call(sheet(), {} as never, btn({ powerId: "p9" }));
    expect(calls).toEqual([["use", { id: "actor" }, "p9"]]);
  });
});
