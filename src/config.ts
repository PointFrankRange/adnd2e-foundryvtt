// Builds CONFIG.ADND2E (spec §6.1): enum -> i18n-label-key maps + coin rates.
// Pure and framework-free — assigned to `CONFIG.ADND2E` on `init` by system.ts,
// typed into the global scope by src/types/global.d.ts.
import type {
  AbilityKey,
  Alignment,
  ClassGroup,
  CreatureSize,
  EncumbranceCategory,
  MovementMode,
  SaveCategory,
  SpellSchool,
  SphereName,
} from "./core/types";

export type CurrencyKey = "pp" | "gp" | "ep" | "sp" | "cp";

export type WeaponStyleGroup =
  | "single-weapon"
  | "two-weapon"
  | "weapon-and-shield"
  | "two-handed-weapon";

/** Damage taxonomy for ActiveEffect tagging and resistances (broader than the weapon `DamageType`). */
export type ConfigDamageType =
  | "slashing"
  | "piercing"
  | "bludgeoning"
  | "acid"
  | "cold"
  | "electricity"
  | "fire"
  | "force"
  | "poison"
  | "sonic"
  | "necrotic"
  | "radiant";

/** Monstrous Manual intelligence descriptor bands (MM p.7). */
export type CreatureIntelligenceBand =
  | "non"
  | "animal"
  | "semi"
  | "low"
  | "average"
  | "very"
  | "high"
  | "exceptional"
  | "genius"
  | "supra-genius"
  | "godlike";

export type TreasureType =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
  | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";

export interface CurrencyDef {
  readonly label: string;
  /** value of one coin of this denomination in copper pieces (PHB p.69) */
  readonly inCp: number;
}

type LabelMap<K extends string> = Readonly<Record<K, string>>;

export interface Adnd2eConfig {
  readonly abilities: LabelMap<AbilityKey>;
  readonly saves: LabelMap<SaveCategory>;
  readonly classGroups: LabelMap<ClassGroup>;
  readonly schools: LabelMap<SpellSchool>;
  readonly spheres: LabelMap<SphereName>;
  readonly alignments: LabelMap<Alignment>;
  readonly sizes: LabelMap<CreatureSize>;
  readonly movementModes: LabelMap<MovementMode>;
  readonly damageTypes: LabelMap<ConfigDamageType>;
  readonly encumbranceCategories: LabelMap<EncumbranceCategory>;
  readonly creatureIntelligence: LabelMap<CreatureIntelligenceBand>;
  readonly treasureTypes: LabelMap<TreasureType>;
  readonly weaponStyleGroups: LabelMap<WeaponStyleGroup>;
  /** Reserved for the Combat & Tactics weapon-group rules (Sub-project 7). PHB core has no named groups. */
  readonly weaponProficiencyGroups: Readonly<Record<string, string>>;
  readonly currency: Readonly<Record<CurrencyKey, CurrencyDef>>;
}

/**
 * Freeze `node` and every nested object. Written with no dead branches: the
 * config object contains only strings and plain objects — never `null` — so a
 * bare `typeof v === "object"` test suffices and both arms are exercised.
 */
function deepFreeze(node: Record<string, unknown>): void {
  Object.freeze(node);
  for (const v of Object.values(node)) {
    if (typeof v === "object") deepFreeze(v as Record<string, unknown>);
  }
}

export function buildAdnd2eConfig(): Adnd2eConfig {
  const cfg: Adnd2eConfig = {
    abilities: {
      str: "ADND2E.abilities.str",
      dex: "ADND2E.abilities.dex",
      con: "ADND2E.abilities.con",
      int: "ADND2E.abilities.int",
      wis: "ADND2E.abilities.wis",
      cha: "ADND2E.abilities.cha",
    },
    saves: {
      ppd: "ADND2E.saves.ppd",
      rsw: "ADND2E.saves.rsw",
      pp: "ADND2E.saves.pp",
      bw: "ADND2E.saves.bw",
      spell: "ADND2E.saves.spell",
    },
    classGroups: {
      warrior: "ADND2E.classGroups.warrior",
      wizard: "ADND2E.classGroups.wizard",
      priest: "ADND2E.classGroups.priest",
      rogue: "ADND2E.classGroups.rogue",
    },
    schools: {
      abjuration: "ADND2E.schools.abjuration",
      alteration: "ADND2E.schools.alteration",
      conjuration: "ADND2E.schools.conjuration",
      divination: "ADND2E.schools.divination",
      enchantment: "ADND2E.schools.enchantment",
      illusion: "ADND2E.schools.illusion",
      invocation: "ADND2E.schools.invocation",
      necromancy: "ADND2E.schools.necromancy",
      "lesser-divination": "ADND2E.schools.lesser-divination",
      wild: "ADND2E.schools.wild",
    },
    spheres: {
      all: "ADND2E.spheres.all",
      animal: "ADND2E.spheres.animal",
      astral: "ADND2E.spheres.astral",
      charm: "ADND2E.spheres.charm",
      combat: "ADND2E.spheres.combat",
      creation: "ADND2E.spheres.creation",
      divination: "ADND2E.spheres.divination",
      elemental: "ADND2E.spheres.elemental",
      guardian: "ADND2E.spheres.guardian",
      healing: "ADND2E.spheres.healing",
      necromantic: "ADND2E.spheres.necromantic",
      plant: "ADND2E.spheres.plant",
      protection: "ADND2E.spheres.protection",
      summoning: "ADND2E.spheres.summoning",
      sun: "ADND2E.spheres.sun",
      weather: "ADND2E.spheres.weather",
    },
    alignments: {
      "lawful-good": "ADND2E.alignments.lawful-good",
      "neutral-good": "ADND2E.alignments.neutral-good",
      "chaotic-good": "ADND2E.alignments.chaotic-good",
      "lawful-neutral": "ADND2E.alignments.lawful-neutral",
      "true-neutral": "ADND2E.alignments.true-neutral",
      "chaotic-neutral": "ADND2E.alignments.chaotic-neutral",
      "lawful-evil": "ADND2E.alignments.lawful-evil",
      "neutral-evil": "ADND2E.alignments.neutral-evil",
      "chaotic-evil": "ADND2E.alignments.chaotic-evil",
    },
    sizes: {
      tiny: "ADND2E.sizes.tiny",
      small: "ADND2E.sizes.small",
      medium: "ADND2E.sizes.medium",
      large: "ADND2E.sizes.large",
      huge: "ADND2E.sizes.huge",
      gargantuan: "ADND2E.sizes.gargantuan",
    },
    movementModes: {
      land: "ADND2E.movementModes.land",
      burrow: "ADND2E.movementModes.burrow",
      climb: "ADND2E.movementModes.climb",
      fly: "ADND2E.movementModes.fly",
      swim: "ADND2E.movementModes.swim",
    },
    damageTypes: {
      slashing: "ADND2E.damageTypes.slashing",
      piercing: "ADND2E.damageTypes.piercing",
      bludgeoning: "ADND2E.damageTypes.bludgeoning",
      acid: "ADND2E.damageTypes.acid",
      cold: "ADND2E.damageTypes.cold",
      electricity: "ADND2E.damageTypes.electricity",
      fire: "ADND2E.damageTypes.fire",
      force: "ADND2E.damageTypes.force",
      poison: "ADND2E.damageTypes.poison",
      sonic: "ADND2E.damageTypes.sonic",
      necrotic: "ADND2E.damageTypes.necrotic",
      radiant: "ADND2E.damageTypes.radiant",
    },
    encumbranceCategories: {
      unencumbered: "ADND2E.encumbranceCategories.unencumbered",
      light: "ADND2E.encumbranceCategories.light",
      moderate: "ADND2E.encumbranceCategories.moderate",
      heavy: "ADND2E.encumbranceCategories.heavy",
      severe: "ADND2E.encumbranceCategories.severe",
      immobile: "ADND2E.encumbranceCategories.immobile",
    },
    creatureIntelligence: {
      non: "ADND2E.creatureIntelligence.non",
      animal: "ADND2E.creatureIntelligence.animal",
      semi: "ADND2E.creatureIntelligence.semi",
      low: "ADND2E.creatureIntelligence.low",
      average: "ADND2E.creatureIntelligence.average",
      very: "ADND2E.creatureIntelligence.very",
      high: "ADND2E.creatureIntelligence.high",
      exceptional: "ADND2E.creatureIntelligence.exceptional",
      genius: "ADND2E.creatureIntelligence.genius",
      "supra-genius": "ADND2E.creatureIntelligence.supra-genius",
      godlike: "ADND2E.creatureIntelligence.godlike",
    },
    treasureTypes: Object.fromEntries(
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => [l, `ADND2E.treasureTypes.${l}`]),
    ) as LabelMap<TreasureType>,
    weaponStyleGroups: {
      "single-weapon": "ADND2E.weaponStyleGroups.single-weapon",
      "two-weapon": "ADND2E.weaponStyleGroups.two-weapon",
      "weapon-and-shield": "ADND2E.weaponStyleGroups.weapon-and-shield",
      "two-handed-weapon": "ADND2E.weaponStyleGroups.two-handed-weapon",
    },
    weaponProficiencyGroups: {},
    currency: {
      pp: { label: "ADND2E.currency.pp", inCp: 500 },
      gp: { label: "ADND2E.currency.gp", inCp: 100 },
      ep: { label: "ADND2E.currency.ep", inCp: 50 },
      sp: { label: "ADND2E.currency.sp", inCp: 10 },
      cp: { label: "ADND2E.currency.cp", inCp: 1 },
    },
  };
  // CONFIG.ADND2E is frozen: later sub-projects and third-party modules extend it
  // by adding to buildAdnd2eConfig(), not by mutating CONFIG at runtime.
  deepFreeze(cfg as unknown as Record<string, unknown>);
  return cfg;
}
