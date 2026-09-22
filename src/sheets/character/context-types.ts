import type {
  ArmorType, CharismaModifiers, ConstitutionModifiers, DexterityModifiers, IntelligenceModifiers,
  StrengthModifiers, ThiefSkill, WisdomModifiers,
} from "../../core/types";
import type { OptionalRules } from "../../core/options";

/* ---------- input (assembled by sheet.ts from plain data) ---------- */

export interface CharacterSheetInput {
  name: string;
  img: string;
  /** document._source.system — authored values, for <input> binding */
  source: Record<string, unknown>;
  /** the prepared system.* — derived/cached values */
  derived: CharacterDerivedView;
  classItems: ClassItemView[];
  raceItem: RaceItemView | null;
  physicalItems: PhysicalItemView[];
  proficiencyItems: { weapon: WeaponProfView[]; nonweapon: NwpView[] };
  /** raw allocation entries read straight off the actor — not item-backed,
   *  unlike weapon/nonweapon proficiencies (thief skills are percentage
   *  allocations, not owned Items). */
  thiefSkillAllocations: { skill: ThiefSkill; allocatedPoints: number }[];
  spellItems: SpellItemView[];
  featureItems: FeatureItemView[];
  /** CONFIG.ADND2E — label maps only */
  config: Adnd2eConfigView;
  perms: { isGM: boolean; isOwner: boolean; editable: boolean };
  /** the 8-key core optional-rules bag (game.settings, read once by sheet.ts) —
   *  only `maxSpellsPerLevel` is consumed so far (Learn Spell's per-level cap) */
  optionalRules: OptionalRules;
}

export interface Adnd2eConfigView {
  abilities: Record<string, string>;
  saves: Record<string, string>;
  alignments: Record<string, string>;
  encumbranceCategories: Record<string, string>;
  classGroups: Record<string, string>;
  schools: Record<string, string>;
  spheres: Record<string, string>;
}

export interface CharacterDerivedView {
  abilities: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", {
    score: number;
    mods: StrengthModifiers | DexterityModifiers | ConstitutionModifiers
      | IntelligenceModifiers | WisdomModifiers | CharismaModifiers;
  }>;
  classes: { chassisId: string; level: number; canLevelUp: boolean }[];
  multiclass: {
    mode: "single" | "multiclass" | "dualclass";
    dualClass: { dormantChassisId: string | null; activeChassisId: string | null; surpassed: boolean };
    hpAveraged: boolean;
  };
  attributes: {
    hp: { value: number; max: number; temp: number; nonlethal: number };
    thac0: { base: number; melee: number; ranged: number };
    ac: { normal: number; rearAttack: number; surprised: number; shieldless: number };
    movement: { base: number; current: number; encumbranceCategory: string };
    encumbrance: {
      carried: number; category: string; movementRate: number;
      penalty: { attackRoll: number; armorClass: number }; baseMove: number;
    };
  };
  saves: Record<"ppd" | "rsw" | "pp" | "bw" | "spell",
    { target: number; rollModifier: number; effectiveTarget: number }>;
  spellcasting: {
    wizard: {
      specialistSchool: string | null;
      slots: Record<string, { max: number; used: number }>;
      memorized: { spellItemId: string; spellLevel: number; expended: boolean }[];
    };
    priest: {
      slots: Record<string, { max: number; used: number }>;
      memorized: { spellItemId: string; spellLevel: number; expended: boolean }[];
      sphereAccessOverride: string[] | null;
    };
  };
  proficiencies: {
    weapon: { total: number; spent: number; available: number };
    nonweapon: { total: number; spent: number; available: number };
  };
  thiefSkills: { total: number; spent: number; available: number };
  languagesKnown: { max: number };
}

export interface ClassItemView {
  id: string; name: string; img: string;
  chassisId: string; hitDie: number;
  xp: number; level: number; canLevelUp: boolean;
  dualClassState: "primary" | "active" | null;
  specialistSchool: string | null;
}

export interface RaceItemView {
  id: string; name: string; img: string;
  raceId: string; size: string; baseMovement: number; infravision: number;
  grantedFeatures: string[]; bonusLanguages: string[];
}

export interface PhysicalItemView {
  id: string; name: string; img: string; type: "weapon" | "armor" | "equipment";
  quantity: number; weight: number; totalWeight: number;
  location: string; equipped: boolean; identified: boolean; magicBonus: number;
  /** equipment only */
  isContainer: boolean; capacity: number | null; contentsWeightMultiplier: number;
  /** weapon only — pre-derived display strings */
  weapon?: {
    damageVsSM: string | null; damageVsL: string | null; speedFactor: number; range: string | null;
    category: "melee" | "thrown" | "bow" | "crossbow";
    damageType: "slashing" | "piercing" | "bludgeoning" | "piercing-slashing" | "piercing-bludgeoning" | null;
  };
  /** armor only */
  armor?: { baseAc: number; isShield: boolean; shieldAcBonus: number; armorType: ArmorType };
}

export interface WeaponProfView {
  id: string; name: string; weaponOrGroup: string; isGroup: boolean;
  slotsInvested: number; masteryTier: 0 | 1 | 2 | 3;
  /** filled by context.ts's buildWeaponProfRow — sheet.ts's toWeaponProfView
   *  placeholder is null/false until then, same pattern as NwpView's
   *  governingAbilityLabel/checkTarget. The weapon-category this proficiency
   *  resolves to (by matching `weaponOrGroup` against the actor's owned
   *  weapon Items by name) — null when it's a group proficiency (groups are
   *  never specialization-eligible) or no matching weapon Item is found. */
  category: "melee" | "crossbow" | "bow" | null;
  /** i18n key for the current masteryTier (null at tier 0 — "proficient
   *  only" has no badge). */
  masteryTierLabelKey: string | null;
  /** true when this proficiency can advance to the next mastery tier right
   *  now: not a group, a resolved category exists, the actor's (first)
   *  class allows specialization, the actor is single-classed, it isn't
   *  already at tier 3 (Grand Mastery), enough weapon slots are available
   *  for the next tier, and the weaponMastery optional rule (gated by the
   *  combatAndTacticsEnabled master switch) is on. */
  canAdvanceMastery: boolean;
}
export interface NwpView {
  id: string; name: string; governingAbility: string; modifier: number;
  slotCost: number; slotsInvested: number; isRacial: boolean;
  /** i18n key for governingAbility — filled by buildNwpRow; "" until then */
  governingAbilityLabel: string;
  /** ability score + modifier + (slotsInvested-1) — the real pre-roll
   *  target (situational modifier isn't known until Roll time, so it's
   *  never part of this display value). */
  checkTarget: number | null;
}

export interface ThiefSkillRow {
  skill: ThiefSkill;
  /** i18n key, e.g. "ADND2E.chat.thiefSkill.skills.pickPockets" */
  label: string;
  /** thiefSkillBaseScore/bardSkillBaseScore — before allocated points */
  base: number;
  allocated: number;
  /** resolveThiefSkill's result — base + allocated, capped at 95 */
  effective: number;
  /** available pool > 0 AND (thief only) per-skill cap not yet reached */
  canAllocate: boolean;
  canDeallocate: boolean;
  /** false only for "read-languages" on a thief below level 4 (PHB p.40) —
   *  the skill is computable at any level but not usable yet. Bards have no
   *  such prerequisite. Always true for every other skill. */
  usable: boolean;
}
export interface SpellItemView {
  id: string; name: string; img: string; casterClass: string; level: number;
  schools: string[]; spheres: string[]; range: string; castingTime: string; savingThrow: string;
  inSpellbook: boolean;
  /** filled by buildSpells (context.ts) — sheet.ts's toSpellView sets placeholders,
   *  same pattern as NwpView's governingAbilityLabel/checkTarget. */
  memorized: boolean;
  expended: boolean;
  canMemorize: boolean;
  canCast: boolean;
  /** wizard-only: true when this spell is NOT yet in the spellbook and
   *  core/magic/spellbook.ts's canLearnSpell allows attempting to learn it */
  canLearn: boolean;
}
export interface FeatureItemView {
  id: string; name: string; img: string;
  sourceType: string; activation: string;
  uses: { value: number; max: number; per: string } | null;
  description: string;
}

/* ---------- output (consumed by the templates) ---------- */

export interface AbilityRow {
  key: string; label: string;
  score: number; racialDelta: number; effectiveScore: number;
  exceptional: number | null; showExceptional: boolean;
  mods: { label: string; value: string }[];
}
export interface SaveRow {
  key: string; label: string; target: number; rollModifier: number; effectiveTarget: number;
}
export interface ClassRow {
  id: string; name: string; chassisId: string; level: number;
  xp: number; xpToNextLevel: number | null; xpPct: number; nextThreshold: number | null;
  canLevelUp: boolean; hitDie: number;
  isDualPrimary: boolean; isDualActive: boolean; specialistSchool: string | null;
}
export interface SlotRow { level: number; max: number; used: number }
export interface OrphanedSpellRow { spellItemId: string; casterClass: "wizard" | "priest"; spellLevel: number }
export interface ContainerGroup {
  item: PhysicalItemView; contents: PhysicalItemView[];
  usedWeight: number; capacity: number | null; overCapacity: boolean;
}
export interface EncumbranceGauge {
  carried: number; category: string; categoryLabel: string;
  movementRate: number; baseMove: number;
  penalty: { attackRoll: number; armorClass: number };
}
export interface TabDescriptor { id: string; label: string; icon: string }

export interface CharacterSheetContext {
  identity: {
    name: string; img: string;
    raceName: string | null;
    classLine: string;
    arrangementBadge: string | null;
    alignmentValue: string;
  };
  abilities: AbilityRow[];
  vitals: {
    hp: { value: number; max: number; temp: number; nonlethal: number };
    thac0: { base: number; melee: number; ranged: number };
    ac: { normal: number; rearAttack: number; surprised: number; shieldless: number };
    saves: SaveRow[];
    movement: { base: number; current: number; encumbranceCategory: string; encumbranceCategoryLabel: string };
  };
  classes: ClassRow[];
  dualClassToggle: { available: boolean; on: boolean };
  inventory: {
    containers: ContainerGroup[];
    loose: PhysicalItemView[];
    encumbrance: EncumbranceGauge;
    currency: { pp: number; gp: number; ep: number; sp: number; cp: number };
    locationOptions: { value: string; label: string }[];
  };
  combat: {
    weapons: { id: string; name: string; equipped: boolean; toHitNote: string; damageNote: string; speedFactor: number; range: string | null; canBackstab: boolean }[];
    acBreakdown: { label: string; value: number }[];
    armor: { id: string; name: string; equipped: boolean; isShield: boolean; baseAc: number }[];
  };
  skills: {
    weapon: { total: number; spent: number; available: number; items: WeaponProfView[] };
    nonweapon: { total: number; spent: number; available: number; items: NwpView[] };
    /** null when the actor's class has no thief-skill access at all
     *  (`ClassChassis.thiefSkillAccess` is null) — the whole section is
     *  hidden/shows a placeholder in that case. */
    thief: {
      total: number; spent: number; available: number;
      /** true when the actor's worn armor disables thief skills entirely
       *  (classifyThiefArmor) — the whole section still renders (so the
       *  explanatory message has somewhere to live) but every roll/allocate
       *  button is hidden. */
      armorDisabled: boolean;
      items: ThiefSkillRow[];
    } | null;
  };
  spells: {
    wizardSlots: SlotRow[] | null;
    priestSlots: SlotRow[] | null;
    specialistSchoolLabel: string | null;
    known: { level: number; items: SpellItemView[] }[];
    orphaned: OrphanedSpellRow[];
  };
  features: {
    groups: { sourceType: string; sourceTypeLabel: string; items: FeatureItemView[] }[];
    racialAbilities: string[];
    languagesMax: number;
    resources: { reputation: string; henchmen: string; followers: string };
  };
  biography: { detailFields: string[]; showGmNotes: boolean };
  tabs: TabDescriptor[];
}
