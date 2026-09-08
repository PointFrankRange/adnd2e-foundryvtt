// PHB Table 21: WIZARD SPELL PROGRESSION (p.30; Appendix 8 p.247-248).
// PHB Table 24: PRIEST SPELL PROGRESSION (p.33; Appendix 8 p.247-248).
// PHB Table 22: WIZARD SPECIALIST REQUIREMENTS (p.31) — opposition schools.
// PHB p.33: the standard Cleric's sphere access.
// Both progression tables stop at character level 20; RAW gives no higher
// progression, so callers reuse the level-20 row for levels above 20.
import type { AbilityKey, SphereAccess, SphereName, WizardSchool } from "../types";

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

/**
 * PHB Table 17: PALADIN SPELL PROGRESSION (p.28). Row 0 = paladin level 9 …
 * row 11 = level 20. Columns = priest spell levels 1-4. No Wisdom bonus spells.
 */
// prettier-ignore
export const PALADIN_SPELL_PROGRESSION: readonly (readonly number[])[] = [
  [1, 0, 0, 0], // L9
  [2, 0, 0, 0], // L10
  [2, 1, 0, 0], // L11
  [2, 2, 0, 0], // L12
  [2, 2, 1, 0], // L13
  [3, 2, 1, 0], // L14
  [3, 2, 1, 1], // L15
  [3, 3, 2, 1], // L16
  [3, 3, 3, 1], // L17
  [3, 3, 3, 1], // L18
  [3, 3, 3, 2], // L19
  [3, 3, 3, 3], // L20
];

/**
 * PHB Table 18: RANGER ABILITIES (p.28), priest-spell columns. Row 0 = ranger
 * level 1 … row 15 = level 16. Columns = priest spell levels 1-3. No Wisdom
 * bonus spells (PHB p.29). Levels above 16 reuse the level-16 row.
 */
// prettier-ignore
export const RANGER_SPELL_PROGRESSION: readonly (readonly number[])[] = [
  [0, 0, 0], // L1
  [0, 0, 0], // L2
  [0, 0, 0], // L3
  [0, 0, 0], // L4
  [0, 0, 0], // L5
  [0, 0, 0], // L6
  [0, 0, 0], // L7
  [1, 0, 0], // L8
  [2, 0, 0], // L9
  [2, 1, 0], // L10
  [2, 2, 0], // L11
  [2, 2, 1], // L12
  [3, 2, 1], // L13
  [3, 2, 2], // L14
  [3, 3, 2], // L15
  [3, 3, 3], // L16
];

/**
 * PHB Table 32: BARD SPELL PROGRESSION (p.42). Row 0 = bard level 1 … row 19 =
 * level 20. Columns = wizard spell levels 1-6. Bards cast wizard spells and
 * never specialise.
 */
// prettier-ignore
export const BARD_SPELL_PROGRESSION: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0, 0], // L1
  [1, 0, 0, 0, 0, 0], // L2
  [2, 0, 0, 0, 0, 0], // L3
  [2, 1, 0, 0, 0, 0], // L4
  [3, 1, 0, 0, 0, 0], // L5
  [3, 2, 0, 0, 0, 0], // L6
  [3, 2, 1, 0, 0, 0], // L7
  [3, 3, 1, 0, 0, 0], // L8
  [3, 3, 2, 0, 0, 0], // L9
  [3, 3, 2, 1, 0, 0], // L10
  [3, 3, 3, 1, 0, 0], // L11
  [3, 3, 3, 2, 0, 0], // L12
  [3, 3, 3, 2, 1, 0], // L13
  [3, 3, 3, 3, 1, 0], // L14
  [3, 3, 3, 3, 2, 0], // L15
  [4, 3, 3, 3, 2, 1], // L16
  [4, 4, 3, 3, 3, 1], // L17
  [4, 4, 4, 3, 3, 2], // L18
  [4, 4, 4, 4, 3, 2], // L19
  [4, 4, 4, 4, 4, 3], // L20
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

/**
 * The Druid (PHB p.35): major access to all, animal, elemental, healing, plant,
 * and weather; minor access to divination. Spheres omitted default to "none".
 */
// prettier-ignore
export const DRUID_SPHERE_ACCESS: Partial<Record<SphereName, SphereAccess>> = {
  all: "major", animal: "major", elemental: "major", healing: "major", plant: "major", weather: "major",
  divination: "minor",
};

export interface SpecialistProfile {
  school: WizardSchool;
  /** schools whose spells this specialist can never learn or cast (PHB Table 22) */
  opposition: readonly WizardSchool[];
  /** PHB Table 22: the ability score a character needs to take this specialty */
  minAbility: { ability: AbilityKey; score: number };
}

/** PHB Table 22: WIZARD SPECIALIST REQUIREMENTS — opposition schools. */
// prettier-ignore
export const SPECIALIST_SCHOOLS: Readonly<Record<WizardSchool, SpecialistProfile>> = {
  abjuration:  { school: "abjuration",  opposition: ["alteration", "illusion"],                minAbility: { ability: "wis", score: 15 } },
  alteration:  { school: "alteration",  opposition: ["abjuration", "necromancy"],              minAbility: { ability: "dex", score: 15 } },
  conjuration: { school: "conjuration", opposition: ["divination", "invocation"],              minAbility: { ability: "con", score: 15 } },
  divination:  { school: "divination",  opposition: ["conjuration"],                           minAbility: { ability: "wis", score: 16 } },
  enchantment: { school: "enchantment", opposition: ["invocation", "necromancy"],              minAbility: { ability: "cha", score: 16 } },
  illusion:    { school: "illusion",    opposition: ["necromancy", "invocation", "abjuration"], minAbility: { ability: "dex", score: 16 } },
  invocation:  { school: "invocation",  opposition: ["enchantment", "conjuration"],            minAbility: { ability: "con", score: 16 } },
  necromancy:  { school: "necromancy",  opposition: ["illusion", "enchantment"],               minAbility: { ability: "wis", score: 16 } },
};
