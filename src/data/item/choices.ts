// The enumerations the Item and Actor DataModel schemas validate against. Kept here as
// plain arrays (not in the schema files) so they are unit-testable against the
// engine unions — defineSchema() imports these and stays logic-free.
import type { AbilityKey, Alignment, ClassId, CreatureSize, EncumbranceCategory, MovementMode, NonweaponGroup, Race, SpellSchool, SphereName, WizardSchool } from "../../core/types";
import type { DamageType, WeaponCategory, WeaponSize } from "../../core/weapons/data";
import type { ClassArrangement } from "../derive/character/multiclass";

export const CLASS_IDS: readonly ClassId[] = [
  "fighter", "mage", "cleric", "thief", "paladin", "ranger", "druid", "bard",
];

export const RACE_IDS: readonly Race[] = [
  "human", "dwarf", "elf", "gnome", "half-elf", "halfling",
];

export const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export const WIZARD_SCHOOLS: readonly WizardSchool[] = [
  "abjuration", "alteration", "conjuration", "divination",
  "enchantment", "illusion", "invocation", "necromancy",
];

/** The nine schools of magic + Wild (= core `SpellSchool`). */
export const SPELL_SCHOOLS: readonly SpellSchool[] = [...WIZARD_SCHOOLS, "lesser-divination", "wild"];

export const SPHERE_NAMES: readonly SphereName[] = [
  "all", "animal", "astral", "charm", "combat", "creation", "divination", "elemental",
  "guardian", "healing", "necromantic", "plant", "protection", "summoning", "sun", "weather",
];

export const DAMAGE_TYPES: readonly DamageType[] = [
  "slashing", "piercing", "bludgeoning", "piercing-slashing", "piercing-bludgeoning",
];

export const WEAPON_SIZES: readonly WeaponSize[] = ["S", "M", "L"];

export const WEAPON_CATEGORIES: readonly WeaponCategory[] = ["melee", "thrown", "bow", "crossbow"];

export const NONWEAPON_GROUPS: readonly NonweaponGroup[] = [
  "general", "warrior", "wizard", "priest", "rogue",
];

export const CREATURE_SIZES: readonly CreatureSize[] = [
  "tiny", "small", "medium", "large", "huge", "gargantuan",
];

export const CASTER_CLASSES: readonly string[] = ["wizard", "priest"];
export const SAVING_THROW_KINDS: readonly string[] = ["none", "negates", "half", "special"];
export const DUAL_CLASS_STATES: readonly string[] = ["primary", "active"];
export const FEATURE_SOURCE_TYPES: readonly string[] = ["class", "kit", "race", "other"];
export const FEATURE_ACTIVATIONS: readonly string[] = ["passive", "action", "daily"];

export const ALIGNMENTS: readonly Alignment[] = [
  "lawful-good", "neutral-good", "chaotic-good",
  "lawful-neutral", "true-neutral", "chaotic-neutral",
  "lawful-evil", "neutral-evil", "chaotic-evil",
];

export const MOVEMENT_MODES: readonly MovementMode[] = ["land", "burrow", "climb", "fly", "swim"];

/** Character advancement arrangement (= `ClassArrangement`). */
export const MULTICLASS_MODES: readonly ClassArrangement[] = ["single", "multiclass", "dualclass"];

/** Encumbrance categories (= core `EncumbranceCategory`), lightest to heaviest. */
export const ENCUMBRANCE_CATEGORIES: readonly EncumbranceCategory[] = [
  "unencumbered", "light", "moderate", "heavy", "severe", "immobile",
];

export const DISPOSITIONS: readonly string[] = ["friendly", "neutral", "hostile"];
export const SAVE_MODES: readonly string[] = ["explicit", "asClass"];
export const ATTACK_TYPES: readonly string[] = ["melee", "ranged"];
