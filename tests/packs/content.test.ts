import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CLASS_IDS, RACE_IDS, ABILITY_KEYS, WIZARD_SCHOOLS, NONWEAPON_GROUPS } from "../../src/data/item/choices";
import { TRAITS, toTraitEffect, type RawTraitEffect } from "../../src/core/skills/traits";

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
  it("has exactly 65 documents", () => {
    // 82 PHB Table 37 rows − 17 cross-group duplicates (see packs/nonweapon-proficiencies/_source/_MANIFEST.md)
    expect(items).toHaveLength(65);
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

describe("weapon-proficiencies pack content", () => {
  const items = docs("weapon-proficiencies");
  const groupNames = docs("weapon-proficiency-groups").map((d) => d.name as string);
  const EXPECTED_PER_GROUP: Record<string, number> = {
    Blades: 8,
    Bludgeoning: 6,
    Hafted: 6,
    "Pole Arms": 19,
    Hurled: 4,
    Bows: 4,
    Crossbows: 3,
    Slings: 1,
  };

  it("has exactly 51 documents (names + group assignment only)", () => {
    expect(items).toHaveLength(51);
  });

  it("every entry is a specific (non-group) weaponProficiency named after its weapon, with no slots or mastery yet", () => {
    for (const d of items) {
      expect(d.type, String(d.name)).toBe("weaponProficiency");
      expect(sys(d).isGroup, String(d.name)).toBe(false);
      expect(sys(d).weaponOrGroup, String(d.name)).toBe(d.name);
      expect(sys(d).slotsInvested, String(d.name)).toBe(0);
      expect(sys(d).masteryTier, String(d.name)).toBe(0);
      expect(sys(d).description, String(d.name)).toBe("");
    }
  });

  it("every proficiencyGroup names a real group in the weapon-proficiency-groups pack", () => {
    for (const d of items) expect(groupNames, String(d.name)).toContain(sys(d).proficiencyGroup);
  });

  it("names are unique", () => {
    expect(new Set(items.map((d) => d.name)).size).toBe(items.length);
  });

  it("per-group counts match the enumerated list, and the 8 real groups are all represented", () => {
    const counts: Record<string, number> = {};
    for (const d of items) counts[sys(d).proficiencyGroup as string] = (counts[sys(d).proficiencyGroup as string] ?? 0) + 1;
    expect(counts).toEqual(EXPECTED_PER_GROUP);
    expect(new Set(Object.keys(counts))).toEqual(new Set(groupNames));
  });
});

describe("traits pack content (drift-tested against the pure TRAITS table)", () => {
  const items = docs("traits");

  it("has exactly one trait Item per TRAITS row (14), with unique ids and names", () => {
    expect(items).toHaveLength(14);
    expect(items).toHaveLength(TRAITS.length);
    expect(new Set(items.map((d) => d._id)).size).toBe(14);
    expect(new Set(items.map((d) => d.name)).size).toBe(14);
    for (const d of items) expect(d.type, String(d.name)).toBe("trait");
  });

  it("every doc matches its TRAITS row: name, cost, img, traitId and effect", () => {
    for (const t of TRAITS) {
      const d = items.find((x) => sys(x).traitId === t.id);
      expect(d, t.id).toBeDefined();
      expect(d!.name, t.id).toBe(t.name);
      expect(sys(d!).cost, t.id).toBe(t.cost);
      expect(sys(d!).description, t.id).toBe("");
      expect(d!.img, t.id).toBe(t.cost < 0 ? "icons/svg/downgrade.svg" : "icons/svg/upgrade.svg");
      // round-trip: the stored flat effect must normalise to exactly the table's typed effect
      expect(toTraitEffect(sys(d!).effect as RawTraitEffect), t.id).toEqual(t.effect);
    }
  });

  it("stores the flat effect with every member present (unused members blank)", () => {
    for (const d of items) {
      const e = sys(d).effect as Record<string, unknown>;
      expect(Object.keys(e).sort(), String(d.name)).toEqual(["ability", "amount", "kind", "mode", "save", "track"]);
    }
  });
});
