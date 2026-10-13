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
  it("lists only registry maneuvers the style offers (mental is not in B1) with their states", () => {
    const rows = rowsOf(buildMartialArtsView({ ...base, items: [karate()] }));
    expect(Object.keys(rows).sort()).toEqual(["block:1", "block:2", "kick:1", "strike:1", "strike:2", "strike:3"]);
    expect(rows["strike:1"]).toMatchObject({
      state: "learnable", usable: false, nameKey: "ADND2E.martialManeuvers.ironFist", listKey: "ADND2E.martialManeuverLists.strike",
      costKey: "ADND2E.martialManeuverCosts.none", kind: "attack", difficulty: 1, reasonKey: "",
    });
    expect(rows["strike:2"]).toMatchObject({ state: "locked", reasonKey: "ADND2E.sheet.martialArts.locked.order" });
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
