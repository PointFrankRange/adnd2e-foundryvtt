import { describe, expect, it } from "vitest";
import {
  MANEUVERS, MANEUVER_LISTS, MAX_MANEUVERS_PER_LEVEL, armorGroupOf, learnability, maneuverById, maneuverDamageFormula, table21Modifier,
} from "../../../src/core/martial-arts";

const def = (id: string) => maneuverById(id)!;

describe("registry - Table 19 for Block, Kick and Strike", () => {
  it("lists the ten maneuvers in order with unique ids", () => {
    expect(MANEUVERS.map((m) => m.id)).toEqual([
      "block:1", "block:2", "block:3", "block:4", "kick:1", "kick:2", "kick:3", "strike:1", "strike:2", "strike:3",
    ]);
    expect(MANEUVER_LISTS).toEqual(["block", "kick", "strike"]);
    for (const m of MANEUVERS) expect(m.id).toBe(`${m.list}:${m.difficulty}`);
  });
  it("carries slugs, kinds and costs", () => {
    expect(MANEUVERS.map((m) => [m.slug, m.kind, m.cost])).toEqual([
      ["basicParry", "parry", 1], ["parryAll", "parry", 2], ["grapplingBlock", "parry", 1], ["arrowParry", "parry", 2],
      ["circleKick", "attack", 1], ["flyingKick", "attack", 1], ["backwardKick", "attack", 1],
      ["ironFist", "attack", 0], ["crushingBlow", "attack", "round"], ["eagleClaw", "attack", "round"],
    ]);
  });
  it("looks up by id and rejects an unknown id", () => {
    expect(maneuverById("kick:1")?.slug).toBe("circleKick");
    expect(maneuverById("bogus:9")).toBeUndefined();
  });
});

describe("Table 21 modifiers and armor grouping", () => {
  it.each([
    ["kick:1", 0, -1, -3], ["kick:2", -1, -2, -3], ["kick:3", 0, -1, -3],
    ["strike:1", 0, 0, -2], ["strike:2", -1, -2, -3], ["strike:3", -2, -3, -4],
    ["block:1", 0, 0, 0], ["block:2", 0, 0, 0], ["block:3", 0, 0, 0], ["block:4", 0, 0, 0],
  ])("%s → %i / %i / %i", (id, light, mail, plate) => {
    expect(def(id).table21).toEqual({ light, mail, plate });
    expect(table21Modifier(def(id), "light")).toBe(light);
    expect(table21Modifier(def(id), "mail")).toBe(mail);
    expect(table21Modifier(def(id), "plate")).toBe(plate);
  });
  it("an unarmored target takes no Table 21 modifier", () => {
    expect(table21Modifier(def("strike:3"), "none")).toBe(0);
  });
  it.each([
    ["leather", "light"], ["padded", "light"], ["studded-leather", "light"],
    ["ring-mail", "mail"], ["scale-mail", "mail"], ["chain-mail", "mail"], ["elven-chain", "mail"],
    ["splint-mail", "mail"], ["banded-mail", "mail"], ["plate-mail", "mail"],
    ["field-plate", "plate"], ["full-plate", "plate"], ["none", "none"], ["mystery", "none"],
  ])("%s → %s", (type, group) => expect(armorGroupOf(type, false)).toBe(group));
  it("a tough-hided monster uses the light column whatever its armor", () => {
    expect(armorGroupOf("none", true)).toBe("light");
  });
});

describe("maneuverDamageFormula", () => {
  const ctx = (styleDie: string | null, level = 5, strengthAdj = 0) => ({ styleDie, level, strengthAdj });
  it("a kick adds its die to the style die and Strength", () => {
    expect(maneuverDamageFormula(def("kick:1"), ctx("1d4", 5, 2))).toBe("1d4+1d2+2");
    expect(maneuverDamageFormula(def("kick:2"), ctx("1d2"))).toBe("1d2+1d4");
  });
  it("a flat style die of 1 hp is a flat term", () => {
    expect(maneuverDamageFormula(def("kick:3"), ctx("1", 5, 1))).toBe("2");
  });
  it("Iron Fist and Eagle Claw use their own die plus Strength", () => {
    expect(maneuverDamageFormula(def("strike:1"), ctx("1d4", 5, 3))).toBe("1d6+3");
    expect(maneuverDamageFormula(def("strike:3"), ctx("1d4", 5, -2))).toBe("1d8-2");
  });
  it("Crushing Blow is the style die plus half the level, with no Strength - the book's 11th-level 1d4 example", () => {
    expect(maneuverDamageFormula(def("strike:2"), ctx("1d4", 11, 4))).toBe("1d4+5");
  });
  it("a weapon-method style (no style die) counts the style die as 0", () => {
    expect(maneuverDamageFormula(def("kick:1"), ctx(null))).toBe("1d2");
    expect(maneuverDamageFormula(def("kick:3"), ctx(null))).toBe("0");
    expect(maneuverDamageFormula(def("kick:3"), ctx(null, 5, -3))).toBe("0");
  });
  it("a parry has no damage", () => {
    expect(maneuverDamageFormula(def("block:1"), ctx("1d4"))).toBeNull();
  });
});

describe("learnability", () => {
  const offered = [{ list: "kick", difficulties: [1, 3] }, { list: "strike", difficulties: [1] }];
  const base = { offered, known: [] as { id: string; level: number }[], freeSlots: 1, level: 3 };
  it("allows the lowest unlearned maneuver in a list", () => {
    expect(learnability({ ...base, maneuverId: "kick:1" })).toEqual({ ok: true });
  });
  it("enforces per-list order but skips difficulties the style does not offer", () => {
    expect(learnability({ ...base, maneuverId: "kick:3" })).toEqual({ ok: false, reason: "order" });
    expect(learnability({ ...base, maneuverId: "kick:3", known: [{ id: "kick:1", level: 1 }] })).toEqual({ ok: true });
    expect(learnability({ ...base, maneuverId: "strike:1" })).toEqual({ ok: true });
  });
  it("refuses a maneuver the style does not offer, or an unknown id", () => {
    expect(learnability({ ...base, maneuverId: "kick:2" })).toEqual({ ok: false, reason: "notOffered" });
    expect(learnability({ ...base, maneuverId: "block:1" })).toEqual({ ok: false, reason: "notOffered" });
    expect(learnability({ ...base, maneuverId: "bogus:9" })).toEqual({ ok: false, reason: "notOffered" });
  });
  it("refuses a known maneuver", () => {
    expect(learnability({ ...base, maneuverId: "kick:1", known: [{ id: "kick:1", level: 1 }] })).toEqual({ ok: false, reason: "known" });
  });
  it("needs a free weapon slot", () => {
    expect(learnability({ ...base, maneuverId: "kick:1", freeSlots: 0 })).toEqual({ ok: false, reason: "noSlot" });
  });
  it("allows at most two per level, and a new level resets it", () => {
    expect(MAX_MANEUVERS_PER_LEVEL).toBe(2);
    const known = [{ id: "kick:1", level: 3 }, { id: "kick:3", level: 3 }];
    expect(learnability({ ...base, maneuverId: "strike:1", known })).toEqual({ ok: false, reason: "levelCap" });
    expect(learnability({ ...base, maneuverId: "strike:1", known, level: 4 })).toEqual({ ok: true });
  });
});
