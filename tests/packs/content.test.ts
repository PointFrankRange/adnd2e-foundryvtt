import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CLASS_IDS, RACE_IDS, ABILITY_KEYS, WIZARD_SCHOOLS, NONWEAPON_GROUPS } from "../../src/data/item/choices";

const ROOT = path.resolve(__dirname, "..", "..");
function docs(pack: string): Record<string, unknown>[] {
  const dir = path.join(ROOT, "packs", pack, "_source");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as Record<string, unknown>);
}
const sys = (d: Record<string, unknown>) => d.system as Record<string, unknown>;

describe("classes pack content", () => {
  const items = docs("classes");
  it("has 16 documents: 8 chassis + 8 wizard specialists", () => {
    expect(items).toHaveLength(16);
    expect(items.every((d) => d.type === "class")).toBe(true);
  });
  it("every chassisId is a valid ClassId", () => {
    for (const d of items) expect(CLASS_IDS as readonly string[]).toContain(sys(d).chassisId);
  });
  it("the 8 non-null specialistSchool docs are mage + a distinct WizardSchool", () => {
    const specialists = items.filter((d) => sys(d).specialistSchool !== null);
    expect(specialists).toHaveLength(8);
    for (const d of specialists) {
      expect(sys(d).chassisId).toBe("mage");
      expect(WIZARD_SCHOOLS as readonly string[]).toContain(sys(d).specialistSchool);
    }
    expect(new Set(specialists.map((d) => sys(d).specialistSchool)).size).toBe(8);
  });
  it("plain (non-specialist) classes cover all 8 chassis", () => {
    const plain = items.filter((d) => sys(d).specialistSchool === null).map((d) => sys(d).chassisId);
    expect(new Set(plain)).toEqual(new Set(CLASS_IDS));
  });
});

describe("races pack content", () => {
  const items = docs("races");
  it("has 6 documents, one per RaceId", () => {
    expect(items).toHaveLength(6);
    expect(new Set(items.map((d) => sys(d).raceId))).toEqual(new Set(RACE_IDS));
  });
  it("allowedClasses + allowedMulticlass entries are all valid ClassIds", () => {
    for (const d of items) {
      for (const c of sys(d).allowedClasses as string[]) expect(CLASS_IDS as readonly string[]).toContain(c);
      for (const combo of sys(d).allowedMulticlass as string[][]) {
        for (const c of combo) expect(CLASS_IDS as readonly string[]).toContain(c);
      }
    }
  });
  it("classLevelLimits keys are valid ClassIds; values are null or a positive int", () => {
    for (const d of items) {
      for (const [k, v] of Object.entries(sys(d).classLevelLimits as Record<string, unknown>)) {
        expect(CLASS_IDS as readonly string[]).toContain(k);
        expect(v === null || (typeof v === "number" && Number.isInteger(v) && v > 0), `${d.name}.${k}`).toBe(true);
      }
    }
  });
});

describe("nonweapon-proficiencies pack content", () => {
  const items = docs("nonweapon-proficiencies");
  it("has 60–80 documents", () => {
    expect(items.length).toBeGreaterThanOrEqual(60);
    expect(items.length).toBeLessThanOrEqual(80);
  });
  it("every entry: valid ability + group, slotCost >= 1, integer modifier", () => {
    for (const d of items) {
      expect(ABILITY_KEYS as readonly string[]).toContain(sys(d).governingAbility);
      expect(NONWEAPON_GROUPS as readonly string[]).toContain(sys(d).group);
      expect(sys(d).slotCost as number).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(sys(d).modifier as number)).toBe(true);
    }
  });
  it("names are unique", () => {
    expect(new Set(items.map((d) => d.name)).size).toBe(items.length);
  });
});

describe("weapon-proficiency-groups pack content", () => {
  const items = docs("weapon-proficiency-groups");
  it("has 8 group documents", () => {
    expect(items).toHaveLength(8);
    for (const d of items) {
      expect(d.type).toBe("weaponProficiency");
      expect(sys(d).isGroup).toBe(true);
    }
  });
});
