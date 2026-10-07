import type {
  ArmorType, CharismaModifiers, ConstitutionModifiers, DexterityModifiers, IntelligenceModifiers,
  StrengthModifiers, ThiefSkill, WisdomModifiers,
} from "../../core/types";
import type { Contact } from "../../core/psionics/combat";
import type { Discipline, PowerKind, PowerProgressionRow, RecoveryActivity } from "../../core/psionics";
import type { OptionalRules } from "../../core/options";
import type { SubraceLayer } from "../../core/races";
import type { FatigueTier } from "../../core/magic/channeller-fatigue";
import type { SubAbilityId } from "../../core/abilities/sub-abilities";
import type { CharacterPointLedger } from "../../core/skills/character-points";
import type { RawTraitEffect } from "../../core/skills/traits";
import type { FavoriteRow } from "../kit/favorites";
import type { LockState } from "../kit/lock";
import type { InventorySection } from "../kit/inventory-sections";

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
  /** Sub-project 8 Plan 8c: every owned `trait` item. Absent = none (the NPC sheet never sets it). */
  traitItems?: TraitItemView[];
  /** CONFIG.ADND2E — label maps only */
  config: Adnd2eConfigView;
  perms: { isGM: boolean; isOwner: boolean; editable: boolean };
  /** the full `OptionalRules` bag (game.settings, read once by sheet.ts) —
   *  consumed by several builders (Learn Spell's per-level cap, combat maneuver
   *  and weapon-mastery gating, ...) */
  optionalRules: OptionalRules;
  /** SP11 Plan C: caster types a kit switched off (absent = none) */
  castingDisabled?: { wizard: boolean; priest: boolean };
  /** Sub-project 8 Plan 8a: true ONLY when this sheet renders the sub-score
   *  inputs (the PC sheet, with `subAbilitiesEnabled(rules)` true). Optional so
   *  every other consumer of this builder — notably the NPC sheet, which shares
   *  this same builder and its rendered pc-ability.hbs partial — is off by
   *  default. */
  subAbilityUi?: boolean;
  /** Sub-project 9a: the in-progress cast; absent/null when idle or the rule is off */
  castingStatus?: CastingStatusInput | null;
  /** Sub-project 14 Plan C: the actor's current fatigue tier, read directly
   *  from live status effects — present regardless of the rule's current
   *  on/off state (a condition already applied keeps affecting the sheet
   *  even if the rule is later toggled off, matching how every other
   *  condition in this project works). Null only while genuinely unfatigued.
   *  Only `vitals.canRecoverFatigue` (context-types.ts, computed from this
   *  same input's `optionalRules`) additionally checks the rule's live state. */
  fatigueTier?: FatigueTier | null;
  /** sheet redesign R1: the viewer's unlock state (never persisted) */
  unlocked?: boolean;
  /** raw flags.adnd2e.favorites */
  favorites?: unknown;
  /** SP15 Plan A: the psionic state, or null/absent when the actor has no psionicist class entry */
  psionics?: PsionicsInput | null;
}

/** SP15 Plan A: one owned `power` item as the Psionics view reads it. */
export interface PsionicPowerItem {
  id: string;
  name: string;
  discipline: Discipline;
  kind: PowerKind;
  abilityKey: string;
  abilityModifier: number;
  initialCost: number;
  costNote: string;
  maintenanceCost: number;
  maintenanceUnit: "none" | "round" | "turn" | "hour";
  range: string;
  scoreBonus: number;
}

export interface PsionicsInput {
  /** persisted pool; null = full */
  psp: number | null;
  max: number;
  level: number;
  /** SP15 Plan D: the pool is a wild talent's (no Table 4 budget, no relearning); absent = false */
  wild?: boolean;
  maintained: { powerId: string }[];
  /** SP15 Plan C: the raised defense-mode power id ("" = none) */
  activeDefense: string;
  /** SP15 Plan C: open psychic contacts */
  contacts: Contact[];
  /** prepared ability scores keyed str..cha */
  abilityScores: Record<string, number>;
  powers: PsionicPowerItem[];
}

export interface PsionicPowerRow {
  id: string;
  name: string;
  kind: PowerKind;
  /** ability score + ability modifier + relearn bonus */
  score: number;
  cost: number;
  costNote: string;
  maintenance: number;
  /** "none" when the power is not maintained */
  unit: string;
  range: string;
  scoreBonus: number;
  canUse: boolean;
  canRelearn: boolean;
  /** SP15 Plan C: a psionic attack mode (gets an Attack button) */
  isAttackMode: boolean;
}

export interface PsionicsView {
  psp: number;
  max: number;
  level: number;
  /** SP15 Plan D: the pool is a wild talent's */
  wild: boolean;
  row: PowerProgressionRow;
  primary: Discipline | null;
  activities: RecoveryActivity[];
  maintained: { powerId: string; name: string; cost: number; unit: string }[];
  groups: { discipline: Discipline; powers: PsionicPowerRow[] }[];
  defense: PsionicPowerRow[];
  /** SP15 Plan C: psionic combat state */
  combat: {
    activeDefense: { id: string; name: string } | null;
    defenses: { id: string; name: string; selected: boolean }[];
    contacts: { target: string; name: string; tangents: number; full: boolean }[];
    hasUpkeep: boolean;
  };
  /** i18n keys of over-budget warnings */
  problems: string[];
}

/** Sub-project 9a: the in-progress cast, assembled by sheet.ts ONLY while the casting-time rule is on. */
export interface CastingStatusInput {
  spellName: string;
  startRound: number;
  completeRound: number | null;
  segments: number | null;
  /** the cast's combat round, or null when that combat no longer exists / has not started */
  combatRound: number | null;
  /** it is currently the caster's combatant's turn */
  isCasterTurn: boolean;
}

export interface CastingPanel {
  spellName: string;
  /** i18n key taking a `value` argument */
  detailKey: string;
  detailValue: number;
  canComplete: boolean;
  canGmControl: boolean;
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
      /** Sub-project 14 Plan A. The whole field is optional (test fixtures may
       *  omit it entirely); every subfield is ALSO optional because real system
       *  data's `ObjectField` default is `{}` (present but empty) whenever the
       *  rule is off or the actor has no wizard levels — never a fully-populated
       *  object with some fields missing, but never "undefined" from live data
       *  either. Always default with `?? {}` before reading a subfield. */
      spellPoints?: {
        maxSpellLevel?: number; maxPerLevel?: number; sp?: number; spent?: number; remaining?: number;
      };
      /** Sub-project 14 Plan B. Same "?? {}"-defaulting story as spellPoints
       *  above. `current` is PERSISTED (never overwritten by
       *  prepareDerivedData); `max` is derived-overwritten every prepare
       *  cycle. */
      channelling?: { current?: number; max?: number };
      memorized: { spellItemId: string | null; spellLevel: number; expended: boolean; magickType?: "fixed" | "free" }[];
    };
    priest: {
      slots: Record<string, { max: number; used: number }>;
      /** Sub-project 14 priest theurgies. Mirrors wizard.spellPoints: optional
       *  subfields, always defaulted with `?? {}` before reading. */
      spellPoints?: {
        maxSpellLevel?: number; maxPerLevel?: number; sp?: number; spent?: number; remaining?: number;
      };
      /** Sub-project 14 priest channelling. Same "?? {}" defaulting as spellPoints. */
      channelling?: { current?: number; max?: number };
      /** `spellItemId` is null for a free theurgy (it reserves a level and scope, not a spell). */
      memorized: {
        spellItemId: string | null; spellLevel: number; expended: boolean;
        magickType?: "fixed" | "free"; theurgyScope?: "major" | "minor" | "universal";
      }[];
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
  /** SP11: the owning kit's XP modifier percent (absent = 0) */
  xpModifierPercent?: number;
  /** SP13: the racial level limit for this class (absent/null = unlimited) */
  levelLimit?: number | null;
  /** SP13: 0 = hard limit; 2-4 = each level beyond it costs that many times the XP */
  beyondMultiplier?: number;
}

export interface RaceItemView {
  id: string; name: string; img: string;
  raceId: string; size: string; baseMovement: number; infravision: number;
  grantedFeatures: string[]; bonusLanguages: string[];
  /** SP12 Plan A: the subrace layer (null/absent = the plain base race) */
  subrace?: SubraceLayer | null;
}

export interface PhysicalItemView {
  id: string; name: string; img: string; type: "weapon" | "armor" | "equipment" | "ammo";
  quantity: number; weight: number; totalWeight: number;
  location: string; equipped: boolean; identified: boolean; magicBonus: number;
  /** SP11: equipped but not permitted by the class or kit — shows a warning mark (never set on unequipped items) */
  restricted?: boolean;
  /** equipment only */
  isContainer: boolean; capacity: number | null; contentsWeightMultiplier: number;
  /** weapon only — pre-derived display strings */
  weapon?: {
    damageVsSM: string | null; damageVsL: string | null; speedFactor: number; range: string | null;
    category: "melee" | "thrown" | "bow" | "crossbow";
    /** blank means "use this item's own display `name`" for proficiency
     *  matching — see WeaponItemModel's baseWeaponName field doc comment. */
    baseWeaponName: string;
    /** the weapon's own group tag (e.g. "Blades") — used to match a GROUP
     *  weapon proficiency, mirroring combat-rolls.ts's roll-time lookup. */
    proficiencyGroup: string;
    /** PHB Table 35 bucket for this weapon's specialist attacks/round rate —
     *  "" means unset (no rate shown). See WeaponItemModel's own field doc. */
    specialistWeaponClass: string;
    damageType: "slashing" | "piercing" | "bludgeoning" | "piercing-slashing" | "piercing-bludgeoning" | null;
    /** bow/crossbow only — what ammo this weapon takes, and the actor's currently-selected ammo item id */
    ammoType: string | null;
    selectedAmmoId: string | null;
  };
  /** armor only */
  armor?: { baseAc: number; isShield: boolean; shieldAcBonus: number; armorType: ArmorType };
  /** ammo only */
  ammo?: {
    ammoType: string;
    damageVsSM: string; damageVsL: string;
    damageType: "slashing" | "piercing" | "bludgeoning" | "piercing-slashing" | "piercing-bludgeoning";
  };
}

export interface WeaponProfView {
  id: string; name: string; weaponOrGroup: string; isGroup: boolean;
  /** Sub-project 8b's weapon-group tag (e.g. "Blades") — blank on a group
   *  proficiency or a pre-8b/hand-made one that hasn't had it set. Drives
   *  `category`'s resolution before falling back to an owned-weapon lookup. */
  proficiencyGroup: string;
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
  /** sheet redesign R1: true when this skill is in the actor's favorites list */
  favorite: boolean;
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
  /** sheet redesign R1: true when this spell is in the actor's favorites list */
  favorite: boolean;
  /** priest-only (optional so existing fixtures stay valid): true when this row is
   *  not memorized and priestAccessScope finds no sphere access for it — the sheet
   *  shows a hint in place of the Memorize button. */
  outsideSpheres?: boolean;
}
export interface FeatureItemView {
  id: string; name: string; img: string;
  sourceType: string; activation: string;
  uses: { value: number; max: number; per: string } | null;
  description: string;
}
export interface TraitItemView {
  id: string; name: string; img: string;
  traitId: string; cost: number;
  /** the stored flat effect (`system.effect`) */
  effect: RawTraitEffect;
}

/* ---------- output (consumed by the templates) ---------- */

export interface SubScoreCell {
  /** the sub-ability id, e.g. "muscle" */
  id: SubAbilityId;
  /** i18n key — templates wrap it in `{{localize}}` */
  label: string;
  /** the form field name, e.g. "system.abilities.str.sub.a" */
  name: string;
  /** the AUTHORED sub-score, null when unset */
  value: number | null;
  /** the authored main score the derivation falls back to while `value` is null */
  placeholder: number;
}

export interface TraitRow {
  id: string; name: string; img: string; cost: number;
  /** false for a malformed (inert) trait */
  active: boolean;
  /** signed, e.g. "+4"; "—" for an inert trait */
  summaryAmount: string;
  /** i18n key of what the amount applies to */
  summaryTargetKey: string;
  canRemove: boolean;
}

export interface AbilityRow {
  key: string; label: string;
  score: number; racialDelta: number;
  /** the ability-bonus portion of `effectiveScore - score` attributable to an
   *  owned trait (e.g. the "Powerful" trait's +1 STR) — previously lumped
   *  into `racialDelta`, now split out so the sheet doesn't mislabel it. */
  traitDelta: number;
  effectiveScore: number;
  exceptional: number | null; showExceptional: boolean;
  mods: {
    label: string; value: string;
    /** sheet redesign R1 dev-world fix 1: the labelled mini-box's short caption i18n key */
    shortKey: string;
    /** sheet redesign R1 dev-world fix 1: the mini-box's hover-title (long name) i18n key */
    longKey: string;
    /** sheet redesign R1 dev-world fix 1: the formatted value (formatAbilityMod) */
    display: string;
  }[];
  /** true while sub-scores derive the main score — the main input renders `disabled` */
  scoreLocked: boolean;
  /** the two sub-score cells, or null when the sub-score UI is off */
  subs: SubScoreCell[] | null;
}
export interface SaveRow {
  key: string; label: string; target: number; rollModifier: number; effectiveTarget: number;
  /** sheet redesign R1 dev-world fix 3: the header saves strip's short caption i18n key */
  shortLabel: string;
}
export interface ClassRow {
  id: string; name: string; chassisId: string; level: number;
  xp: number; xpToNextLevel: number | null; xpPct: number; nextThreshold: number | null;
  /** SP13: at a hard racial level limit */
  atLimit: boolean;
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
    /** the owned race item's id (for the header's edit/delete controls), or null */
    raceItemId: string | null;
    classLine: string;
    arrangementBadge: string | null;
    alignmentValue: string;
  };
  abilities: AbilityRow[];
  subAbilities: { enabled: boolean; canSeed: boolean };
  vitals: {
    hp: { value: number; max: number; temp: number; nonlethal: number };
    thac0: { base: number; melee: number; ranged: number };
    ac: { normal: number; rearAttack: number; surprised: number; shieldless: number };
    saves: SaveRow[];
    movement: { base: number; current: number; encumbranceCategory: string; encumbranceCategoryLabel: string };
    /** Sub-project 9a: true while a cast is in progress — drives the AC badge */
    casting: boolean;
    /** Sub-project 14 Plan C: null while unfatigued. `hintKey` is the full
     *  i18n key of a pre-written recovery-hint sentence for this tier's rest
     *  interval (see FATIGUE_HINT_KEY in context.ts) — not interpolated, so
     *  each tier's sentence reads grammatically correctly. */
    fatigue: { label: string; hintKey: string } | null;
    /** Whole-branch review M2: distinct from `fatigue` being non-null — the
     *  badge/panel and its movement/combat penalties show regardless of the
     *  rule's current on/off state, but the Recover button additionally
     *  requires the `channellerFatigue` rule to still be on (a stale
     *  condition from before the rule was toggled off should still affect
     *  the sheet, but should not offer a recovery path the rule no longer
     *  sanctions). */
    canRecoverFatigue: boolean;
  };
  classes: ClassRow[];
  dualClassToggle: { available: boolean; on: boolean };
  inventory: {
    containers: ContainerGroup[];
    loose: PhysicalItemView[];
    encumbrance: EncumbranceGauge;
    currency: { pp: number; gp: number; ep: number; sp: number; cp: number };
    locationOptions: { value: string; label: string }[];
    /** sheet redesign R1: the inventory tab's item-table sections */
    sections: InventorySection[];
  };
  combat: {
    weapons: {
      id: string; name: string; equipped: boolean; toHitNote: string; damageNote: string;
      speedFactor: number; range: string | null; canBackstab: boolean; favorite: boolean;
      /** bow/crossbow only — null for melee/thrown, which render no ammo selector */
      ammoType: string | null;
      ammoOptions: { value: string; label: string; selected: boolean }[];
      /** true when this weapon's effective mastery tier is Grand Mastery (3)
       *  — weaponMasteryEffect's extraAttacks: 1. Display-only: nothing in
       *  this codebase gates re-clicking Roll Attack, so this just tells the
       *  player they're entitled to a second attack this round; it does not
       *  track or limit how many times they actually click it. */
      grandMasteryExtraAttack: boolean;
      /** PHB Table 35: this weapon's specialist attacks-per-round rate, when
       *  the actor is a single-class fighter Specialized (mastery tier ≥ 1)
       *  in this weapon AND its `specialistWeaponClass` is set — null
       *  otherwise. Display-only, same static-rate philosophy as
       *  `grandMasteryExtraAttack` (no live combat-round tracking): shows
       *  e.g. "3 attacks / 2 rounds", the player tracks which round
       *  themselves. Independent of `grandMasteryExtraAttack` — both can
       *  apply to the same weapon at once. */
      specialistAttackRate: { attacks: number; rounds: number } | null;
    }[];
    acBreakdown: { label: string; value: number }[];
    armor: { id: string; name: string; equipped: boolean; isShield: boolean; baseAc: number }[];
    maneuverOptions: { value: string; label: string }[];
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
    /** Orisons (Table 2 level-0 priest spells): listed apart from `known`. Empty unless the priest pool rule is on. */
    orisons: SpellItemView[];
    orphaned: OrphanedSpellRow[];
    /** Sub-project 9a: the in-progress cast's panel, or null when idle/the rule is off */
    casting: CastingPanel | null;
    /** Sub-project 14 Plan A: null when the rule is off or the actor has no wizard levels */
    spellPoints: { max: number; spent: number; remaining: number } | null;
    /** Sub-project 14 Plan B: null when Channellers is off or the actor has no wizard levels */
    channelling: { current: number; max: number } | null;
    /** Sub-project 14 priest channelling: the priest's channelling pool, null unless Channellers is on under the priest pool rule and a priest max is derived. */
    priestChannelling: { current: number; max: number } | null;
    /** Sub-project 14 Plan A: one row per currently-memorized free magick, across all levels */
    freeMagicks: { level: number; expended: boolean; canCast: boolean }[];
    /** Sub-project 14 priest theurgies: true when the priest pool rule applies
     *  (a cleric/druid caster with the spell-points rule on). Gates the free-theurgy section. */
    priestPoolOn: boolean;
    /** Sub-project 14 priest theurgies: the priest pool's SP bar. null when the
     *  rule is off, the actor has no priest-progression caster, or channelling replaces the pool. */
    priestSpellPoints: { max: number; spent: number; remaining: number } | null;
    /** Sub-project 14 priest theurgies: one row per spell level (1-7) that has a
     *  free memorize available at major and/or universal scope. Empty when the
     *  priest pool is absent. */
    priestFreeMemorize: { level: number; major: boolean; universal: boolean }[];
    /** Sub-project 14 priest theurgies: one row per memorized free theurgy */
    priestFreeTheurgies: {
      level: number;
      scope: "major" | "universal";
      /** i18n key for the scope's label (ADND2E.sheet.spells.freeTheurgyMajor / ...Universal) */
      scopeLabelKey: string;
      expended: boolean;
      canCast: boolean;
      /** True when the row is blocked only by the missing priest spell (no
       *  qualifying spell for its scope and level); the template shows the reason in place of Cast. */
      noEligibleSpell: boolean;
    }[];
  };
  features: {
    groups: { sourceType: string; sourceTypeLabel: string; items: FeatureItemView[] }[];
    racialAbilities: string[];
    /** SP12 Plan A: the subrace XP-per-level surcharge percent (0 = none) */
    racialXpPercent: number;
    /** the same as a display string: "+20%", "-10%", or "" when 0 */
    racialXpLabel: string;
    languagesMax: number;
    resources: { reputation: string; henchmen: string; followers: string };
  };
  traits: {
    /** true only while the ledger exists, i.e. the character-point build rule is on */
    enabled: boolean;
    canEditPool: boolean;
    /** the authored pool */
    pool: number;
    ledger: CharacterPointLedger | null;
    rows: TraitRow[];
    /** disadvantage refunds exceed the cap, so part of them is not returned */
    refundCapped: boolean;
  };
  biography: { detailFields: string[]; showGmNotes: boolean };
  tabs: TabDescriptor[];
  /** SP15 Plan A: null without a psionicist class entry (the Psionics tab is then absent) */
  psionics: PsionicsView | null;
  /** sheet redesign R1: the sheet's edit lock */
  lock: LockState;
  /** sheet redesign R1: the Favorites panel */
  favorites: { canFavorite: boolean; rows: FavoriteRow[] };
}
