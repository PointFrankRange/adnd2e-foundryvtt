import { describe, expect, it } from "vitest";
import { buildMartialArtsView, type StyleItemLike } from "../../../src/core/martial-arts";

const karate = (over: Partial<StyleItemLike["system"]> = {}): StyleItemLike => ({
  id: "karate", name: "Karate", img: "", type: "martialStyle",
  system: {
    form: "hard", principalMethod: "strike", slotsInvested: 1,
    availableManeuvers: [
      { list: "strike", difficulties: [1, 2, 3] }, { list: "kick", difficulties: [1] },
      { list: "block", difficulties: [1, 2] }, { list: "mental", difficulties: [1, 4] },
    ],
    knownManeuvers: [],
    ...over,
  },
});
const base = { enabled: true, knowsBasics: true, storedActiveId: "", canAct: true, level: 3, freeSlots: 2 };
const rowsOf = (v: ReturnType<typeof buildMartialArtsView>) => Object.fromEntries(v.styles[0]!.maneuvers.map((m) => [m.id, m]));

describe("maneuver rows", () => {
  it("lists only registry maneuvers the style offers with their states", () => {
    const rows = rowsOf(buildMartialArtsView({ ...base, items: [karate()] }));
    expect(Object.keys(rows).sort()).toEqual(["block:1", "block:2", "kick:1", "mental:1", "mental:4", "strike:1", "strike:2", "strike:3"]);
    expect(rows["strike:1"]).toMatchObject({
      state: "learnable", usable: false, nameKey: "ADND2E.martialManeuvers.ironFist", listKey: "ADND2E.martialManeuverLists.strike",
      costKey: "ADND2E.martialManeuverCosts.none", kind: "attack", difficulty: 1, reasonKey: "",
      effectKey: "ADND2E.martialManeuverEffects.ironFist",
    });
    expect(rows["strike:2"]).toMatchObject({ state: "locked", reasonKey: "ADND2E.sheet.martialArts.locked.order" });
  });
  it("knownManeuvers is the learned subset in order", () => {
    const item = karate({ knownManeuvers: [{ id: "strike:1", level: 1 }, { id: "block:1", level: 1 }] });
    const v = buildMartialArtsView({ ...base, items: [item] });
    expect(v.styles[0]!.knownManeuvers.map((m) => m.id)).toEqual(["block:1", "strike:1"]);
    expect(v.styles[0]!.maneuvers.length).toBeGreaterThan(2);
  });
  it("a known maneuver is usable only on the active style while able to act", () => {
    const item = karate({ knownManeuvers: [{ id: "strike:1", level: 1 }] });
    expect(rowsOf(buildMartialArtsView({ ...base, items: [item] }))["strike:1"]).toMatchObject({ state: "known", usable: true });
    expect(rowsOf(buildMartialArtsView({ ...base, canAct: false, items: [item] }))["strike:1"]!.usable).toBe(false);
    const other: StyleItemLike = { ...karate(), id: "sumo", name: "Sumo" };
    const v = buildMartialArtsView({ ...base, storedActiveId: "sumo", items: [item, other] });
    expect(v.styles[0]!.maneuvers.find((m) => m.id === "strike:1")!.usable).toBe(false);
  });
  it("shows the lock reason when there is no slot or the level cap is reached", () => {
    expect(rowsOf(buildMartialArtsView({ ...base, freeSlots: 0, items: [karate()] }))["strike:1"]).toMatchObject({
      state: "locked", reasonKey: "ADND2E.sheet.martialArts.locked.noSlot",
    });
    const capped = karate({ knownManeuvers: [{ id: "kick:1", level: 3 }, { id: "block:1", level: 3 }] });
    expect(rowsOf(buildMartialArtsView({ ...base, items: [capped] }))["strike:1"]).toMatchObject({
      state: "locked", reasonKey: "ADND2E.sheet.martialArts.locked.levelCap",
    });
  });
  it("a known maneuver still shows (as known) after the style stops offering its list", () => {
    const item = karate({ availableManeuvers: [{ list: "block", difficulties: [1] }], knownManeuvers: [{ id: "kick:1", level: 2 }] });
    const rows = rowsOf(buildMartialArtsView({ ...base, items: [item] }));
    expect(Object.keys(rows).sort()).toEqual(["block:1", "kick:1"]);
    expect(rows["kick:1"]).toMatchObject({ state: "known", usable: true, reasonKey: "" });
  });
  it("a style with no availableManeuvers has an empty list, and the new inputs are optional", () => {
    const v = buildMartialArtsView({
      enabled: true, knowsBasics: true, storedActiveId: "", canAct: true,
      items: [{ id: "x", name: "X", img: "", type: "martialStyle", system: { form: "soft", principalMethod: "throw" } }],
    });
    expect(v.styles[0]!.maneuvers).toEqual([]);
  });
});

describe("passive maneuvers (SP18 B2)", () => {
  it("Fall and Instant Stand are learnable rows with kind passive and are never usable", () => {
    const item: StyleItemLike = {
      id: "judo", name: "Judo", img: "", type: "martialStyle",
      system: {
        form: "soft", principalMethod: "throw", slotsInvested: 2,
        availableManeuvers: [{ list: "throw", difficulties: [1, 2] }],
        knownManeuvers: [{ id: "throw:1", level: 1 }],
      },
    };
    const v = buildMartialArtsView({ enabled: true, knowsBasics: true, storedActiveId: "", canAct: true, level: 3, freeSlots: 2, items: [item] });
    const rows = Object.fromEntries(v.styles[0]!.maneuvers.map((m) => [m.id, m]));
    expect(rows["throw:1"]).toMatchObject({ kind: "passive", state: "known", usable: false });
    expect(rows["throw:2"]).toMatchObject({ kind: "passive", state: "learnable", usable: false });
  });
});

const style = (known: string[], id = "s1"): StyleItemLike => ({
  id, name: id, img: "", type: "martialStyle",
  system: {
    form: "soft", principalMethod: "throw", slotsInvested: 1,
    availableManeuvers: [{ list: "mental", difficulties: [1, 2, 3, 4, 5, 6, 7] }],
    knownManeuvers: known.map((k) => ({ id: k, level: 1 })),
  },
});

describe("constants (SP18 B3)", () => {
  const view = (items: StyleItemLike[], wearingBodyArmor = false) =>
    buildMartialArtsView({ enabled: true, knowsBasics: true, storedActiveId: "", canAct: true, level: 5, freeSlots: 2, wearingBodyArmor, items });

  it("collects constants across ALL owned styles, not only the active one", () => {
    const v = view([style(["mental:2"], "a"), style(["mental:5", "mental:6"], "b")]);
    expect(v.constants).toMatchObject({ allAroundSight: true, mentalResistance: false, blindFighting: true, ironskin: true });
    expect(v.constants.summary.map((s) => s.nameKey)).toEqual([
      "ADND2E.martialManeuvers.allAroundSight", "ADND2E.martialManeuvers.blindFighting", "ADND2E.martialManeuvers.ironskin",
    ]);
    expect(v.constants.summary[2]).toEqual({ nameKey: "ADND2E.martialManeuvers.ironskin", effectKey: "ADND2E.martialManeuverEffects.ironskin" });
  });
  it("Ironskin's AC modifier is -2 only without body armor", () => {
    expect(view([style(["mental:6"])], false).constants.ironskinAcMod).toBe(-2);
    expect(view([style(["mental:6"])], true).constants.ironskinAcMod).toBe(0);
    expect(view([style([])]).constants.ironskinAcMod).toBe(0);
  });
  it("no styles means no constants", () => {
    expect(view([]).constants).toMatchObject({ ironskin: false, ironskinAcMod: 0, summary: [] });
  });
});

describe("ch'i constants (SP18 Plan C)", () => {
  it("known ch'i reports its rank at the character's level and lists the summary row between mental 3 and 5", () => {
    const v = buildMartialArtsView({
      enabled: true, knowsBasics: true, storedActiveId: "", canAct: true, level: 10, freeSlots: 2,
      items: [style(["mental:3", "mental:4", "mental:5"])],
    });
    expect(v.constants).toMatchObject({ chiKnown: true, chiRank: 3 });
    expect(v.constants.summary.map((s) => s.nameKey)).toEqual([
      "ADND2E.martialManeuvers.mentalResistance", "ADND2E.martialManeuvers.chiAttacks", "ADND2E.martialManeuvers.blindFighting",
    ]);
    expect(v.constants.summary[1]).toMatchObject({ effectKey: "ADND2E.martialManeuverEffects.chiAttacks", detailKey: "ADND2E.martialChi.rank3" });
  });
  it("unknown ch'i has rank 0 flag false and no row", () => {
    const v = buildMartialArtsView({ enabled: true, knowsBasics: true, storedActiveId: "", canAct: true, level: 10, freeSlots: 2, items: [style(["mental:2"])] });
    expect(v.constants).toMatchObject({ chiKnown: false, chiRank: 0 });
    expect(v.constants.summary.some((s) => s.nameKey.endsWith("chiAttacks"))).toBe(false);
  });
});

describe("passives list once (SP18 Plan C follow-up)", () => {
  it("every known passive is in the summary and none is a usable row under its style", () => {
    const v = buildMartialArtsView({
      enabled: true, knowsBasics: true, storedActiveId: "", canAct: true, level: 5, freeSlots: 2,
      items: [style(["throw:1", "mental:1", "mental:2"])],
    });
    expect(v.constants.summary.map((s) => s.nameKey)).toEqual([
      "ADND2E.martialManeuvers.fall", "ADND2E.martialManeuvers.meditation", "ADND2E.martialManeuvers.allAroundSight",
    ]);
    expect(v.styles[0].knownManeuvers.length).toBe(3);
    expect(v.styles[0].usableManeuvers).toEqual([]);
  });
});
