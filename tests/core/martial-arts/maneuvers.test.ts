import { describe, expect, it } from "vitest";
import {
  MANEUVERS, MANEUVER_LISTS, MAX_MANEUVERS_PER_LEVEL, armorGroupOf, learnability, maneuverById, maneuverDamageFormula, table21Modifier, doubleBasicDamageFormula,
} from "../../../src/core/martial-arts";

const def = (id: string) => maneuverById(id)!;

describe("registry - Table 19 for Block, Kick and Strike", () => {
  it("lists the 25 maneuvers in order with unique ids", () => {
    expect(MANEUVERS.map((m) => m.id)).toEqual([
      "block:1", "block:2", "block:3", "block:4", "kick:1", "kick:2", "kick:3", "strike:1", "strike:2", "strike:3",
      "lock:1", "lock:2", "lock:3", "lock:4", "push:1", "push:2", "push:3", "throw:1", "throw:2", "throw:3", "throw:4",
      "vitalArea:1", "vitalArea:2", "vitalArea:3", "vitalArea:4",
    ]);
    expect(MANEUVER_LISTS).toEqual(["block", "kick", "strike", "lock", "push", "throw", "vitalArea"]);
    for (const m of MANEUVERS) expect(m.id).toBe(`${m.list}:${m.difficulty}`);
  });
  it("carries slugs, kinds and costs", () => {
    expect(MANEUVERS.map((m) => [m.slug, m.kind, m.cost])).toEqual([
      ["basicParry", "parry", 1], ["parryAll", "parry", 2], ["grapplingBlock", "parry", 1], ["arrowParry", "parry", 2],
      ["circleKick", "attack", 1], ["flyingKick", "attack", 1], ["backwardKick", "attack", 1],
      ["ironFist", "attack", 0], ["crushingBlow", "attack", "round"], ["eagleClaw", "attack", "round"],
      ["chokeHold", "attack", "round"], ["lockingBlock", "attack", 1], ["incapacitator", "attack", 1], ["immobilizing", "attack", 1],
      ["concentratedPush", "attack", 1], ["stickingTouch", "attack", 1], ["oneFingerPush", "attack", "round"],
      ["fall", "passive", 0], ["instantStand", "passive", 0], ["hurl", "attack", 1], ["greatThrow", "attack", 1],
      ["painTouch", "attack", 1], ["stunningTouch", "attack", 1], ["paralyzingTouch", "attack", 1], ["distanceDeath", "attack", "round"],
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

describe("B2 registry rows", () => {
  it.each([
    ["lock:1", "chokeHold", "attack", "round", -2, -3, -5],
    ["lock:2", "lockingBlock", "attack", 1, -1, -1, -1],
    ["lock:3", "incapacitator", "attack", 1, -1, -2, -4],
    ["lock:4", "immobilizing", "attack", 1, 1, 2, 3],
    ["push:1", "concentratedPush", "attack", 1, 0, -1, -2],
    ["push:2", "stickingTouch", "attack", 1, 0, 1, 2],
    ["push:3", "oneFingerPush", "attack", "round", 0, 0, 0],
    ["throw:1", "fall", "passive", 0, 0, 0, 0],
    ["throw:2", "instantStand", "passive", 0, 0, 0, 0],
    ["throw:3", "hurl", "attack", 1, -1, 1, 3],
    ["throw:4", "greatThrow", "attack", 1, -1, -2, -4],
    ["vitalArea:1", "painTouch", "attack", 1, -3, -4, -5],
    ["vitalArea:2", "stunningTouch", "attack", 1, -2, -4, -4],
    ["vitalArea:3", "paralyzingTouch", "attack", 1, -2, -3, -4],
    ["vitalArea:4", "distanceDeath", "attack", "round", 0, -2, -3],
  ])("%s %s", (id, slug, kind, cost, light, mail, plate) => {
    const m = maneuverById(id)!;
    expect([m.slug, m.kind, m.cost]).toEqual([slug, kind, cost]);
    expect(m.table21).toEqual({ light, mail, plate });
  });

  it("lists the effects each maneuver offers", () => {
    const eff = (id: string) => (maneuverById(id)!.effects ?? []).map((e) => [e.id, e.save, e.condition, e.rounds]);
    expect(eff("lock:1")).toEqual([["unconscious", null, "unconscious", "1d3"]]);
    expect(eff("lock:2")).toEqual([]);
    expect(eff("lock:3")).toEqual([["limbUseless", 0, null, null]]);
    expect(eff("lock:4")).toEqual([["held", null, "held", null]]);
    expect(eff("push:1")).toEqual([["prone", 0, "prone", null]]);
    expect(eff("push:3")).toEqual([["prone", 0, "prone", null]]);
    expect(eff("throw:3")).toEqual([["prone", null, "prone", null]]);
    expect(eff("throw:4")).toEqual([["prone", null, "prone", null]]);
    expect(eff("vitalArea:1")).toEqual([]);
    expect(eff("vitalArea:2")).toEqual([["stunned", 0, "stunned", "1d4"]]);
    expect(eff("vitalArea:3")).toEqual([["paralyzed", -2, "paralyzed", "2d4"]]);
    expect(eff("vitalArea:4")).toEqual([
      ["pain", null, null, null], ["stunned", -2, "stunned", "1d4"], ["paralyzed", -4, "paralyzed", "2d4"], ["doubleDamage", null, null, null],
    ]);
    expect(maneuverById("vitalArea:4")!.effects!.find((e) => e.id === "doubleDamage")!.doubleDamage).toBe(true);
  });

  const ctx = (styleDie: string | null, strengthAdj = 0) => ({ styleDie, level: 5, strengthAdj });
  it("damage-less maneuvers and passives have no formula", () => {
    for (const id of ["lock:1", "lock:2", "lock:4", "push:1", "push:2", "push:3", "throw:1", "throw:2", "vitalArea:1", "vitalArea:2", "vitalArea:3", "vitalArea:4"]) {
      expect(maneuverDamageFormula(maneuverById(id)!, ctx("1d4", 2)), id).toBeNull();
    }
  });
  it("Incapacitator and Hurl add a die to the style die and Strength", () => {
    expect(maneuverDamageFormula(maneuverById("lock:3")!, ctx("1d4", 2))).toBe("1d4+1d4+2");
    expect(maneuverDamageFormula(maneuverById("throw:3")!, ctx("1d4", 1))).toBe("1d4+1d4+1");
  });
  it("Great Throw doubles the style die plus Strength", () => {
    expect(maneuverDamageFormula(maneuverById("throw:4")!, ctx("1d4", 1))).toBe("(1d4+1)*2");
    expect(maneuverDamageFormula(maneuverById("throw:4")!, ctx("1d4", 0))).toBe("(1d4)*2");
    expect(maneuverDamageFormula(maneuverById("throw:4")!, ctx("1", 0))).toBe("2");
    expect(maneuverDamageFormula(maneuverById("throw:4")!, ctx(null, 0))).toBe("0");
  });
  it("doubleBasicDamageFormula is twice the style die with no Strength", () => {
    expect(doubleBasicDamageFormula("1d4")).toBe("(1d4)*2");
    expect(doubleBasicDamageFormula("1")).toBe("2");
    expect(doubleBasicDamageFormula(null)).toBe("0");
  });
  it("learnability applies to the new lists the same way", () => {
    const base = { offered: [{ list: "lock", difficulties: [1, 3] }], known: [] as { id: string; level: number }[], freeSlots: 1, level: 3 };
    expect(learnability({ ...base, maneuverId: "lock:1" })).toEqual({ ok: true });
    expect(learnability({ ...base, maneuverId: "lock:3" })).toEqual({ ok: false, reason: "order" });
    expect(learnability({ ...base, maneuverId: "vitalArea:1" })).toEqual({ ok: false, reason: "notOffered" });
  });
});
