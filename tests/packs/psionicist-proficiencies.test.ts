import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CLASS_PROFICIENCY_GROUPS, nonweaponSlotCost } from "../../src/core/proficiencies/nonweapon";
import type { ClassId, NonweaponGroup } from "../../src/core/types";

const DIR = path.resolve(__dirname, "..", "..", "packs", "nonweapon-proficiencies", "_source");
interface Prof { name: string; system: { slotCost: number; group: NonweaponGroup; alsoGroups?: NonweaponGroup[] } }
const pack: Prof[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as Prof);
const byName = (n: string) => pack.find((p) => p.name === n)!;
const cost = (n: string, c: ClassId) => {
  const s = byName(n).system;
  return nonweaponSlotCost(s.slotCost, s.group, c, s.alsoGroups);
};

describe("the Psionicist non-weapon proficiency group (PHBR5 Table 11)", () => {
  it("psionicist picks from the psionicist and general groups", () => {
    expect(CLASS_PROFICIENCY_GROUPS.psionicist).toEqual(["psionicist", "general"]);
  });
  it("a shared proficiency costs the Table 11 number for a psionicist, the old rule for others", () => {
    expect(cost("Gem Cutting", "psionicist")).toBe(2);
    expect(cost("Gem Cutting", "fighter")).toBe(3);
    expect(cost("Gem Cutting", "mage")).toBe(2);
    expect(cost("Musical Instrument", "psionicist")).toBe(1);
    expect(cost("Reading/Writing", "psionicist")).toBe(1);
    expect(cost("Religion", "psionicist")).toBe(1);
  });
  it("a psionicist-group proficiency costs base to a psionicist and one more to everyone else", () => {
    expect(cost("Hypnosis", "psionicist")).toBe(1);
    expect(cost("Hypnosis", "fighter")).toBe(2);
    expect(cost("Harness Subconscious", "psionicist")).toBe(2);
    expect(cost("Harness Subconscious", "mage")).toBe(3);
  });
  it("is unchanged for every pre-existing item and every non-psionicist class", () => {
    const old = (p: Prof, c: ClassId) =>
      CLASS_PROFICIENCY_GROUPS[c].includes(p.system.group) ? p.system.slotCost : p.system.slotCost + 1;
    const classes: ClassId[] = ["fighter", "mage", "cleric", "thief", "paladin", "ranger", "druid", "bard"];
    const preexisting = pack.filter((p) => p.system.group !== "psionicist");
    expect(preexisting).toHaveLength(65);
    for (const c of classes) for (const p of preexisting) expect(cost(p.name, c), `${p.name}/${c}`).toBe(old(p, c));
  });
  it("an item with no alsoGroups costs exactly as before", () => {
    expect(nonweaponSlotCost(1, "warrior", "mage")).toBe(2);
    expect(nonweaponSlotCost(1, "warrior", "mage", [])).toBe(2);
    expect(nonweaponSlotCost(1, "warrior", "mage", ["wizard"])).toBe(1);
  });
});
