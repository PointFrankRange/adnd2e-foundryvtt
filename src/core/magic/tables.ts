// PHB Table 21: WIZARD SPELL PROGRESSION (p.30; Appendix 8 p.247-248).
// PHB Table 24: PRIEST SPELL PROGRESSION (p.33; Appendix 8 p.247-248).
// PHB Table 22: WIZARD SPECIALIST REQUIREMENTS (p.31) — opposition schools.
// PHB p.33: the standard Cleric's sphere access.
// Both progression tables stop at character level 20; RAW gives no higher
// progression, so callers reuse the level-20 row for levels above 20.
import type { SphereAccess, SphereName, WizardSchool } from "../types";

/**
 * Wizard base spells/day, NO Intelligence or specialist bonus.
 * Row index 0 = wizard level 1 .. index 19 = wizard level 20.
 * Columns 0..8 = spell level 1..9.
 */
// prettier-ignore
export const WIZARD_SPELL_PROGRESSION: readonly (readonly number[])[] = [
  [1, 0, 0, 0, 0, 0, 0, 0, 0], // L1
  [2, 0, 0, 0, 0, 0, 0, 0, 0], // L2
  [2, 1, 0, 0, 0, 0, 0, 0, 0], // L3
  [3, 2, 0, 0, 0, 0, 0, 0, 0], // L4
  [4, 2, 1, 0, 0, 0, 0, 0, 0], // L5
  [4, 2, 2, 0, 0, 0, 0, 0, 0], // L6
  [4, 3, 2, 1, 0, 0, 0, 0, 0], // L7
  [4, 3, 3, 2, 0, 0, 0, 0, 0], // L8
  [4, 3, 3, 2, 1, 0, 0, 0, 0], // L9
  [4, 4, 3, 2, 2, 0, 0, 0, 0], // L10
  [4, 4, 4, 3, 3, 0, 0, 0, 0], // L11
  [4, 4, 4, 4, 4, 1, 0, 0, 0], // L12
  [5, 5, 5, 4, 4, 2, 0, 0, 0], // L13
  [5, 5, 5, 4, 4, 2, 1, 0, 0], // L14
  [5, 5, 5, 5, 5, 2, 1, 0, 0], // L15
  [5, 5, 5, 5, 5, 3, 2, 1, 0], // L16
  [5, 5, 5, 5, 5, 3, 3, 2, 0], // L17
  [5, 5, 5, 5, 5, 3, 3, 2, 1], // L18
  [5, 5, 5, 5, 5, 3, 3, 3, 1], // L19
  [5, 5, 5, 5, 5, 4, 3, 3, 2], // L20
];

/**
 * Priest base spells/day, NO Wisdom bonus spells.
 * Row index 0 = priest level 1 .. index 19 = priest level 20.
 * Columns 0..6 = spell level 1..7.
 * 6th-level slots require WIS >= 17; 7th-level slots require WIS >= 18.
 */
// prettier-ignore
export const PRIEST_SPELL_PROGRESSION: readonly (readonly number[])[] = [
  [1, 0, 0, 0, 0, 0, 0], // L1
  [2, 0, 0, 0, 0, 0, 0], // L2
  [2, 1, 0, 0, 0, 0, 0], // L3
  [3, 2, 0, 0, 0, 0, 0], // L4
  [3, 3, 1, 0, 0, 0, 0], // L5
  [3, 3, 2, 0, 0, 0, 0], // L6
  [3, 3, 2, 1, 0, 0, 0], // L7
  [3, 3, 3, 2, 0, 0, 0], // L8
  [4, 4, 3, 2, 1, 0, 0], // L9
  [4, 4, 3, 3, 2, 0, 0], // L10
  [5, 4, 4, 3, 2, 1, 0], // L11
  [6, 5, 5, 3, 2, 2, 0], // L12
  [6, 6, 6, 4, 2, 2, 0], // L13
  [6, 6, 6, 5, 3, 2, 1], // L14
  [6, 6, 6, 6, 4, 2, 1], // L15
  [7, 7, 7, 6, 4, 3, 1], // L16
  [7, 7, 7, 7, 5, 3, 2], // L17
  [8, 8, 8, 8, 6, 4, 2], // L18
  [9, 9, 8, 8, 6, 4, 2], // L19
  [9, 9, 9, 8, 7, 5, 2], // L20
];

/** All 16 priest spheres of influence (PHB p.33). */
// prettier-ignore
export const PRIEST_SPHERES: readonly SphereName[] = [
  "all", "animal", "astral", "charm", "combat", "creation", "divination", "elemental",
  "guardian", "healing", "necromantic", "plant", "protection", "summoning", "sun", "weather",
];

/**
 * The standard Cleric (PHB p.33): "major access to every sphere of influence
 * except the plant, animal, weather, and elemental spheres (he has minor access
 * to the elemental sphere and cannot cast spells of the other three)."
 * Spheres omitted here default to "none" via resolveSphereAccess().
 */
// prettier-ignore
export const CLERIC_SPHERE_ACCESS: Partial<Record<SphereName, SphereAccess>> = {
  all: "major", astral: "major", charm: "major", combat: "major", creation: "major",
  divination: "major", guardian: "major", healing: "major", necromantic: "major",
  protection: "major", summoning: "major", sun: "major",
  elemental: "minor",
  animal: "none", plant: "none", weather: "none",
};

export interface SpecialistProfile {
  school: WizardSchool;
  /** schools whose spells this specialist can never learn or cast (PHB Table 22) */
  opposition: readonly WizardSchool[];
}

/** PHB Table 22: WIZARD SPECIALIST REQUIREMENTS — opposition schools. */
// prettier-ignore
export const SPECIALIST_SCHOOLS: Readonly<Record<WizardSchool, SpecialistProfile>> = {
  abjuration:  { school: "abjuration",  opposition: ["alteration", "illusion"] },
  alteration:  { school: "alteration",  opposition: ["abjuration", "necromancy"] },
  conjuration: { school: "conjuration", opposition: ["divination", "invocation"] },
  divination:  { school: "divination",  opposition: ["conjuration"] },
  enchantment: { school: "enchantment", opposition: ["invocation", "necromancy"] },
  illusion:    { school: "illusion",    opposition: ["necromancy", "invocation", "abjuration"] },
  invocation:  { school: "invocation",  opposition: ["enchantment", "conjuration"] },
  necromancy:  { school: "necromancy",  opposition: ["illusion", "enchantment"] },
};
