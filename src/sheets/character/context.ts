import type { ArmorType, BardSkill, ClassId, DexterityModifiers, IntelligenceModifiers, Race, SphereName, WizardSchool } from "../../core/types";
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
  TabDescriptor,
  ThiefSkillRow,
  TraitRow,
  WeaponProfView,
} from "./context-types";
import { mainScoreFromSubs, SUB_ABILITIES } from "../../core/abilities/sub-abilities";
import { getChassis } from "../../core/classes/chassis";
import { MANEUVERS } from "../../core/combat/maneuvers";
import { canCompleteCasting } from "../../core/magic/casting-time";
import { canLearnSpell } from "../../core/magic/spellbook";
import { characterPointLedgerFor, DEFAULT_CHARACTER_POINT_POOL } from "../../core/skills/character-points";
import { toTraitEffect, type TraitEffect } from "../../core/skills/traits";
import { canWeaponSpecialize } from "../../core/proficiencies/weapon";
import { weaponMasteryTierCost } from "../../core/proficiencies/weapon-mastery";
import { bardSkillBaseScore, classifyThiefArmor, resolveBardSkill, resolveThiefSkill, thiefSkillBaseScore, thiefSkillPerSkillCap } from "../../core/proficiencies/thief-skills";
import { canBackstab } from "../../core/weapons/backstab";
import { WIZARD_SCHOOLS } from "../../data/item/choices";
import { canMemorizePriestSpell } from "../../magic/priest-sphere-access";
import { groupInventory } from "./grouping";
import { xpToNext } from "./xp";

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

const TABS_DEF: readonly TabDescriptor[] = [
  { id: "main", label: "ADND2E.sheet.tabs.main", icon: "fa-solid fa-user" },
  { id: "combat", label: "ADND2E.sheet.tabs.combat", icon: "fa-solid fa-shield-halved" },
  { id: "inventory", label: "ADND2E.sheet.tabs.inventory", icon: "fa-solid fa-box-open" },
  { id: "skills", label: "ADND2E.sheet.tabs.skills", icon: "fa-solid fa-hand-fist" },
  { id: "spells", label: "ADND2E.sheet.tabs.spells", icon: "fa-solid fa-wand-sparkles" },
  { id: "features", label: "ADND2E.sheet.tabs.features", icon: "fa-solid fa-star" },
  { id: "biography", label: "ADND2E.sheet.tabs.biography", icon: "fa-solid fa-book" },
];

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
  return ABILITY_KEYS.map((key) => {
    const authored = src.system.abilities[key];
    const derived = input.derived.abilities[key];
    const sub = authored.sub ?? { a: null, b: null };
    // While the rule is on, the displayed main score is the averaged (pre-racial)
    // value — the same pure function prepareBaseData uses — so racialDelta below
    // is only the racial part. Off: the authored score, exactly as before.
    const score = subsOn ? mainScoreFromSubs(sub.a, sub.b, authored.score) : authored.score;
    const effectiveScore = derived.score;
    const mods = Object.entries(derived.mods).map(([k, v]) => ({
      label: humanize(k),
      value: v == null ? "—" : String(v),
    }));
    const [idA, idB] = SUB_ABILITIES[key];
    return {
      key,
      label: input.config.abilities[key],
      score,
      racialDelta: effectiveScore - score,
      effectiveScore,
      exceptional: authored.exceptional,
      showExceptional: key === "str" && Number(score) === 18,
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
    };
  });
  return {
    hp: a.hp,
    thac0: a.thac0,
    ac: a.ac,
    saves,
    movement: {
      base: a.movement.base,
      current: a.movement.current,
      encumbranceCategory: a.movement.encumbranceCategory,
      encumbranceCategoryLabel: input.config.encumbranceCategories[a.movement.encumbranceCategory],
    },
    casting: Boolean(input.castingStatus),
  };
}

/* ---------- classes ---------- */

function buildClasses(input: CharacterSheetInput): ClassRow[] {
  return input.classItems.map((c) => {
    const progress = xpToNext(c.chassisId as ClassId, c.xp);
    return {
      id: c.id,
      name: c.name,
      chassisId: c.chassisId,
      level: c.level,
      xp: c.xp,
      xpToNextLevel: progress.toNextLevel,
      xpPct: progress.pct,
      nextThreshold: progress.next,
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

function buildInventory(input: CharacterSheetInput): CharacterSheetContext["inventory"] {
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
  return { containers, loose, encumbrance, currency: src.system.currency, locationOptions };
}

/* ---------- combat ---------- */

function buildCombat(input: CharacterSheetInput): CharacterSheetContext["combat"] {
  const isThief = input.classItems.some((c) => c.chassisId === "thief");
  const weapons = input.physicalItems
    .filter((i) => i.type === "weapon")
    .map((i) => {
      const w = i.weapon as NonNullable<PhysicalItemView["weapon"]>;
      return {
        id: i.id,
        name: i.name,
        equipped: i.equipped,
        toHitNote: "",
        damageNote: [w.damageVsSM, w.damageVsL].filter(Boolean).join(" / "),
        speedFactor: w.speedFactor,
        range: w.range,
        canBackstab: isThief && canBackstab({ category: w.category, damageType: w.damageType }),
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

function buildSkills(input: CharacterSheetInput): CharacterSheetContext["skills"] {
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
    thief: buildThiefSkills(input),
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
function buildThiefSkills(input: CharacterSheetInput): CharacterSheetContext["skills"]["thief"] {
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
    const ctx = { race, dexterity: dexScore, armor: armorCategory as never };
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
  const weapon = physicalItems.find((p) => p.type === "weapon" && p.name === prof.weaponOrGroup);
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

function buildSpells(input: CharacterSheetInput): CharacterSheetContext["spells"] {
  const sc = input.derived.spellcasting;
  const school = sc.wizard.specialistSchool;
  const priestChassisId =
    input.classItems.find((c) => getChassis(c.chassisId as ClassId).spellProgressionId === "priest")
      ?.chassisId ?? null;
  const sphereAccessOverride = sc.priest.sphereAccessOverride as SphereName[] | null;
  const int = input.derived.abilities.int.mods as IntelligenceModifiers;
  const specialistSchool = school as WizardSchool | null;
  const casting = buildCastingPanel(input);

  const known: { level: number; items: SpellItemView[] }[] = [];
  for (let level = 1; level <= 9; level += 1) {
    const levelItems = input.spellItems.filter((s) => s.level === level);
    const knownAtThisLevel = levelItems.filter((s) => s.casterClass === "wizard" && s.inSpellbook).length;
    const castableAtThisLevel = (sc.wizard.slots[level]?.max ?? 0) > 0;
    const learnCtx: LearnEligibilityContext = {
      int, specialistSchool, knownAtThisLevel, castableAtThisLevel, optionalRules: input.optionalRules,
    };
    let items = levelItems.map((s) => buildSpellRow(s, sc, priestChassisId, sphereAccessOverride, learnCtx));
    items = casting ? items.map((r) => ({ ...r, canCast: false })) : items;
    if (items.length > 0) known.push({ level, items });
  }
  return {
    wizardSlots: toSlotRows(sc.wizard.slots),
    priestSlots: toSlotRows(sc.priest.slots),
    specialistSchoolLabel: school ? input.config.schools[school] : null,
    known,
    orphaned: buildOrphanedSpells(input, sc),
    casting,
  };
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
    if (!knownIds.has(m.spellItemId)) {
      orphaned.push({ spellItemId: m.spellItemId, casterClass: "wizard", spellLevel: m.spellLevel });
    }
  }
  for (const m of sc.priest.memorized) {
    if (!knownIds.has(m.spellItemId)) {
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
): SpellItemView {
  const isWizard = item.casterClass === "wizard";
  const memorizedList = isWizard ? sc.wizard.memorized : sc.priest.memorized;
  const entry = memorizedList.find((m) => m.spellItemId === item.id);
  const memorized = Boolean(entry);
  const expended = entry?.expended ?? false;

  const slots = isWizard ? sc.wizard.slots : sc.priest.slots;
  const slotRow = slots[item.level];
  const hasFreeSlot = Boolean(slotRow) && slotRow.used < slotRow.max;

  const eligible = isWizard
    ? item.inSpellbook
    : canMemorizePriestSpell(priestChassisId, sphereAccessOverride, item.spheres as SphereName[], item.level);

  return {
    ...item,
    memorized,
    expended,
    canMemorize: !memorized && hasFreeSlot && eligible,
    canCast: memorized && !expended,
    canLearn: isWizard && !item.inSpellbook && canLearnForRow(item, learnCtx),
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
  return {
    groups,
    racialAbilities: input.raceItem?.grantedFeatures ?? [],
    languagesMax: input.derived.languagesKnown.max,
    resources: src.system.resources,
  };
}

/* ---------- traits + character-point ledger (SP8 Plan 8c) ---------- */

function signedAmount(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function traitTargetKey(effect: TraitEffect, config: CharacterSheetInput["config"]): string {
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
  return {
    identity: buildIdentity(input),
    abilities: buildAbilities(input),
    subAbilities: buildSubAbilities(input),
    vitals: buildVitals(input),
    classes: buildClasses(input),
    dualClassToggle: buildDualClassToggle(input),
    inventory: buildInventory(input),
    combat: buildCombat(input),
    skills: buildSkills(input),
    spells: buildSpells(input),
    features: buildFeatures(input),
    traits: buildTraits(input),
    biography: {
      detailFields: [...DETAIL_FIELDS],
      showGmNotes: input.perms.isGM,
    },
    tabs: [...TABS_DEF],
  };
}
