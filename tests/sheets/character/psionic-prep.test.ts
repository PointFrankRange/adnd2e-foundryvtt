import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelPreparation, completePreparation, disruptPreparation, readPreparing, useWithPreparation, type PrepActor,
} from "../../../src/sheets/character/psionic-prep";

let rules: Record<string, boolean>;
const uses: unknown[][] = [];
const noted: unknown[] = [];
let combats: unknown[];
vi.mock("../../../src/settings", () => ({ getOptionalRules: () => rules }));
vi.mock("../../../src/sheets/character/psionic-actions", () => ({
  currentPsp: (a: { system: { psionics: { psp: number | null; max: number } } }) => Math.min(a.system.psionics.psp ?? a.system.psionics.max, a.system.psionics.max),
  findPower: (a: { items: { id: string }[] }, id: string) => a.items.find((i) => i.id === id),
  info: (...a: unknown[]) => void infos.push(a),
  warn: (...a: unknown[]) => void warns.push(a),
  requirePsionicist: (a: { system: { psionics: { level: number } } }) => a.system.psionics.level > 0,
  usePower: async (...a: unknown[]) => void uses.push(a),
}));
vi.mock("../../../src/sheets/character/psionic-round", () => ({
  noteInitiation: async (...a: unknown[]) => void noted.push(a),
  startedCombatFor: () => (combats[0] as { combat: unknown } | undefined) ?? null,
}));
const infos: unknown[][] = [];
const warns: unknown[][] = [];
const created: { flags: { adnd2e: { psionicPrep: string } } }[] = [];
const contexts: Record<string, unknown>[] = [];

beforeEach(() => {
  rules = { psionicPrepTimes: true };
  uses.length = 0; noted.length = 0; infos.length = 0; warns.length = 0; created.length = 0; contexts.length = 0;
  combats = [];
  const g = globalThis as Record<string, unknown>;
  g.game = { i18n: { format: (k: string, d: Record<string, string>) => `${k}:${JSON.stringify(d)}` } };
  g.ChatMessage = { create: async (d: never) => void created.push(d), getSpeaker: () => ({ alias: "Tam" }) };
  g.foundry = { applications: { handlebars: { renderTemplate: async (_p: string, c: Record<string, unknown>) => (contexts.push(c), "<card/>") } } };
});

const power = (id: string, over: Record<string, unknown> = {}) => ({ id, name: `Power ${id}`, type: "power", system: { kind: "devotion", initialCost: 5, preparation: "2", ...over } });
function actor(prep: Record<string, unknown> | null = null, psp = 20, items: unknown[] = [power("p1")]) {
  const updates: Record<string, unknown>[] = [];
  const a = {
    id: "A1", name: "Tam", img: "t.png", items,
    system: { attributes: { hp: { value: 30 } }, psionics: { psp, max: 40, level: 3, ...(prep ? { preparing: prep } : {}) } },
    update: async (d: Record<string, unknown>) => void updates.push(d),
  } as unknown as PrepActor;
  return { a, updates };
}
const inCombat = (round: number, id = "c1") => (combats = [{ combat: { id, round } }]);
const preparing = (over: Record<string, unknown> = {}) => ({ powerId: "p1", combatId: "c1", completeRound: 6, hp: 30, ...over });

describe("readPreparing", () => {
  it("is the stored state, or null when none or no actor system", () => {
    expect(readPreparing(actor(preparing()).a)).toMatchObject({ powerId: "p1" });
    expect(readPreparing(actor().a)).toBeNull();
    expect(readPreparing(actor({ powerId: "", combatId: "", completeRound: null, hp: 0 }).a)).toBeNull();
    expect(readPreparing({} as never)).toBeNull();
  });
});

describe("useWithPreparation", () => {
  it("a non-psionicist is refused and an unknown power does nothing", async () => {
    const none = actor();
    none.a.system.psionics.level = 0;
    await useWithPreparation(none.a, "p1");
    await useWithPreparation(actor().a, "missing");
    expect(uses).toEqual([]);
  });
  it("a power with preparation in a started combat begins a preparation (no roll, no cost)", async () => {
    const { a, updates } = actor();
    inCombat(4);
    await useWithPreparation(a, "p1");
    expect(updates).toEqual([{ "system.psionics.preparing": { powerId: "p1", combatId: "c1", completeRound: 5, hp: 30 } }]);
    expect(uses).toEqual([]);
    expect(noted).toHaveLength(1);
    expect(created[0]!.flags.adnd2e.psionicPrep).toBe("begin");
    expect(contexts[0]).toMatchObject({ powerName: "Power p1", text: 'ADND2E.chat.psionicPrep.begin:{"power":"Power p1","round":"5"}' });
  });
  it("it is the ordinary use outside a combat, with the rule off, for a no-preparation power and for a defense mode", async () => {
    await useWithPreparation(actor().a, "p1"); // no combat
    inCombat(4);
    rules = { psionicPrepTimes: false };
    await useWithPreparation(actor().a, "p1");
    rules = { psionicPrepTimes: true };
    await useWithPreparation(actor(null, 20, [power("p1", { preparation: "0" })]).a, "p1");
    await useWithPreparation(actor(null, 20, [power("p1", { kind: "defense" })]).a, "p1");
    expect(uses).toHaveLength(4);
  });
  it("refuses another power while one is being prepared (a defense mode is still fine)", async () => {
    inCombat(4);
    await useWithPreparation(actor(preparing()).a, "p1");
    expect(warns).toEqual([["ADND2E.sheet.psionics.prep.already"]]);
    await useWithPreparation(actor(preparing(), 20, [power("p1", { kind: "defense" })]).a, "p1");
    expect(uses).toHaveLength(1);
  });
  it("refuses to begin without the PSPs to complete it", async () => {
    const { a, updates } = actor(null, 2);
    inCombat(4);
    await useWithPreparation(a, "p1");
    expect(warns).toEqual([["ADND2E.sheet.psionics.notEnoughPsp"]]);
    expect(updates).toEqual([]);
  });
});

describe("completePreparation", () => {
  it("does nothing without a preparation", async () => {
    await completePreparation(actor().a);
    expect(uses).toEqual([]);
  });
  it("tells the user it is not ready yet and keeps it", async () => {
    const { a, updates } = actor(preparing());
    inCombat(5);
    await completePreparation(a);
    expect(infos).toEqual([["ADND2E.sheet.psionics.prep.notYet", { round: 6 }]]);
    expect(updates).toEqual([]);
  });
  it("at its round: clears the state and makes the ordinary use without counting it again", async () => {
    const { a, updates } = actor(preparing());
    inCombat(6);
    await completePreparation(a);
    expect(updates).toEqual([{ "system.psionics.preparing": { powerId: "", combatId: "", completeRound: null, hp: 0 } }]);
    expect(uses).toHaveLength(1);
    expect(uses[0]![1]).toBe("p1");
    expect(uses[0]![3]).toBe(false);
  });
  it("an ended or different combat loses it with a warning", async () => {
    const gone = actor(preparing());
    await completePreparation(gone.a);
    const other = actor(preparing());
    inCombat(6, "c9");
    await completePreparation(other.a);
    expect(gone.updates).toHaveLength(1);
    expect(other.updates).toHaveLength(1);
    expect(warns.filter((w) => w[0] === "ADND2E.sheet.psionics.prep.gone")).toHaveLength(2);
    expect(uses).toEqual([]);
  });
  it("without the PSPs it stays prepared; a vanished power item just clears", async () => {
    const poor = actor(preparing(), 1);
    inCombat(6);
    await completePreparation(poor.a);
    expect(warns).toEqual([["ADND2E.sheet.psionics.notEnoughPsp"]]);
    expect(poor.updates).toEqual([]);
    const noPower = actor(preparing(), 20, []);
    await completePreparation(noPower.a);
    expect(noPower.updates).toHaveLength(1);
    expect(uses).toEqual([]);
  });
});

describe("cancelPreparation / disruptPreparation", () => {
  it("cancel clears the state with a card and spends nothing", async () => {
    const { a, updates } = actor(preparing());
    await cancelPreparation(a);
    expect(updates).toHaveLength(1);
    expect(created[0]!.flags.adnd2e.psionicPrep).toBe("cancelled");
    await cancelPreparation(actor().a);
    expect(created).toHaveLength(1);
  });
  it("disrupt clears the state; announce posts the card; two causes at once give one", async () => {
    const { a, updates } = actor(preparing());
    await Promise.all([disruptPreparation(a, { announce: true }), disruptPreparation(a, { announce: true })]);
    expect(created.filter((c) => c.flags.adnd2e.psionicPrep === "disrupted")).toHaveLength(1);
    expect(updates).toHaveLength(1);
    const quiet = actor(preparing());
    await disruptPreparation(quiet.a, { announce: false });
    expect(quiet.updates).toHaveLength(1);
    expect(created).toHaveLength(1);
    await disruptPreparation(actor().a, { announce: true });
    expect(created).toHaveLength(1);
  });
  it("an unnamed power shows a dash on the card", async () => {
    const { a } = actor(preparing(), 20, []);
    await cancelPreparation(a);
    expect(contexts[0]).toMatchObject({ powerName: "-" });
  });
});
