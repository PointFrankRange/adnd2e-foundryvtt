import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CLASS_IDS, RACE_IDS, ABILITY_KEYS, ALIGNMENTS, WIZARD_SCHOOLS, NONWEAPON_GROUPS } from "../../src/data/item/choices";
import { EQUIPMENT_MODES, normalizePowers, normalizeOverrides, powerUses, TURNING_MODES, CASTING_MODES } from "../../src/core/kits";
import { normalizeSubrace } from "../../src/core/races";
import { THIEF_SKILLS } from "../../src/core/proficiencies/thief-skills";
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
  it("has the 6 PHB races plus the 6 dwarf subraces", () => {
    expect(items).toHaveLength(12);
    expect(new Set(items.map((d) => sys(d).raceId))).toEqual(new Set(RACE_IDS));
    const subs = items.filter((d) => (sys(d).subrace as { id?: string } | undefined)?.id);
    expect(subs).toHaveLength(6);
    for (const d of subs) expect(sys(d).raceId).toBe("dwarf");
  });
  const DWARF = {
    "hill-dwarf":     { adj: { con: 1, cha: -1 }, ranges: [[8,18],[3,17],[11,18],[3,18],[3,18],[3,17]], infra: 60,  xp: 0,  conSave: 0, limits: { fighter: 15, cleric: 10, thief: 12 }, thief: [0, 10, 15, 0, 0, 0, -10, -5] },
    "mountain-dwarf":{ adj: { con: 1, cha: -1 }, ranges: [[8,18],[3,17],[11,19],[3,18],[3,18],[3,16]], infra: 60,  xp: 0,  conSave: 0, limits: { fighter: 16, cleric: 10, thief: 12 }, thief: [0, 10, 15, 0, 0, 0, -10, -5] },
    "deep-dwarf":    { adj: { con: 2, cha: -2 }, ranges: [[8,18],[3,16],[13,19],[3,18],[3,18],[3,15]], infra: 90,  xp: 10, conSave: 1, limits: { fighter: 14, cleric: 12, thief: 10 }, thief: [5, 0, 10, 0, 5, 0, -10, -15] },
    "duergar":       { adj: { con: 1, cha: -2 }, ranges: [[8,18],[3,17],[11,18],[3,16],[3,18],[3,15]], infra: 120, xp: 20, conSave: 0, limits: { fighter: 12, cleric: 12, thief: 14 }, thief: [5, 0, 10, 10, 5, 10, -10, -15] },
    "sundered-dwarf":{ adj: { str: 1, con: 1, cha: -1 }, ranges: [[8,18],[3,17],[11,18],[3,16],[3,18],[3,16]], infra: 30, xp: 0, conSave: 0, limits: { fighter: 14, cleric: 10, thief: 15 }, thief: [0, 5, 10, 5, 5, 0, 0, -10] },
    "gully-dwarf":   { adj: { str: 1, dex: 1, cha: -2 }, ranges: [[6,18],[6,18],[8,16],[3,12],[3,14],[3,12]], infra: 60, xp: 0, conSave: 0, limits: { fighter: 8, cleric: 8, thief: 16 }, thief: [10, -5, 5, 0, -5, 0, -5, -25] },
  } as const;

  it("every dwarf subrace matches The Complete Book of Dwarves (PHBR6 ch. 4)", () => {
    const subraces = items.filter((d) => (sys(d).subrace as { id?: string } | undefined)?.id);
    expect(subraces.map((d) => (sys(d).subrace as { id: string }).id).sort()).toEqual(Object.keys(DWARF).sort());
    for (const d of subraces) {
      const id = (sys(d).subrace as { id: keyof typeof DWARF }).id;
      const want = DWARF[id];
      const layer = normalizeSubrace(sys(d).subrace as never);
      expect(sys(d).raceId, id).toBe("dwarf");
      expect(layer.abilityAdjustments, id).toEqual(want.adj);
      expect(ABILITY_KEYS.map((k) => layer.abilityRanges![k]), id).toEqual(want.ranges);
      expect(layer.xpModifierPercent, id).toBe(want.xp);
      expect(layer.conSaveBonusAdjustment, id).toBe(want.conSave);
      expect(THIEF_SKILLS.map((s) => layer.thiefAdjustments![s]), id).toEqual(want.thief);
      expect(sys(d).infravision, id).toBe(want.infra);
      expect(sys(d).classLevelLimits, id).toEqual(want.limits);
      expect(sys(d).size, id).toBe("small");
      expect(sys(d).baseMovement, id).toBe(6);
      expect(sys(d).description, id).toBe("");
    }
  });
  it("race documents have unique names and 16-character ids", () => {
    expect(new Set(items.map((d) => d.name)).size).toBe(items.length);
    for (const d of items) {
      expect(String(d._id)).toHaveLength(16);
      expect(String(d._key)).toBe(`!items!${String(d._id)}`);
    }
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

describe("kits pack content", () => {
  const items = docs("kits");

  it("has four uniquely named and identified kit Items", () => {
    expect(items).toHaveLength(4);
    expect(new Set(items.map((d) => d._id)).size).toBe(4);
    expect(new Set(items.map((d) => d.name)).size).toBe(4);
    for (const d of items) {
      expect(d.type, String(d.name)).toBe("kit");
      expect(String(d._id)).toHaveLength(16);
      expect(String(d._key)).toBe(`!items!${String(d._id)}`);
      expect(String(d.name).startsWith("Sample"), String(d.name)).toBe(true);
    }
  });

  it("every kit is well-formed against the schema vocabularies", () => {
    for (const d of items) {
      const s = sys(d) as {
        chassisId: string;
        qualifications: { abilityMinimums: Record<string, number>; races: string[]; alignments: string[] };
        xpModifierPercent: number;
        effects: RawTraitEffect[];
        equipment: { armor: { mode: string; names: string[] }; weapons: { mode: string; names: string[] } };
      };
      expect(CLASS_IDS as readonly string[], String(d.name)).toContain(s.chassisId);
      expect(Object.keys(s.qualifications.abilityMinimums).sort()).toEqual([...ABILITY_KEYS].sort());
      for (const r of s.qualifications.races) expect(RACE_IDS as readonly string[]).toContain(r);
      for (const a of s.qualifications.alignments) expect(ALIGNMENTS as readonly string[]).toContain(a);
      expect(Number.isInteger(s.xpModifierPercent)).toBe(true);
      for (const e of s.effects) expect(toTraitEffect(e), String(d.name)).not.toBeNull();
      expect(EQUIPMENT_MODES as readonly string[]).toContain(s.equipment.armor.mode);
      expect(EQUIPMENT_MODES as readonly string[]).toContain(s.equipment.weapons.mode);
    }
  });

  it("every kit's powers are well-formed and at least one kit ships a finite and an at-will power", () => {
    let finite = 0;
    let atWill = 0;
    for (const d of items) {
      const raw = (sys(d) as { powers: { id: string }[] }).powers;
      expect(Array.isArray(raw), String(d.name)).toBe(true);
      const kept = normalizePowers(raw);
      expect(kept, `${String(d.name)} has a malformed or duplicate power`).toHaveLength(raw.length);
      for (const p of kept) {
        if (p.per === "at-will") atWill++;
        else finite++;
      }
    }
    expect(finite).toBeGreaterThan(0);
    expect(atWill).toBeGreaterThan(0);
  });

  it("the Sample Ghosthunter exercises casting-off, turning offset, removed abilities and level-scaled powers", () => {
    const ghost = items.find((d) => d.name === "Sample Ghosthunter");
    expect(ghost).toBeDefined();
    const s = sys(ghost!) as { chassisId: string; overrides: unknown; powers: unknown[] };
    expect(s.chassisId).toBe("paladin");
    const o = normalizeOverrides(s.overrides as never);
    expect(o).toEqual({ casting: "none", turning: { mode: "offset", offset: 0 }, removedAbilities: ["Laying on hands", "Immunity to disease", "Curing diseases"] });
    expect(CASTING_MODES as readonly string[]).toContain(o.casting);
    expect(TURNING_MODES as readonly string[]).toContain(o.turning.mode);
    const powers = normalizePowers(s.powers as never);
    expect(powers).toHaveLength(s.powers.length);
    const dispel = powers.find((p) => p.id === "dispel-evil")!;
    const remove = powers.find((p) => p.id === "remove-paralysis")!;
    expect([1, 5, 10, 15, 20].map((l) => powerUses(dispel, l))).toEqual([0, 1, 2, 3, 4]);
    expect([1, 5, 10, 15, 20].map((l) => powerUses(remove, l))).toEqual([3, 4, 5, 6, 7]);
  });
});
