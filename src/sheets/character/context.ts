import type { AbilityScores, ArmorType, BardSkill, ClassId, DexterityModifiers, IntelligenceModifiers, Race, SphereName, WizardSchool } from "../../core/types";
import type {
  AbilityRow,
  CastingPanel,
  CharacterDerivedView,
  CharacterSheetContext,
  CharacterSheetInput,
  ClassRow,
  EncumbranceGauge,
  FeatureItemView,
  NwpView,
  OrphanedSpellRow,
  PhysicalItemView,
  SaveRow,
  SlotRow,
  SpellItemView,
  PsionicPowerRow,
  PsionicsInput,
  PsionicsView,
  WildTalentView,
  TabDescriptor,
  ThiefSkillRow,
  TraitRow,
  WeaponProfView,
} from "./context-types";
import { mainScoreFromSubs, SUB_ABILITIES } from "../../core/abilities/sub-abilities";
import { applyRacialDeltas } from "../../core/abilities/racial-adjustments";
import { effectiveAbilityAdjustments, effectiveThiefAdjustments } from "../../core/races";
import { getChassis } from "../../core/classes/chassis";
import { isPriestPoolProgression, isPriestSpellProgression } from "../../core/magic/class-slots";
import { MANEUVERS } from "../../core/combat/maneuvers";
import { canAffordCast, channellersEnabled } from "../../core/magic/channellers";
import { channellerFatigueEnabled, FATIGUE_CONDITION_ID, FATIGUE_RECOVERY_INTERVAL, fatigueMovementRate } from "../../core/magic/channeller-fatigue";
import { canCompleteCasting } from "../../core/magic/casting-time";
import { canLearnSpell } from "../../core/magic/spellbook";
import { characterPointLedgerFor, DEFAULT_CHARACTER_POINT_POOL } from "../../core/skills/character-points";
import { toTraitEffect, type TraitEffect } from "../../core/skills/traits";
import { canWeaponSpecialize, categoryForProficiencyGroup } from "../../core/proficiencies/weapon";
import { weaponMasteryTierCost } from "../../core/proficiencies/weapon-mastery";
import { bardSkillBaseScore, classifyThiefArmor, resolveBardSkill, resolveThiefSkill, thiefSkillBaseScore, thiefSkillPerSkillCap } from "../../core/proficiencies/thief-skills";
import { canBackstab } from "../../core/weapons/backstab";
import { specialistAttacksPerRound } from "../../core/weapons/specialist-attacks";
import type { AttackRate, SpecialistWeaponClass } from "../../core/weapons/specialist-attacks";
import { matchingAmmo, defaultAmmoSelection } from "../../combat/ammo";
import type { AmmoStock } from "../../combat/ammo";
import { WIZARD_SCHOOLS } from "../../data/item/choices";
import { canMemorizePriestSpell, priestAccessScope, priestFreeCastEligible, priestHasMajorAccessAtLevel } from "../../magic/priest-sphere-access";
import {
  priestCanAffordCast, priestChannellingCost, priestPoolAffords, priestPoolUnderChannelling, type PriestPoolView,
} from "../../core/magic/priest-spell-points";
import { magickCost, spellPointsEnabled, spellsMemorizedAtLevel } from "../../core/magic/spell-points";
import { orisonAffords, orisonCap } from "../../core/magic/priest-orisons";
import { classItemLevel } from "../../data/derive/class-item";
import { CONDITIONS } from "../../conditions";
import { groupInventory } from "./grouping";
import { xpToNext } from "./xp";
import { FULL_CONTACT, isAttackMode, isDefenseMode, upkeepDue } from "../../core/psionics/combat";
import { canRelearn, DISCIPLINES, powerProgression, powerScore, primaryDiscipline, type KnownPower } from "../../core/psionics";
import { levelRulesOf } from "../../core/classes/level-limits";
import { buildFavoriteRows, isFavorite, normalizeFavorites, type FavoriteKind } from "../kit/favorites";
import { lockState } from "../kit/lock";
import { buildInventorySections } from "../kit/inventory-sections";
import { formatAbilityMod } from "../kit/ability-mods";

/* ---------------------------------------------------------------------------
 * `buildCharacterSheetContext` — the pure PC-sheet render-context builder.
 *
 * Input: plain actor data (already read off the document by sheet.ts).
 * Output: plain data the Handlebars templates print directly.
 *
 * No Foundry, no i18n resolution: the builder emits i18n *keys* and passes
 * `config.*` label strings through untouched; templates call `{{localize}}`.
 * ------------------------------------------------------------------------- */

type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
/** sheet redesign R1: checks whether a (kind, id) pair is in the actor's
 *  favorites list — threaded into every builder whose rows carry a
 *  `favorite` flag. */
type FavCheck = (kind: FavoriteKind, id: string) => boolean;

const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const SAVE_KEYS = ["ppd", "rsw", "pp", "bw", "spell"] as const;
const DETAIL_FIELDS: readonly string[] = [
  "age",
  "sex",
  "height",
  "weight",
  "hairEyes",
  "homeland",
  "deity",
  "kit",
];

// sheet redesign R1: the six PC-sheet tabs — must match sheet.ts's static TABS
// (id + icon) exactly; the NPC/creature sheets don't read `adnd2e.tabs` (they
// use core ApplicationV2 tab navigation off their own static TABS), so this
// list is PC-only.
const TABS_DEF: readonly TabDescriptor[] = [
  { id: "main", label: "ADND2E.sheet.tabs.main", icon: "fa-solid fa-user" },
  { id: "inventory", label: "ADND2E.sheet.tabs.inventory", icon: "fa-solid fa-box-open" },
  { id: "proficiencies", label: "ADND2E.sheet.tabs.proficiencies", icon: "fa-solid fa-hand-fist" },
  { id: "spells", label: "ADND2E.sheet.tabs.spells", icon: "fa-solid fa-wand-sparkles" },
  { id: "features", label: "ADND2E.sheet.tabs.features", icon: "fa-solid fa-star" },
  { id: "journal", label: "ADND2E.sheet.tabs.journal", icon: "fa-solid fa-book" },
];

const PSIONICS_TAB: TabDescriptor = { id: "psionics", label: "ADND2E.sheet.tabs.psionics", icon: "fa-solid fa-brain" };

const PSIONIC_ACTIVITIES = ["hard", "light", "rest", "sleep"] as const;

/** SP15 Plan A: the Psionics tab view; null when the actor has no psionicist class (input null/absent). */
/** SP15 Plan D: the Wild talent panel - shown when the rule is on and the actor is not an active psionicist. */
export function buildWildTalentView(input: CharacterSheetInput): WildTalentView {
  const w = input.wildTalent;
  return {
    show: input.optionalRules.wildTalents && !!w && (w.psionicLevel === 0 || w.wild),
    tested: w?.tested ?? false,
    found: w?.found ?? false,
    isGm: input.perms.isGM,
  };
}

export function buildPsionicsView(input: PsionicsInput | null | undefined): PsionicsView | null {
  if (!input) return null;
  const psp = Math.min(input.psp ?? input.max, input.max);
  const known: KnownPower[] = input.powers.map((p) => ({ id: p.id, name: p.name, discipline: p.discipline, kind: p.kind, scoreBonus: p.scoreBonus }));
  const row = powerProgression(input.level);
  const wild = input.wild ?? false;
  const toRow = (p: PsionicsInput["powers"][number]): PsionicPowerRow => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    score: powerScore(input.abilityScores[p.abilityKey] ?? 0, p.abilityModifier + p.scoreBonus),
    cost: p.initialCost,
    costNote: p.costNote,
    maintenance: p.maintenanceCost,
    unit: p.maintenanceUnit,
    range: p.range,
    scoreBonus: p.scoreBonus,
    canUse: psp >= p.initialCost,
    canRelearn: !wild && canRelearn(known, p.id, input.level).ok,
    isAttackMode: isAttackMode(p.name),
  });
  const byId = new Map(input.powers.map((p) => [p.id, p]));
  const maintained = input.maintained.flatMap((m) => {
    const p = byId.get(m.powerId);
    return p ? [{ powerId: p.id, name: p.name, cost: p.maintenanceCost, unit: p.maintenanceUnit }] : []; // an orphan entry (its power item is gone) is skipped
  });
  const defenses = input.powers.filter((p) => p.kind === "defense" && isDefenseMode(p.name)).map((p) => ({ id: p.id, name: p.name, selected: p.id === input.activeDefense }));
  const used = (kind: PsionicPowerRow["kind"]): number => known.filter((k) => k.kind === kind).reduce((n, k) => n + 1 + k.scoreBonus, 0);
  const disciplinesHeld = new Set(known.filter((k) => k.kind !== "defense").map((k) => k.discipline)).size;
  const problems = wild ? [] : [
    ...(disciplinesHeld > row.disciplines ? ["ADND2E.sheet.psionics.problem.disciplines"] : []),
    ...(used("science") > row.sciences ? ["ADND2E.sheet.psionics.problem.sciences"] : []),
    ...(used("devotion") > row.devotions ? ["ADND2E.sheet.psionics.problem.devotions"] : []),
    ...(used("defense") > row.defenseModes ? ["ADND2E.sheet.psionics.problem.defenseModes"] : []),
  ];
  return {
    psp,
    max: input.max,
    level: input.level,
    wild,
    row,
    primary: primaryDiscipline(known),
    activities: [...PSIONIC_ACTIVITIES],
    maintained,
    groups: DISCIPLINES.map((discipline) => ({
      discipline,
      powers: input.powers.filter((p) => p.discipline === discipline && p.kind !== "defense").map(toRow),
    })).filter((g) => g.powers.length > 0),
    defense: input.powers.filter((p) => p.kind === "defense").map(toRow),
    combat: {
      activeDefense: defenses.filter((d) => d.selected).map((d) => ({ id: d.id, name: d.name }))[0] ?? null, // a stale or non-defense id resolves to none
      defenses,
      contacts: input.contacts.map((c) => ({ target: c.target, name: c.name, tangents: c.tangents, full: c.tangents >= FULL_CONTACT })),
      hasUpkeep: upkeepDue(input.contacts) > 0,
    },
    problems,
  };
}

/** Shape of `input.source._source.system` that the builder actually touches. */
interface SourceView {
  system: {
    abilities: Record<
      AbilityKey,
      { score: number; exceptional: number | null; sub?: { a: number | null; b: number | null } | null }
    >;
    details: { alignment: string };
    currency: { pp: number; gp: number; ep: number; sp: number; cp: number };
    resources: { reputation: string; henchmen: string; followers: string };
    options?: { skillsAndPowers?: { characterPoints?: { pool?: number } } };
  };
}

/* ---------- local helpers (identical camelCase/snake/kebab → Title Case) ---------- */

function titleCase(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function humanize(key: string): string {
  return titleCase(key);
}

/* ---------- identity ---------- */

function buildIdentity(input: CharacterSheetInput): CharacterSheetContext["identity"] {
  const src = input.source as unknown as SourceView;
  return {
    name: input.name,
    img: input.img,
    raceName: input.raceItem?.name ?? null,
    raceItemId: input.raceItem?.id ?? null,
    classLine: buildClassLine(input),
    arrangementBadge: buildArrangementBadge(input),
    alignmentValue: src.system.details.alignment,
  };
}

function buildClassLine(input: CharacterSheetInput): string {
  const mc = input.derived.multiclass;
  if (mc.mode === "dualclass") {
    const primary = input.classItems.find((c) => c.dualClassState === "primary");
    const active = input.classItems.find((c) => c.dualClassState === "active");
    return `${titleCase(primary!.chassisId)} ${primary!.level} → ${titleCase(active!.chassisId)} ${active!.level}`;
  }
  return input.classItems.map((c) => `${titleCase(c.chassisId)} ${c.level}`).join(" / ");
}

function buildArrangementBadge(input: CharacterSheetInput): string | null {
  const mc = input.derived.multiclass;
  if (mc.mode === "multiclass") return "multi-class";
  if (mc.mode === "dualclass") {
    const state = mc.dualClass.surpassed ? "surpassed" : "dormant";
    return `dual-class · ${titleCase(mc.dualClass.dormantChassisId as string)} ${state}`;
  }
  return null;
}

/* ---------- abilities ---------- */

function buildAbilities(input: CharacterSheetInput): AbilityRow[] {
  const src = input.source as unknown as SourceView;
  const subsOn = input.subAbilityUi === true;
  // The displayed main score per ability — the averaged sub-score while that
  // rule is on (pre-racial, pre-trait), else the authored score. Computed for
  // ALL 6 abilities up front so applyRacialDeltas (which takes the whole
  // AbilityScores object) can be called once, exactly mirroring
  // base-actor.ts's own prepare-cycle order (sub-scores -> racial -> traits).
  const scores = Object.fromEntries(
    ABILITY_KEYS.map((key) => {
      const authored = src.system.abilities[key];
      const sub = authored.sub ?? { a: null, b: null };
      return [key, subsOn ? mainScoreFromSubs(sub.a, sub.b, authored.score) : authored.score];
    }),
  ) as unknown as AbilityScores;
  const race = (input.raceItem?.raceId ?? "human") as Race;
  const postRacial = applyRacialDeltas(scores, race, effectiveAbilityAdjustments(race, input.raceItem?.subrace));

  return ABILITY_KEYS.map((key) => {
    const authored = src.system.abilities[key];
    const derived = input.derived.abilities[key];
    const sub = authored.sub ?? { a: null, b: null };
    const score = scores[key];
    const effectiveScore = derived.score;
    // The racial and trait contributions are each computed independently
    // from their own source (racial: applyRacialDeltas above, clamped at 1
    // exactly like base-actor.ts's applyRacialAdjustment; trait: whatever's
    // left between the post-racial value and the actor's final prepared
    // score, which is by construction the ONLY remaining step — see
    // base-actor.ts's applyTraitAbilityBonuses doc comment) rather than
    // guessed by splitting one combined number, so a trait's ability bonus
    // (e.g. the "Powerful" trait's +1 STR) no longer shows as a mislabeled
    // "racial" adjustment.
    const racialAdjustedScore = Math.max(1, postRacial[key]);
    const racialDelta = racialAdjustedScore - score;
    const traitDelta = effectiveScore - racialAdjustedScore;
    const mods = Object.entries(derived.mods).map(([k, v]) => ({
      label: humanize(k),
      value: v == null ? "—" : String(v),
      // sheet redesign R1 dev-world fix 1: additive fields for the Roll20-style
      // labelled mini-boxes — `label`/`value` above are kept for API
      // compatibility and are now unused by templates (sheet redesign R2
      // removed their last consumer, the Character NPC sheet's old
      // ability-row.hbs partial).
      shortKey: `ADND2E.sheet.abilityMods.${k}.short`,
      longKey: `ADND2E.sheet.abilityMods.${k}.long`,
      display: formatAbilityMod(k, v),
    }));
    const [idA, idB] = SUB_ABILITIES[key];
    return {
      key,
      label: input.config.abilities[key],
      score,
      racialDelta,
      traitDelta,
      effectiveScore,
      exceptional: authored.exceptional,
      // Keys off the FINAL effective score, not the pre-racial/pre-trait
      // displayed score — a racial or trait +1 that pushes 17 -> 18 now shows
      // the percentile input too, not just an authored 18.
      showExceptional: key === "str" && Number(effectiveScore) === 18,
      mods,
      scoreLocked: subsOn,
      subs: subsOn
        ? [
            { id: idA, label: `ADND2E.sheet.subAbilities.${idA}`, name: `system.abilities.${key}.sub.a`, value: sub.a, placeholder: authored.score },
            { id: idB, label: `ADND2E.sheet.subAbilities.${idB}`, name: `system.abilities.${key}.sub.b`, value: sub.b, placeholder: authored.score },
          ]
        : null,
    };
  });
}

function buildSubAbilities(input: CharacterSheetInput): CharacterSheetContext["subAbilities"] {
  const enabled = input.subAbilityUi === true;
  const src = input.source as unknown as SourceView;
  const canSeed =
    enabled &&
    input.perms.editable &&
    ABILITY_KEYS.some((k) => {
      const sub = src.system.abilities[k].sub;
      return sub == null || sub.a === null || sub.b === null;
    });
  return { enabled, canSeed };
}

/* ---------- vitals ---------- */

/** Whole-branch review M3: maps FATIGUE_RECOVERY_INTERVAL's raw machine word
 *  to the full i18n key of a pre-written, grammatically-correct hint sentence
 *  for that tier's rest interval — avoids interpolating the raw word into a
 *  template (which produced "rest a hour" for severe, and never localized the
 *  word itself). Same "build an i18n key with a template literal" pattern as
 *  this file's own `shortLabel: \`ADND2E.sheet.saves.short.${key}\`` above. */
const FATIGUE_HINT_KEY: Record<"round" | "turn" | "hour", string> = {
  round: "ADND2E.sheet.spells.fatigueRecoveryHintRound",
  turn: "ADND2E.sheet.spells.fatigueRecoveryHintTurn",
  hour: "ADND2E.sheet.spells.fatigueRecoveryHintHour",
};

function buildVitals(input: CharacterSheetInput): CharacterSheetContext["vitals"] {
  const a = input.derived.attributes;
  const saves: SaveRow[] = SAVE_KEYS.map((key) => {
    const s = input.derived.saves[key];
    return {
      key,
      label: input.config.saves[key],
      target: s.target,
      rollModifier: s.rollModifier,
      effectiveTarget: s.effectiveTarget,
      // sheet redesign R1 dev-world fix 3: additive — `label` above stays
      // unchanged (still rendered by header.hbs's pc-save-row row; the old
      // save-row.hbs partial it originally served is gone). `shortLabel`
      // itself is kept for API compatibility and is currently unused by templates.
      shortLabel: `ADND2E.sheet.saves.short.${key}`,
    };
  });
  const fatigueTier = input.fatigueTier ?? null;
  const currentMovement = fatigueTier ? fatigueMovementRate(fatigueTier, a.movement.current) : a.movement.current;
  const fatigue = fatigueTier
    ? {
        label: CONDITIONS.find((c) => c.id === FATIGUE_CONDITION_ID[fatigueTier])?.name ?? fatigueTier,
        hintKey: FATIGUE_HINT_KEY[FATIGUE_RECOVERY_INTERVAL[fatigueTier]],
      }
    : null;
  // Whole-branch review M2: the badge/panel and its movement/combat penalties
  // show regardless of the rule's current on/off state (a condition already
  // applied keeps affecting the sheet even if the rule is later toggled off —
  // see CharacterSheetInput.fatigueTier's own doc comment), but the Recover
  // button additionally requires the rule to still be on, else a stale
  // condition from before the toggle would offer a recovery path the rule no
  // longer sanctions.
  const canRecoverFatigue = channellerFatigueEnabled(input.optionalRules);
  return {
    hp: a.hp,
    thac0: a.thac0,
    ac: a.ac,
    saves,
    movement: {
      base: a.movement.base,
      current: currentMovement,
      encumbranceCategory: a.movement.encumbranceCategory,
      encumbranceCategoryLabel: input.config.encumbranceCategories[a.movement.encumbranceCategory],
    },
    casting: Boolean(input.castingStatus),
    fatigue,
    canRecoverFatigue,
  };
}

/* ---------- classes ---------- */

function buildClasses(input: CharacterSheetInput): ClassRow[] {
  return input.classItems.map((c) => {
    const progress = xpToNext(c.chassisId as ClassId, c.xp, c.xpModifierPercent ?? 0, levelRulesOf(c));
    return {
      id: c.id,
      name: c.name,
      chassisId: c.chassisId,
      level: c.level,
      xp: c.xp,
      xpToNextLevel: progress.toNextLevel,
      xpPct: progress.pct,
      nextThreshold: progress.next,
      atLimit: progress.atLimit,
      canLevelUp: c.canLevelUp,
      hitDie: c.hitDie,
      isDualPrimary: c.dualClassState === "primary",
      isDualActive: c.dualClassState === "active",
      specialistSchool: c.specialistSchool,
    };
  });
}

function buildDualClassToggle(input: CharacterSheetInput): { available: boolean; on: boolean } {
  const items = input.classItems;
  return {
    available: items.length === 2 && items.every((c) => c.dualClassState === null),
    on: items.some((c) => c.dualClassState !== null),
  };
}

/* ---------- inventory ---------- */

function buildInventory(input: CharacterSheetInput, fav: FavCheck): CharacterSheetContext["inventory"] {
  const src = input.source as unknown as SourceView;
  const { containers, loose } = groupInventory(input.physicalItems);
  const enc = input.derived.attributes.encumbrance;
  const encumbrance: EncumbranceGauge = {
    carried: enc.carried,
    category: enc.category,
    categoryLabel: input.config.encumbranceCategories[enc.category],
    movementRate: enc.movementRate,
    baseMove: enc.baseMove,
    penalty: enc.penalty,
  };
  const locationOptions = [
    { value: "", label: "ADND2E.sheet.inventory.noContainer" },
    ...containers.map((c) => ({ value: c.item.id, label: c.item.name })),
  ];
  const sections = buildInventorySections({ containers, loose }, (id) => fav("item", id));
  return { containers, loose, encumbrance, currency: src.system.currency, locationOptions, sections };
}

/* ---------- combat ---------- */

/** `weapon`'s RAW (uncapped) effective mastery tier — mirrors
 *  combat-rolls.ts's `resolveProficiencyModifier` matching precedence: an
 *  exact specific-weapon match (by `baseWeaponName`, falling back to the
 *  item's own `name`) beats a group match (by the weapon's own
 *  `proficiencyGroup`), else 0. NOT capped by the weaponMastery optional
 *  rule — callers that care about the tier-2/3 cap apply it themselves
 *  (`hasGrandMasteryExtraAttack`); a caller that only needs ">= 1"
 *  (Specialized, the base always-on PHB mechanic) doesn't need the cap at
 *  all, since capping never changes whether the raw tier is >= 1. */
function resolveMasteryTierForWeapon(
  weapon: NonNullable<PhysicalItemView["weapon"]>,
  weaponName: string,
  proficiencyItems: readonly WeaponProfView[],
): 0 | 1 | 2 | 3 {
  const key = weapon.baseWeaponName || weaponName;
  let exactTier: 0 | 1 | 2 | 3 | null = null;
  let groupTier: 0 | 1 | 2 | 3 | null = null;
  for (const p of proficiencyItems) {
    if (!p.isGroup && p.weaponOrGroup === key) {
      exactTier = p.masteryTier;
      break;
    }
    if (p.isGroup && p.weaponOrGroup === weapon.proficiencyGroup && groupTier === null) groupTier = p.masteryTier;
  }
  return exactTier ?? groupTier ?? 0;
}

/** Whether `weapon`'s effective mastery tier is Grand Mastery (3) — the only
 *  tier that grants `weaponMasteryEffect`'s `extraAttacks`. Applies the same
 *  weaponMastery-optional-rule tier cap combat-rolls.ts's
 *  `resolveProficiencyModifier` does, for display purposes only: nothing in
 *  this codebase gates re-clicking Roll Attack, so this is purely
 *  informational (see `grandMasteryExtraAttack`'s own doc comment). */
function hasGrandMasteryExtraAttack(
  weapon: NonNullable<PhysicalItemView["weapon"]>,
  weaponName: string,
  proficiencyItems: readonly WeaponProfView[],
  optionalRules: CharacterSheetInput["optionalRules"],
): boolean {
  if (!(optionalRules.combatAndTacticsEnabled && optionalRules.weaponMastery)) return false;
  return resolveMasteryTierForWeapon(weapon, weaponName, proficiencyItems) === 3;
}

/** `weapon`'s PHB Table 35 specialist attacks-per-round rate, or null when it
 *  doesn't apply: the actor must be a single-class fighter (the same
 *  `canWeaponSpecialize` gate `buildWeaponProfRow`'s Advance Mastery button
 *  uses), Specialized in this weapon (mastery tier >= 1 — the base, always-on
 *  PHB mechanic; unlike Grand Mastery's extra attack, this is NOT gated by
 *  the weaponMastery optional rule), and the weapon's own
 *  `specialistWeaponClass` must be set (nothing else can derive it). Display
 *  only — see `specialistAttackRate`'s own doc comment for why this doesn't
 *  try to compute which round you're currently in. */
function resolveSpecialistAttackRate(
  weapon: NonNullable<PhysicalItemView["weapon"]>,
  weaponName: string,
  input: CharacterSheetInput,
): AttackRate | null {
  if (!weapon.specialistWeaponClass) return null;
  if (resolveMasteryTierForWeapon(weapon, weaponName, input.proficiencyItems.weapon) < 1) return null;
  const primaryClass = input.classItems[0];
  if (!primaryClass || input.classItems.length !== 1 || primaryClass.level < 1) return null;
  const chassis = getChassis(primaryClass.chassisId as ClassId);
  if (!canWeaponSpecialize({ specializationAllowed: chassis.weaponSpecializationAllowed, isSingleClass: true })) {
    return null;
  }
  return specialistAttacksPerRound(primaryClass.level, weapon.specialistWeaponClass as SpecialistWeaponClass);
}

function buildCombat(input: CharacterSheetInput, fav: FavCheck): CharacterSheetContext["combat"] {
  const isThief = input.classItems.some((c) => c.chassisId === "thief");
  const ammoItems = input.physicalItems.filter((i) => i.type === "ammo");
  const ammoStock: AmmoStock[] = ammoItems.map((i) => ({
    id: i.id,
    ammoType: i.ammo!.ammoType,
    quantity: i.quantity,
  }));

  const weapons = input.physicalItems
    .filter((i) => i.type === "weapon")
    .map((i) => {
      const w = i.weapon as NonNullable<PhysicalItemView["weapon"]>;
      const ammoCandidates = w.ammoType ? matchingAmmo(ammoStock, w.ammoType) : [];
      const selected = w.ammoType ? defaultAmmoSelection(ammoCandidates, w.selectedAmmoId) : null;
      const selectedAmmoItem = selected ? ammoItems.find((a) => a.id === selected.id) : undefined;
      const damageNote = w.ammoType
        ? [selectedAmmoItem?.ammo?.damageVsSM, selectedAmmoItem?.ammo?.damageVsL].filter(Boolean).join(" / ")
        : [w.damageVsSM, w.damageVsL].filter(Boolean).join(" / ");
      return {
        id: i.id,
        name: i.name,
        equipped: i.equipped,
        toHitNote: "",
        damageNote,
        speedFactor: w.speedFactor,
        range: w.range,
        canBackstab: isThief && canBackstab({ category: w.category, damageType: w.damageType }),
        favorite: fav("item", i.id),
        ammoType: w.ammoType,
        ammoOptions: ammoCandidates.map((a) => ({
          value: a.id,
          label: `${ammoItems.find((it) => it.id === a.id)!.name} (${a.quantity})`,
          selected: selected?.id === a.id,
        })),
        grandMasteryExtraAttack: hasGrandMasteryExtraAttack(w, i.name, input.proficiencyItems.weapon, input.optionalRules),
        specialistAttackRate: resolveSpecialistAttackRate(w, i.name, input),
      };
    });

  const armorItems = input.physicalItems.filter((i) => i.type === "armor");
  const worn = armorItems.find((i) => i.equipped && !i.armor!.isShield);
  const shield = armorItems.find((i) => i.equipped && i.armor!.isShield);
  const dexMods = input.derived.abilities.dex.mods as DexterityModifiers;
  const acBreakdown = [
    { label: "ADND2E.sheet.combat.acBase", value: worn ? worn.armor!.baseAc : 10 },
    { label: "ADND2E.sheet.combat.acShield", value: shield ? shield.armor!.shieldAcBonus : 0 },
    {
      label: "ADND2E.sheet.combat.acMagic",
      value: (worn ? worn.magicBonus : 0) + (shield ? shield.magicBonus : 0),
    },
    { label: "ADND2E.sheet.combat.acDex", value: dexMods.defensiveAdj },
  ];

  const armor = armorItems.map((i) => ({
    id: i.id,
    name: i.name,
    equipped: i.equipped,
    isShield: i.armor!.isShield,
    baseAc: i.armor!.baseAc,
  }));

  const rules = input.optionalRules;
  const maneuverOptions = Object.entries(MANEUVERS)
    .filter(
      ([, m]) =>
        rules.combatAndTacticsEnabled && (m.category === "calledShot" ? rules.calledShots : rules.combatManeuvers),
    )
    .map(([id]) => ({ value: id, label: `ADND2E.sheet.combat.maneuver.${id}` }));

  return { weapons, acBreakdown, armor, maneuverOptions };
}

/* ---------- skills ---------- */

function buildSkills(input: CharacterSheetInput, fav: FavCheck): CharacterSheetContext["skills"] {
  const p = input.derived.proficiencies;
  return {
    weapon: {
      ...p.weapon,
      items: input.proficiencyItems.weapon.map((w) => buildWeaponProfRow(w, input, p.weapon.available)),
    },
    nonweapon: {
      ...p.nonweapon,
      items: input.proficiencyItems.nonweapon.map((n) => buildNwpRow(n, input)),
    },
    thief: buildThiefSkills(input, fav),
  };
}

/** Resolves the actor's worn (non-shield) armor's `armorType`, or "none" if
 *  nothing is equipped — mirrors the same "find equipped, non-shield armor"
 *  scan `buildCombat` already does for the AC breakdown. */
function resolveWornArmorType(physicalItems: PhysicalItemView[]): ArmorType {
  const worn = physicalItems.find((i) => i.type === "armor" && i.equipped && !i.armor!.isShield);
  return worn?.armor?.armorType ?? "none";
}

/** Builds the thief/bard skills section — null when the actor's (first)
 *  class has no thief-skill access at all. Every row's `base`/`effective`
 *  score is computed the same way `thiefSkillCheck` (Task 1) will re-derive
 *  it at Roll time; `canAllocate`/`canDeallocate` mirror the SAME
 *  eligibility `proficiency-actions.ts`'s allocate/deallocate actions
 *  independently re-check (the established duplicate-re-validation pattern). */
function buildThiefSkills(input: CharacterSheetInput, fav: FavCheck): CharacterSheetContext["skills"]["thief"] {
  const thiefOrBardClass =
    input.classItems.find((c) => c.chassisId === "thief") ??
    input.classItems.find((c) => c.chassisId === "bard") ??
    null;
  const primaryChassis = thiefOrBardClass ? getChassis(thiefOrBardClass.chassisId as ClassId) : null;
  const access = primaryChassis?.thiefSkillAccess ?? null;
  if (!access) return null;

  const t = input.derived.thiefSkills;
  const armorType = resolveWornArmorType(input.physicalItems);
  const classification = classifyThiefArmor(armorType);
  const armorDisabled = classification.disabled;
  const armorCategory = classification.disabled ? "none" : classification.category;

  const isThiefClass = thiefOrBardClass?.chassisId === "thief";
  const race = (input.raceItem?.raceId ?? "human") as Race;
  const dexScore = input.derived.abilities.dex.score;
  const perSkillCap = isThiefClass ? thiefSkillPerSkillCap(thiefOrBardClass!.level) : Infinity;

  const items: ThiefSkillRow[] = access.map((skill) => {
    const allocation = input.thiefSkillAllocations.find((a) => a.skill === skill);
    const allocated = allocation?.allocatedPoints ?? 0;
    const ctx = { race, dexterity: dexScore, armor: armorCategory as never, racialAdjustments: effectiveThiefAdjustments(race, input.raceItem?.subrace) };
    const base = isThiefClass ? thiefSkillBaseScore(skill, ctx) : bardSkillBaseScore(skill as BardSkill, ctx);
    const effective = isThiefClass
      ? resolveThiefSkill(skill, { ...ctx, allocatedPoints: allocated })
      : resolveBardSkill(skill as BardSkill, { ...ctx, allocatedPoints: allocated });
    return {
      skill,
      label: `ADND2E.chat.thiefSkill.skills.${skill}`,
      base,
      allocated,
      effective,
      canAllocate: t.available > 0 && (!isThiefClass || allocated < perSkillCap),
      canDeallocate: allocated > 0,
      usable: !(skill === "read-languages" && isThiefClass && thiefOrBardClass!.level < 4),
      favorite: fav("thiefSkill", skill),
    };
  });

  return { total: t.total, spent: t.spent, available: t.available, armorDisabled, items };
}

function buildNwpRow(n: NwpView, input: CharacterSheetInput): NwpView {
  const ability = input.derived.abilities[n.governingAbility as AbilityKey];
  return {
    ...n,
    governingAbilityLabel: input.config.abilities[n.governingAbility] ?? n.governingAbility,
    checkTarget: ability.score + n.modifier + (n.slotsInvested - 1),
  };
}

/** Resolves a weapon proficiency's specialization category by matching its
 *  `weaponOrGroup` name against the actor's owned weapon Items — null for a
 *  group proficiency (never specialization-eligible) or when no matching
 *  weapon Item is found. Thrown weapons map to "melee" (a locked
 *  brainstorming decision — PHB treats thrown-weapon specialization under
 *  the melee rule). */
function resolveWeaponCategory(prof: WeaponProfView, physicalItems: PhysicalItemView[]): "melee" | "crossbow" | "bow" | null {
  if (prof.isGroup) return null;
  const byGroup = categoryForProficiencyGroup(prof.proficiencyGroup);
  if (byGroup) return byGroup;
  // Pre-8b / hand-made proficiency with no (or unrecognized) group — fall
  // back to deriving the category from an owned weapon whose baseWeaponName
  // (or, if that's blank, its own display name) matches this proficiency.
  const weapon = physicalItems.find(
    (p) => p.type === "weapon" && (p.weapon?.baseWeaponName || p.name) === prof.weaponOrGroup,
  );
  if (!weapon?.weapon) return null;
  if (weapon.weapon.category === "bow") return "bow";
  if (weapon.weapon.category === "crossbow") return "crossbow";
  return "melee";
}

/** i18n keys for each mastery tier's badge — index 0 (proficient only) has
 *  no badge. */
const MASTERY_TIER_LABEL_KEYS: readonly (string | null)[] = [
  null,
  "ADND2E.sheet.skills.masteryTier.1",
  "ADND2E.sheet.skills.masteryTier.2",
  "ADND2E.sheet.skills.masteryTier.3",
];

/** Enriches a raw WeaponProfView with its resolved specialization category
 *  and whether it can advance to the next mastery tier right now. Mirrors
 *  the established "buildXRow re-derives eligibility for both display AND
 *  the action's own re-check" pattern (e.g. SP4a's buildSpellRow/canReMemorize). */
function buildWeaponProfRow(
  prof: WeaponProfView,
  input: CharacterSheetInput,
  weaponSlotsAvailable: number,
): WeaponProfView {
  const category = resolveWeaponCategory(prof, input.physicalItems);
  const primaryChassis = input.classItems[0] ? getChassis(input.classItems[0].chassisId as ClassId) : null;
  const isSingleClass = input.classItems.length === 1;
  const masteryEnabled = input.optionalRules.combatAndTacticsEnabled && input.optionalRules.weaponMastery;
  const nextTier = (prof.masteryTier + 1) as 1 | 2 | 3;
  // Tier 1 (plain Specialization) is a base PHB mechanic that predates Combat &
  // Tactics and must stay purchasable with the optional rule off; only tiers
  // 2-3 (Mastery / Grand Mastery) are gated. Matches combat-rolls.ts's
  // resolveProficiencyModifier, which already lets tier 1's bonus through
  // unconditionally and only caps tiers 2-3 behind the toggle.
  const tierAllowed = nextTier === 1 || masteryEnabled;
  const eligible =
    tierAllowed &&
    prof.masteryTier < 3 &&
    category !== null &&
    primaryChassis !== null &&
    canWeaponSpecialize({ specializationAllowed: primaryChassis.weaponSpecializationAllowed, isSingleClass }) &&
    weaponSlotsAvailable >= Math.max(0, weaponMasteryTierCost(nextTier, category) - prof.slotsInvested);
  return {
    ...prof,
    category,
    masteryTierLabelKey: MASTERY_TIER_LABEL_KEYS[prof.masteryTier] ?? null,
    canAdvanceMastery: eligible,
  };
}

/* ---------- spells ---------- */

function buildSpells(input: CharacterSheetInput, fav: FavCheck): CharacterSheetContext["spells"] {
  const sc = input.derived.spellcasting;
  const off = input.castingDisabled ?? { wizard: false, priest: false };
  const school = sc.wizard.specialistSchool;
  const priestChassisId =
    input.classItems.find((c) => isPriestSpellProgression(getChassis(c.chassisId as ClassId).spellProgressionId))
      ?.chassisId ?? null;
  const sphereAccessOverride = sc.priest.sphereAccessOverride as SphereName[] | null;
  const int = input.derived.abilities.int.mods as IntelligenceModifiers;
  const specialistSchool = school as WizardSchool | null;
  const casting = buildCastingPanel(input);
  const spellPointsOn = spellPointsEnabled(input.optionalRules);
  // The priest pool applies only to a cleric/druid chassis. A paladin or ranger
  // keeps its classic slot table under the rule (no pool to draw on).
  const priestPoolOn =
    !off.priest && spellPointsOn && isPriestPoolProgression(priestChassisId ? getChassis(priestChassisId as ClassId).spellProgressionId : null);
  // `?? {}` handles BOTH shapes the field can take: a test fixture that omits
  // it entirely (undefined), and real system data's ObjectField default of
  // `{}` (present but empty) when the rule is off or there's no wizard caster.
  const wizardSp = sc.wizard.spellPoints ?? {};
  const channellingOn = channellersEnabled(input.optionalRules);
  const wizardChannelling = sc.wizard.channelling ?? {};
  // Sub-project 14 priest theurgies: same `?? {}` story as wizardSp.
  const priestSp = sc.priest.spellPoints ?? {};
  const priestChannelling = sc.priest.channelling ?? {};
  // Under channelling the priest's channelling pool replaces the classic SP bar, as for wizards.
  const priestChannellingOn = channellingOn && priestPoolOn;

  // Orisons (level 0) are listed under `orisons` below, never in `known`; the loop starts at level 1.
  const known: { level: number; items: SpellItemView[] }[] = [];
  for (let level = 1; level <= 9; level += 1) {
    const levelItems = input.spellItems.filter((s) => s.level === level);
    const knownAtThisLevel = levelItems.filter((s) => s.casterClass === "wizard" && s.inSpellbook).length;
    const castableAtThisLevel = (sc.wizard.slots[level]?.max ?? 0) > 0;
    const learnCtx: LearnEligibilityContext = {
      int, specialistSchool, knownAtThisLevel, castableAtThisLevel, optionalRules: input.optionalRules,
    };
    let items = levelItems.map((s) =>
      buildSpellRow(
        s, sc, priestChassisId, sphereAccessOverride, learnCtx, fav,
        spellPointsOn, wizardSp, channellingOn, wizardChannelling, priestSp, priestPoolOn,
      ),
    );
    items = casting ? items.map((r) => ({ ...r, canCast: false })) : items;
    items = items.map((r) => (off[r.casterClass === "priest" ? "priest" : "wizard"] ? { ...r, canMemorize: false, canCast: false, canLearn: false } : r));
    if (items.length > 0) known.push({ level, items });
  }
  const orisons = priestPoolOn
    ? buildOrisonRows(input, sc, priestChassisId, sphereAccessOverride, fav, {
        spellPointsOn, wizardSp, channellingOn, wizardChannelling, priestSp, priestPoolOn,
      })
    : [];
  return {
    wizardSlots: off.wizard ? [] : toSlotRows(sc.wizard.slots),
    // Under the priest pool rule (cleric/druid) the classic priest slot rows are hidden: the pool replaces them.
    priestSlots: priestPoolOn || off.priest ? [] : toSlotRows(sc.priest.slots),
    specialistSchoolLabel: school ? input.config.schools[school] : null,
    known,
    orisons,
    orphaned: buildOrphanedSpells(input, sc),
    casting,
    spellPoints:
      spellPointsOn && typeof wizardSp.remaining === "number"
        ? { max: wizardSp.sp ?? 0, spent: wizardSp.spent ?? 0, remaining: wizardSp.remaining }
        : null,
    channelling:
      channellingOn && typeof wizardChannelling.max === "number"
        ? { current: wizardChannelling.current ?? 0, max: wizardChannelling.max }
        : null,
    priestChannelling:
      priestChannellingOn && typeof priestChannelling.max === "number"
        ? { current: priestChannelling.current ?? 0, max: priestChannelling.max }
        : null,
    freeMagicks: sc.wizard.memorized
      .filter((m) => m.magickType === "free")
      .map((m) => ({
        level: m.spellLevel,
        expended: m.expended,
        canCast:
          !off.wizard &&
          !casting &&
          (channellingOn ? canAffordCast(wizardChannelling.current ?? 0, m.spellLevel, "free") : !m.expended),
      })),
    priestPoolOn,
    priestSpellPoints:
      priestPoolOn && !priestChannellingOn && typeof priestSp.remaining === "number"
        ? { max: priestSp.sp ?? 0, spent: priestSp.spent ?? 0, remaining: priestSp.remaining }
        : null,
    ...buildPriestFreeTheurgy(sc, priestChassisId, sphereAccessOverride, priestPoolOn, channellingOn, casting !== null, input.spellItems),
  };
}

/** The orison group: each level-0 priest spell as a row whose `canMemorize` is
 *  Task 4's orison rule (the same `orisonAffords` canReMemorize uses), with the
 *  cap read from the priest class item's own level (classItemLevel on its xp,
 *  as spell-actions does). The caller only invokes this under the priest pool. */
function buildOrisonRows(
  input: CharacterSheetInput,
  sc: CharacterDerivedView["spellcasting"],
  priestChassisId: string | null,
  sphereAccessOverride: SphereName[] | null,
  fav: FavCheck,
  pool: {
    spellPointsOn: boolean;
    wizardSp: CharacterDerivedView["spellcasting"]["wizard"]["spellPoints"];
    channellingOn: boolean;
    wizardChannelling: CharacterDerivedView["spellcasting"]["wizard"]["channelling"];
    priestSp: PriestPoolView;
    priestPoolOn: boolean;
  },
): SpellItemView[] {
  const priestClass = input.classItems.find((c) => c.chassisId === priestChassisId);
  const priestLevel = priestClass ? classItemLevel(priestClass.chassisId as ClassId, priestClass.xp, priestClass.xpModifierPercent ?? 0, levelRulesOf(priestClass)) : 0;
  // Orisons are priest rows, so canLearn is always false and the learn context
  // is never consulted; the level-0 placeholders only satisfy buildSpellRow's shape.
  const learnCtx: LearnEligibilityContext = {
    int: input.derived.abilities.int.mods as IntelligenceModifiers,
    specialistSchool: sc.wizard.specialistSchool as WizardSchool | null,
    knownAtThisLevel: 0,
    castableAtThisLevel: false,
    optionalRules: input.optionalRules,
  };
  const memorizedOrisons = sc.priest.memorized.filter((m) => m.spellLevel === 0).length;
  return input.spellItems
    .filter((s) => s.level === 0 && s.casterClass === "priest")
    .map((s) => {
      const row = buildSpellRow(
        s, sc, priestChassisId, sphereAccessOverride, learnCtx, fav,
        pool.spellPointsOn, pool.wizardSp, pool.channellingOn, pool.wizardChannelling, pool.priestSp, pool.priestPoolOn,
      );
      return {
        ...row,
        // Channelled orisons memorize free: only the orison cap gates them (as canReMemorize does).
        canMemorize: !row.memorized && orisonAffords(
          pool.channellingOn ? Number.POSITIVE_INFINITY : (pool.priestSp.remaining ?? 0),
          memorizedOrisons,
          orisonCap(priestLevel),
        ),
      };
    });
}

/** Sub-project 14 priest theurgies: the free-theurgy controls. A memorize row
 *  per level 1-7 is offered only when the pool has room for a free theurgy at
 *  that scope; `major` also needs major access at that level (memorizeFreeTheurgy
 *  refuses a major free theurgy otherwise). Forget and cast rows list every
 *  memorized free theurgy, whatever the rule's state. */
function buildPriestFreeTheurgy(
  sc: CharacterDerivedView["spellcasting"],
  priestChassisId: string | null,
  sphereAccessOverride: SphereName[] | null,
  priestPoolOn: boolean,
  channellingOn: boolean,
  casting: boolean,
  spellItems: SpellItemView[],
): Pick<CharacterSheetContext["spells"], "priestFreeMemorize" | "priestFreeTheurgies"> {
  const pool = sc.priest.spellPoints ?? {};
  const memorized = sc.priest.memorized;
  const poolOn = priestPoolOn && typeof pool.remaining === "number";
  // Channelled memorize is free from the pool: only the Table 26 caps gate a free memorize row.
  const memorizeView = poolOn && channellingOn ? priestPoolUnderChannelling(pool) : pool;
  const channelled = poolOn && channellingOn;
  const channelledCurrent = sc.priest.channelling?.current ?? 0;
  const priestFreeMemorize: CharacterSheetContext["spells"]["priestFreeMemorize"] = [];
  if (poolOn) {
    for (let level = 1; level <= 7; level += 1) {
      const major =
        priestHasMajorAccessAtLevel(priestChassisId, sphereAccessOverride, level) &&
        priestPoolAffords(memorizeView, memorized, level, "free", "major");
      const universal = priestPoolAffords(memorizeView, memorized, level, "free", "universal");
      if (major || universal) priestFreeMemorize.push({ level, major, universal });
    }
  }
  const priestFreeTheurgies: CharacterSheetContext["spells"]["priestFreeTheurgies"] = [];
  for (const m of memorized) {
    if (m.magickType !== "free" || (m.theurgyScope !== "major" && m.theurgyScope !== "universal")) continue;
    const scope = m.theurgyScope;
    const hasEligible = spellItems.some((s) =>
      priestFreeCastEligible({ scope, chassisId: priestChassisId, sphereAccessOverride }, s, m.spellLevel),
    );
    priestFreeTheurgies.push({
      level: m.spellLevel,
      scope: m.theurgyScope,
      scopeLabelKey: m.theurgyScope === "major" ? "ADND2E.sheet.spells.freeTheurgyMajor" : "ADND2E.sheet.spells.freeTheurgyUniversal",
      expended: m.expended,
      // Cast is offered only when some priest spell qualifies for this column
      // and level (the same predicate castFreeTheurgy re-checks). A channelled
      // free theurgy is never expended, so its Cast follows live affordability instead.
      canCast: !casting && (channelled
        ? priestCanAffordCast(channelledCurrent, priestChannellingCost(m.spellLevel, "free", scope))
        : !m.expended) && hasEligible,
      // The inline reason shown in place of Cast. Only when the row is blocked
      // by the missing spell alone (not expended, not mid-cast, rule on).
      noEligibleSpell: poolOn && !casting && !m.expended && !hasEligible,
    });
  }
  return { priestFreeMemorize, priestFreeTheurgies };
}

/* ---------- casting (SP9a) ---------- */

function buildCastingPanel(input: CharacterSheetInput): CastingPanel | null {
  const s = input.castingStatus;
  if (!s) return null;
  const isRounds = s.completeRound !== null;
  return {
    spellName: s.spellName,
    detailKey: isRounds ? "ADND2E.sheet.casting.completesRound" : "ADND2E.sheet.casting.onYourTurn",
    detailValue: isRounds ? (s.completeRound as number) : (s.segments ?? 0),
    canComplete:
      input.perms.editable &&
      s.combatRound !== null &&
      canCompleteCasting(s, { combatRound: s.combatRound, isCasterTurn: s.isCasterTurn }),
    canGmControl: input.perms.isGM,
  };
}

/** The wizard-specific inputs `canLearnForRow` needs, bundled so `buildSpellRow`
 *  doesn't grow an unwieldy positional-parameter list. `knownAtThisLevel` is
 *  computed once per level by `buildSpells` (counting spellbook-member wizard
 *  spells at that level), not per-row, since it's the same for every spell at
 *  a given level. */
interface LearnEligibilityContext {
  int: IntelligenceModifiers;
  specialistSchool: WizardSchool | null;
  knownAtThisLevel: number;
  /** true when the actor's cached wizard slot table has a non-zero max at
   *  this spell's level — canLearnSpell's own doc comment requires the
   *  caller to confirm this before calling it; it does not check class
   *  level itself. */
  castableAtThisLevel: boolean;
  optionalRules: CharacterSheetInput["optionalRules"];
}

/** Memorized entries whose backing spell Item no longer exists on the actor
 *  (e.g. it was deleted while still memorized). These can never appear in a
 *  normal `known` row (built by iterating `input.spellItems`), so they get
 *  their own minimal Forget-only list instead — otherwise the memorized
 *  entry is permanently stuck consuming a slot with no UI path to remove it. */
function buildOrphanedSpells(
  input: CharacterSheetInput,
  sc: CharacterDerivedView["spellcasting"],
): OrphanedSpellRow[] {
  const knownIds = new Set(input.spellItems.map((s) => s.id));
  const orphaned: OrphanedSpellRow[] = [];
  for (const m of sc.wizard.memorized) {
    // a free magick (Sub-project 14 Plan A) has no backing spell item to lose — never orphaned
    if (m.spellItemId !== null && !knownIds.has(m.spellItemId)) {
      orphaned.push({ spellItemId: m.spellItemId, casterClass: "wizard", spellLevel: m.spellLevel });
    }
  }
  for (const m of sc.priest.memorized) {
    // a free theurgy reserves a level and scope, not a spell item — never orphaned
    if (m.spellItemId !== null && !knownIds.has(m.spellItemId)) {
      orphaned.push({ spellItemId: m.spellItemId, casterClass: "priest", spellLevel: m.spellLevel });
    }
  }
  return orphaned;
}

/** Enriches a raw SpellItemView with memorize/cast/learn eligibility, computed
 *  from the actor's memorized list, its slot state, (for a priest spell)
 *  sphere access, and (for a wizard spell not yet in the spellbook) whether
 *  it can be Learn-attempted. sheet.ts's toSpellView leaves these five fields
 *  as placeholders. */
function buildSpellRow(
  item: SpellItemView,
  sc: CharacterDerivedView["spellcasting"],
  priestChassisId: string | null,
  sphereAccessOverride: SphereName[] | null,
  learnCtx: LearnEligibilityContext,
  fav: FavCheck,
  spellPointsOn: boolean,
  wizardSp: CharacterDerivedView["spellcasting"]["wizard"]["spellPoints"],
  channellingOn: boolean,
  wizardChannelling: CharacterDerivedView["spellcasting"]["wizard"]["channelling"],
  priestSp: PriestPoolView,
  priestPoolOn: boolean,
): SpellItemView {
  const isWizard = item.casterClass === "wizard";
  const memorizedList = isWizard ? sc.wizard.memorized : sc.priest.memorized;
  const entry = memorizedList.find((m) => m.spellItemId === item.id);
  const memorized = Boolean(entry);
  const expended = entry?.expended ?? false;
  // Sub-project 14 priest channelling: the priest's casts and memorizes follow the channelling pool (spell-actions' priestChannellingOn).
  const priestChannelling = !isWizard && channellingOn && priestPoolOn;

  let hasFreeSlot: boolean;
  if (isWizard && spellPointsOn && wizardSp && typeof wizardSp.maxSpellLevel === "number") {
    const atLevelOk =
      item.level <= wizardSp.maxSpellLevel &&
      spellsMemorizedAtLevel(sc.wizard.memorized, item.level) < (wizardSp.maxPerLevel ?? 0);
    // Sub-project 14 Plan B: memorizing costs nothing from a channeller's
    // pool (design spec §1.1) — only the Table 17 caps above still gate it.
    hasFreeSlot = channellingOn ? atLevelOk : atLevelOk && (wizardSp.remaining ?? 0) >= magickCost(item.level, "fixed");
  } else if (!isWizard && priestPoolOn) {
    // Sub-project 14 priest theurgies: under the rule the pool prices a fixed
    // theurgy at the row's Table 29 scope, with the same cap and pool check
    // canReMemorize applies. No access scope means no row can be memorized.
    const scope = priestAccessScope(priestChassisId, sphereAccessOverride, item.spheres as SphereName[], item.level);
    const view = priestChannelling ? priestPoolUnderChannelling(priestSp) : priestSp;
    hasFreeSlot = scope !== null && priestPoolAffords(view, sc.priest.memorized, item.level, "fixed", scope);
  } else {
    const slots = isWizard ? sc.wizard.slots : sc.priest.slots;
    const slotRow = slots[item.level];
    hasFreeSlot = Boolean(slotRow) && slotRow.used < slotRow.max;
  }

  const eligible = isWizard
    ? item.inSpellbook
    : canMemorizePriestSpell(priestChassisId, sphereAccessOverride, item.spheres as SphereName[], item.level);

  // Sub-project 14 Plan B: a channelling entry is never expended, so its
  // castability instead tracks live pool affordability, recomputed on every
  // render — a wizard who casts their pool dry sees the Cast button disable.
  const canCastChannelling =
    isWizard && channellingOn && entry
      ? canAffordCast(wizardChannelling?.current ?? 0, item.level, ("magickType" in entry ? entry.magickType : undefined) ?? "fixed")
      : null;
  // A channelled priest's cast is priced as castSpell prices it: Table 29 at the
  // entry's own scope, a level-0 orison at 1 SP (priestChannellingCost).
  const priestEntry = priestChannelling ? sc.priest.memorized.find((m) => m.spellItemId === item.id) : undefined;
  const canCastPriestChannelled = priestEntry
    ? priestCanAffordCast(
        sc.priest.channelling?.current ?? 0,
        priestChannellingCost(priestEntry.spellLevel, priestEntry.magickType ?? "fixed", priestEntry.theurgyScope ?? "major"),
      )
    : null;

  return {
    ...item,
    memorized,
    expended,
    canMemorize: !memorized && hasFreeSlot && eligible,
    outsideSpheres: !isWizard && !memorized && priestAccessScope(priestChassisId, sphereAccessOverride, item.spheres as SphereName[], item.level) === null,
    canCast: memorized && (canCastChannelling ?? canCastPriestChannelled ?? !expended),
    canLearn: isWizard && !item.inSpellbook && canLearnForRow(item, learnCtx),
    favorite: fav("spell", item.id),
  };
}

/** Whether a wizard spell not yet in the spellbook can be Learn-attempted.
 *  Only the FIRST school in the item's `schools` array that is a recognized
 *  `WizardSchool` is consulted — see this plan's Global Constraints for why
 *  (canLearnSpell takes a single WizardSchool, not an array). A spell with no
 *  such school (e.g. tagged only "lesser-divination"/"wild") can never be
 *  Learn-attempted. */
function canLearnForRow(item: SpellItemView, ctx: LearnEligibilityContext): boolean {
  if (!ctx.castableAtThisLevel) return false;
  const wizardSchool = item.schools.find((s): s is WizardSchool =>
    (WIZARD_SCHOOLS as readonly string[]).includes(s),
  );
  if (!wizardSchool) return false;
  return canLearnSpell({
    int: ctx.int,
    spellLevel: item.level,
    spellSchool: wizardSchool,
    specialistSchool: ctx.specialistSchool,
    knownAtThisLevel: ctx.knownAtThisLevel,
    options: ctx.optionalRules,
  }).allowed;
}

function toSlotRows(slots: Record<string, { max: number; used: number }>): SlotRow[] | null {
  const entries = Object.entries(slots);
  if (entries.length === 0) return null;
  return entries
    .map(([level, s]) => ({ level: Number(level), max: s.max, used: s.used }))
    .sort((a, b) => a.level - b.level);
}

/* ---------- features ---------- */

const FEATURE_SOURCE_TYPE_LABELS: Record<string, string> = {
  class: "ADND2E.sheet.features.sourceTypes.class",
  kit: "ADND2E.sheet.features.sourceTypes.kit",
  race: "ADND2E.sheet.features.sourceTypes.race",
  other: "ADND2E.sheet.features.sourceTypes.other",
};

function buildFeatures(input: CharacterSheetInput): CharacterSheetContext["features"] {
  const src = input.source as unknown as SourceView;
  const groups: { sourceType: string; sourceTypeLabel: string; items: FeatureItemView[] }[] = [];
  for (const f of input.featureItems) {
    const existing = groups.find((g) => g.sourceType === f.sourceType);
    if (existing) existing.items.push(f);
    else
      groups.push({
        sourceType: f.sourceType,
        sourceTypeLabel: FEATURE_SOURCE_TYPE_LABELS[f.sourceType] ?? f.sourceType,
        items: [f],
      });
  }
  const racialXp = input.raceItem?.subrace?.xpModifierPercent ?? 0;
  return {
    groups,
    racialAbilities: input.raceItem?.grantedFeatures ?? [],
    racialXpPercent: racialXp,
    racialXpLabel: racialXp === 0 ? "" : `${racialXp > 0 ? "+" : ""}${racialXp}%`,
    languagesMax: input.derived.languagesKnown.max,
    resources: src.system.resources,
  };
}

/* ---------- traits + character-point ledger (SP8 Plan 8c) ---------- */

function signedAmount(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function traitTargetKey(effect: TraitEffect, config: Pick<CharacterSheetInput["config"], "abilities" | "saves">): string {
  switch (effect.kind) {
    case "abilityBonus":
      return config.abilities[effect.ability];
    case "saveBonus":
      return config.saves[effect.save];
    case "attackBonus":
      return `ADND2E.sheet.traits.mode.${effect.mode}`;
    case "proficiencySlots":
      return `ADND2E.sheet.traits.track.${effect.track}`;
    case "bonusHp":
      return "ADND2E.sheet.traits.target.hp";
  }
}

function buildTraits(input: CharacterSheetInput): CharacterSheetContext["traits"] {
  const src = input.source as unknown as SourceView;
  const items = input.traitItems ?? [];
  const pool = src.system.options?.skillsAndPowers?.characterPoints?.pool ?? DEFAULT_CHARACTER_POINT_POOL;
  // null while the rule is off — the ledger IS the gate (never restate it here)
  const ledger = characterPointLedgerFor(input.optionalRules, {
    pool,
    abilities: src.system.abilities,
    traitCosts: items.map((t) => t.cost),
  });
  const rows: TraitRow[] = items.map((t) => {
    const effect = toTraitEffect(t.effect);
    return {
      id: t.id,
      name: t.name,
      img: t.img,
      cost: t.cost,
      active: effect !== null,
      summaryAmount: effect ? signedAmount(effect.amount) : "—",
      summaryTargetKey: effect ? traitTargetKey(effect, input.config) : "ADND2E.sheet.traits.target.none",
      canRemove: input.perms.editable,
    };
  });
  return {
    enabled: ledger !== null,
    canEditPool: input.perms.isGM && input.perms.editable,
    pool,
    ledger,
    rows: ledger ? rows : [],
    refundCapped: ledger !== null && ledger.refundUncapped > ledger.refund,
  };
}

/* ---------- entry point ---------- */

export function buildCharacterSheetContext(input: CharacterSheetInput): CharacterSheetContext {
  const favs = normalizeFavorites(input.favorites);
  const fav: FavCheck = (kind, id) => isFavorite(favs, kind, id);

  // Built first — the Favorites panel below needs their FINAL canCast/usable
  // values (e.g. a memorized-and-not-expended spell, a currently-allocatable
  // thief skill), not the raw item data.
  const skills = buildSkills(input, fav);
  const spells = buildSpells(input, fav);
  const thiefArmorDisabled = skills.thief?.armorDisabled ?? false;
  const psionics = buildPsionicsView(input.psionics);
  const wildTalent = buildWildTalentView(input);

  return {
    identity: buildIdentity(input),
    abilities: buildAbilities(input),
    subAbilities: buildSubAbilities(input),
    vitals: buildVitals(input),
    classes: buildClasses(input),
    dualClassToggle: buildDualClassToggle(input),
    inventory: buildInventory(input, fav),
    combat: buildCombat(input, fav),
    skills,
    spells,
    features: buildFeatures(input),
    traits: buildTraits(input),
    biography: {
      detailFields: [...DETAIL_FIELDS],
      showGmNotes: input.perms.isGM,
    },
    tabs: psionics ? [...TABS_DEF.slice(0, 4), PSIONICS_TAB, ...TABS_DEF.slice(4)] : [...TABS_DEF],
    psionics,
    wildTalent,
    lock: lockState(input.perms.editable, input.unlocked === true),
    favorites: {
      canFavorite: input.perms.isOwner,
      rows: buildFavoriteRows(favs, {
        items: input.physicalItems.map((i) => ({ id: i.id, name: i.name, img: i.img, type: i.type, equipped: i.equipped })),
        spells: spells.known.flatMap((g) => g.items.map((i) => ({ id: i.id, name: i.name, img: i.img, canCast: i.canCast }))),
        // worn armor disabling thief skills entirely (skills.thief.armorDisabled)
        // must also disable an already-favorited thief skill's one-click button.
        thiefSkills: (skills.thief?.items ?? []).map((t) => ({ ...t, usable: t.usable && !thiefArmorDisabled })),
      }),
    },
  };
}
