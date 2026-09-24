// The plain-data view of a character the engine derives from. `snapshotActor`
// (src/data/actor/snapshot.ts) builds this from the Foundry Actor; deriveCharacter
// consumes only this. Fields beyond what 1c.3a uses (`classes`) are the forward
// contract Plan 1c.3b fills.
import type { AbilityScores, ClassId, Race, ThiefSkill, WizardSchool } from "../../../core/types";
import type { TraitEffect } from "../../../core/skills/traits";

export type DualClassState = "primary" | "active";

export interface ClassEntry {
  chassisId: ClassId;
  specialistSchool: WizardSchool | null;
  xp: number;
  hpRolls: readonly number[];
  dualClassState: DualClassState | null;
  /** the class item's own derived level (`system.level`) */
  level: number;
}

export interface MemorizedEntry {
  spellItemId: string;
  /** 1–9 */
  spellLevel: number;
}

export interface EquippedArmor {
  /** the armor's AC rating (10 none .. 1 plate) */
  baseArmorAc: number;
  magicBonus: number;
}

export interface EquippedShield {
  /** positive magnitude the shield lowers AC by */
  shieldBonus: number;
  magicBonus: number;
}

export interface TraitEntry {
  traitId: string;
  /** CP cost (negative = disadvantage) */
  cost: number;
  effect: TraitEffect;
}

export interface ActorSnapshot {
  /** post-racial-adjustment ability scores (CharacterModel.prepareBaseData applies the delta) */
  abilities: AbilityScores;
  /** `abilities.str.exceptional` — the d100 exceptional-Strength roll, or `null` */
  exceptionalStrengthPercentile: number | null;
  /** the embedded `race` item's `raceId`, or `null` for a race-less actor */
  race: Race | null;
  classes: readonly ClassEntry[];
  equippedArmor: EquippedArmor | null;
  equippedShield: EquippedShield | null;
  /** Σ totalWeight of every carried weapon/armor/equipment item, pounds */
  carriedWeight: number;
  /** memorized wizard spells — an entry per filled slot */
  wizardMemorized: readonly MemorizedEntry[];
  /** memorized priest spells — an entry per filled slot */
  priestMemorized: readonly MemorizedEntry[];
  spentWeaponSlots: number;
  spentNonweaponSlots: number;
  /** race item baseMovement, default 12 */
  baseMovement: number;
  /** authored thief/bard skill-point allocations — `system.thiefSkills.allocations` */
  thiefSkillAllocations: readonly { skill: ThiefSkill; allocatedPoints: number }[];
  /** every owned `trait` item whose stored effect is well-formed, in item order — applied only while the character-point build rule is on */
  traits: readonly TraitEntry[];
}
