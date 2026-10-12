import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CLASS_IDS } from "../../src/data/item/choices";
import { isRaceSlug } from "../../src/core/races/slug";

// Independently keyed PHBR10 Table 1 (p.9): Wr Wz Pr Rg; "-" = no class of the group, "U" = unlimited
const TABLE_1: Record<string, [string, string, string, string]> = {
  aarakocra: ["11", "-", "7", "11"], alaghi: ["12", "-", "11", "-"], beastman: ["12", "-", "-", "10"],
  bugbear: ["12", "-", "8", "9"], bullywug: ["10", "-", "7", "9"], centaur: ["12", "12", "14", "12"],
  fremlin: ["-", "10", "-", "11"], "giant-kin-firbolg": ["12", "-", "7", "-"], "giant-kin-voadkyn": ["11", "8", "7", "10"],
  gnoll: ["11", "-", "9", "11"], "gnoll-flind": ["12", "-", "9", "11"], goblin: ["10", "-", "9", "12"],
  hobgoblin: ["11", "-", "9", "11"], kobold: ["8", "-", "9", "12"], "lizard-man": ["12", "-", "7", "9"],
  minotaur: ["12", "8", "7", "10"], mongrelman: ["10", "10", "10", "12"], ogre: ["12", "-", "3", "-"],
  "half-ogre": ["12", "-", "4", "-"], "ogre-mage": ["9", "8", "7", "8"], orc: ["10", "-", "9", "11"],
  "half-orc": ["10", "-", "4", "8"], pixie: ["7", "-", "-", "12"], satyr: ["11", "-", "-", "11"],
  "saurial-bladeback": ["9", "9", "U", "9"], "saurial-finback": ["U", "9", "9", "9"],
  "saurial-flyer": ["9", "9", "9", "U"], "saurial-hornhead": ["9", "U", "9", "9"],
  swanmay: ["14", "-", "12", "-"], wemic: ["12", "-", "7", "10"],
};

const NAMES: Record<string, string> = {
  aarakocra: "Aarakocra", alaghi: "Alaghi", beastman: "Beastman", bugbear: "Bugbear", bullywug: "Bullywug",
  centaur: "Centaur", fremlin: "Fremlin", "giant-kin-firbolg": "Giant-kin, Firbolg", "giant-kin-voadkyn": "Giant-kin, Voadkyn",
  gnoll: "Gnoll", "gnoll-flind": "Gnoll, Flind", goblin: "Goblin", hobgoblin: "Hobgoblin", kobold: "Kobold",
  "lizard-man": "Lizard Man", minotaur: "Minotaur", mongrelman: "Mongrelman", ogre: "Ogre", "half-ogre": "Ogre, Half-",
  "ogre-mage": "Ogre Mage", orc: "Orc", "half-orc": "Orc, Half-", pixie: "Pixie", satyr: "Satyr",
  "saurial-bladeback": "Saurial, Bladeback", "saurial-finback": "Saurial, Finback", "saurial-flyer": "Saurial, Flyer",
  "saurial-hornhead": "Saurial, Hornhead", swanmay: "Swanmay", wemic: "Wemic",
};

/** Races whose only priest option is a Chapter 3 kit (shaman and the like): no cleric/druid chassis, the limit lives in a feature label. */
const DEFERRED_PRIEST: string[] = ["aarakocra", "bullywug", "giant-kin-firbolg", "giant-kin-voadkyn", "lizard-man", "minotaur", "ogre", "ogre-mage", "wemic"];

const GROUPS: Record<number, string[]> = {
  0: ["fighter", "ranger", "paladin"],
  1: ["mage"],
  2: ["cleric", "druid"],
  3: ["thief", "bard"],
};
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

const dir = path.resolve(__dirname, "..", "..", "packs", "races", "_source");
type Range = { min: number; max: number };
type Sys = {
  description: string; raceId: string; size: string; baseMovement: number; infravision: number; naturalAc: number | null;
  classLevelLimits: Record<string, number | null>; allowedClasses: string[]; allowedMulticlass: string[][]; grantedFeatures: string[];
  subrace: { id: string; displayName: string; abilityAdjustments: Record<string, number>; abilityRanges: Record<string, Range>; xpModifierPercent: number };
};
type Item = { _id: string; _key: string; name: string; system: Sys };
const load = (slug: string): Item | null => {
  const file = path.join(dir, `${slug}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Item) : null;
};

describe("PHBR10 humanoid race items", () => {
  const ids = new Set<string>();
  for (const [slug, row] of Object.entries(TABLE_1)) {
    const item = load(slug);
    describe(slug, () => {
      it.runIf(item)("is structurally valid", () => {
        const it_ = item!;
        const s = it_.system;
        expect(isRaceSlug(slug)).toBe(true);
        expect(s.raceId).toBe(slug);
        expect(it_.name).toBe(NAMES[slug]);
        expect(it_._id).toMatch(/^[A-Za-z0-9]{16}$/);
        expect(it_._key).toBe(`!items!${it_._id}`);
        expect(ids.has(it_._id)).toBe(false);
        ids.add(it_._id);
        expect(s.description).toBe("");
        expect(["small", "medium", "large"]).toContain(s.size);
        expect(Number.isInteger(s.baseMovement) && s.baseMovement >= 1 && s.baseMovement <= 30).toBe(true);
        expect(Number.isInteger(s.infravision) && s.infravision >= 0).toBe(true);
        expect(s.naturalAc === null || (Number.isInteger(s.naturalAc) && s.naturalAc >= -10 && s.naturalAc <= 10)).toBe(true);
        expect(s.subrace.id).toBe("");
        expect(s.subrace.displayName).toBe("");
        for (const k of ABILITIES) {
          const r = s.subrace.abilityRanges[k];
          expect(r.min <= r.max && r.min >= 1 && r.max <= 25, `${slug} ${k}`).toBe(true);
        }
        const adj = s.subrace.abilityAdjustments as Record<string, number>;
        expect(Object.keys(adj).every((k) => ABILITIES.includes(k))).toBe(true);
        expect(Number.isInteger(s.subrace.xpModifierPercent) && s.subrace.xpModifierPercent >= -90).toBe(true);
        const allowed = s.allowedClasses as string[];
        for (const c of allowed) expect(CLASS_IDS as readonly string[]).toContain(c);
        for (const combo of s.allowedMulticlass as string[][]) {
          expect(combo.length).toBeGreaterThanOrEqual(2);
          expect(new Set(combo).size).toBe(combo.length);
          for (const c of combo) expect(allowed, `${slug} ${combo.join("/")}`).toContain(c);
        }
        const limits = s.classLevelLimits as Record<string, number | null>;
        for (const [c, v] of Object.entries(limits)) {
          expect(allowed).toContain(c);
          expect(v === null || (Number.isInteger(v) && v >= 1 && v <= 30)).toBe(true);
        }
        expect(new Set(allowed)).toEqual(new Set(Object.keys(limits)));
      });

      it.runIf(item)("agrees with Table 1", () => {
        const s = item!.system;
        const limits = s.classLevelLimits as Record<string, number | null>;
        const deferred = DEFERRED_PRIEST.includes(slug);
        for (let g = 0; g < 4; g++) {
          if (g === 2 && deferred) {
            expect(Object.keys(limits).some((c) => c === "cleric" || c === "druid")).toBe(false);
            expect((s.grantedFeatures as string[]).some((f) => /\(kit\) max level \d+/.test(f))).toBe(true);
            continue;
          }
          const inGroup = Object.keys(limits).filter((c) => GROUPS[g]!.includes(c));
          let got: string;
          if (inGroup.length === 0) got = "-";
          else if (inGroup.some((c) => limits[c] === null)) got = "U";
          else got = String(Math.max(...inGroup.map((c) => limits[c] as number)));
          expect(got, `${slug} group ${g}`).toBe(row[g]);
        }
      });

      it.runIf(item)("has no unlisted psionicist data and no kit class ids", () => {
        const s = item!.system;
        const allowed = s.allowedClasses as string[];
        expect(Object.keys(s.classLevelLimits).every((c) => allowed.includes(c))).toBe(true);
        for (const c of allowed) expect(CLASS_IDS as readonly string[]).toContain(c);
        if (Object.keys(s.classLevelLimits).includes("psionicist")) expect(allowed).toContain("psionicist");
      });
    });
  }

  it("DEFERRED_PRIEST names only keyed races", () => {
    for (const slug of DEFERRED_PRIEST) expect(TABLE_1[slug]).toBeDefined();
  });

  describe("full pack", () => {
    const slugs = Object.keys(TABLE_1);
    const items = slugs.map((slug) => load(slug)).filter((i): i is Item => i !== null);
    const all = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as Item);

    it("ships all thirty humanoids, one per Table 1 slug", () => {
      expect(slugs).toHaveLength(30);
      expect(items).toHaveLength(30);
      expect(new Set(items.map((i) => i.system.raceId))).toEqual(new Set(slugs));
    });

    it("gives no two humanoids the same name", () => {
      const names = items.map((i) => i.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("holds exactly the 6 PHB races, 22 subraces and 30 humanoids", () => {
      expect(all).toHaveLength(58);
      const humanoid = all.filter((i) => slugs.includes(i.system.raceId));
      const subraces = all.filter((i) => (i.system.subrace?.id ?? "") !== "");
      const phb = all.filter((i) => (i.system.subrace?.id ?? "") === "" && !slugs.includes(i.system.raceId));
      expect(humanoid).toHaveLength(30);
      expect(subraces).toHaveLength(22);
      expect(phb).toHaveLength(6);
    });

    it("keeps the deferred-priest rule exact", () => {
      for (const slug of slugs) {
        const limits = load(slug)!.system.classLevelLimits;
        const hasPriest = "cleric" in limits || "druid" in limits;
        if (DEFERRED_PRIEST.includes(slug)) expect(hasPriest, `${slug} deferred`).toBe(false);
        else if (TABLE_1[slug]![2] !== "-") expect(hasPriest, `${slug} priest`).toBe(true);
        else expect(hasPriest, `${slug} no priest`).toBe(false);
      }
    });

    it("names only allowed classes in every multi-class combination", () => {
      for (const i of items) {
        for (const combo of i.system.allowedMulticlass) {
          for (const c of combo) expect(i.system.allowedClasses, `${i.system.raceId} ${combo.join("/")}`).toContain(c);
        }
      }
    });
  });
});
