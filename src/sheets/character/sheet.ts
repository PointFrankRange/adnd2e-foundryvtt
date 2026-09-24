import { TEMPLATE_PATH } from "../../constants";
import { subAbilitiesEnabled } from "../../core/abilities/sub-abilities";
import { getChassis } from "../../core/classes/chassis";
import type { ManeuverId } from "../../core/combat/maneuvers";
import { nonweaponSlotCost } from "../../core/proficiencies/nonweapon";
import type { RawTraitEffect } from "../../core/skills/traits";
import type { ArmorType, ClassId, NonweaponGroup, SaveCategory, ThiefSkill } from "../../core/types";
import { getOptionalRules } from "../../settings";
import { rollAttack, rollSave } from "./combat-rolls";
import { buildCharacterSheetContext } from "./context";
import type {
  ClassItemView,
  CharacterSheetInput,
  FeatureItemView,
  NwpView,
  PhysicalItemView,
  RaceItemView,
  SpellItemView,
  TraitItemView,
  WeaponProfView,
} from "./context-types";
import { validateItemDrop } from "./drop-rules";
import { rollHitPoints } from "./hp-roll";
import { advanceWeaponMastery, allocateThiefSkillPoint, deallocateThiefSkillPoint, rollNonweaponCheck, rollThiefSkill } from "./proficiency-actions";
import { castSpell, forgetSpell, learnSpell, memorizeSpell, restSpellcasting } from "./spell-actions";
import { seedSubAbilities } from "./sub-ability-actions";
import { removeTrait, traitDropInputs, traitRefundCapped, type TraitDropInputs } from "./trait-actions";
import { awardXpSplit } from "./xp";

/* ---------------------------------------------------------------------------
 * Adnd2eCharacterSheet — the ApplicationV2 PC sheet shell (SP2 Task 5).
 *
 * Foundry-coupled, no unit tests (spec §9) — verified in a linked dev world at
 * Task 9. All rendering data is produced by the pure `buildCharacterSheetContext`
 * (Task 4); this class only reads the document, assembles the plain input, and
 * wires tabs / drop validation / action stubs.
 * ------------------------------------------------------------------------- */

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

// ActorSheetV2 extends DocumentSheetV2 directly (no HandlebarsApplicationMixin
// in v14.364 — verified in client/applications/sheets/actor-sheet.mjs), so the
// mixin is applied here, same as the SP1 stub over DocumentSheetV2. Collapse the
// mixin's `TBase & (new () => …)` intersection to a single constructor to dodge
// TS2510, then re-describe the members this class actually touches.
const Base = HandlebarsApplicationMixin(ActorSheetV2 as never) as unknown as new (
  ...args: never[]
) => {
  actor: Actor.Implementation;
  document: Actor.Implementation;
  element: HTMLElement;
  isEditable: boolean;
  _prepareContext(options: unknown): Promise<Record<string, unknown>>;
  _preparePartContext(
    partId: string,
    context: Record<string, unknown>,
    options: unknown,
  ): Promise<Record<string, unknown>>;
  _onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown>;
  _onRender(context: unknown, options: unknown): Promise<void>;
};

const T = (p: string): string => TEMPLATE_PATH("actor/character", p);

/* ---------- item -> *View mappers (mechanical field projection) ---------- */

interface RawItem {
  id: string;
  name: string;
  img: string;
  type: string;
  system: Record<string, unknown>;
}

/** `RawItem` plus the mutator the Task 8 interaction handlers need. */
interface RawItemHandle extends RawItem {
  update(data: Record<string, unknown>): Promise<unknown>;
}

export function toClassView(it: RawItem): ClassItemView {
  const s = it.system as {
    chassisId: string;
    xp: number;
    level: number;
    canLevelUp: boolean;
    dualClassState: string | null;
    specialistSchool: string | null;
  };
  return {
    id: it.id,
    name: it.name,
    img: it.img,
    chassisId: s.chassisId,
    hitDie: getChassis(s.chassisId as ClassId).hitDie,
    xp: s.xp,
    level: s.level,
    canLevelUp: s.canLevelUp,
    dualClassState: s.dualClassState as ClassItemView["dualClassState"],
    specialistSchool: s.specialistSchool,
  };
}

export function toRaceView(it: RawItem): RaceItemView {
  const s = it.system as {
    raceId: string;
    size: string;
    baseMovement: number;
    infravision: number;
    grantedFeatures: string[];
    bonusLanguages: string[];
  };
  return {
    id: it.id,
    name: it.name,
    img: it.img,
    raceId: s.raceId,
    size: s.size,
    baseMovement: s.baseMovement,
    infravision: s.infravision,
    grantedFeatures: [...(s.grantedFeatures ?? [])],
    bonusLanguages: [...(s.bonusLanguages ?? [])],
  };
}

export function rangeToString(range: unknown): string | null {
  if (!range || typeof range !== "object") return null;
  const r = range as { short: number; medium: number; long: number };
  return `${r.short}/${r.medium}/${r.long}`;
}

export function toPhysicalView(it: RawItem): PhysicalItemView {
  const s = it.system as Record<string, unknown>;
  const type = it.type as PhysicalItemView["type"];
  const view: PhysicalItemView = {
    id: it.id,
    name: it.name,
    img: it.img,
    type,
    quantity: Number(s.quantity ?? 0),
    weight: Number(s.weight ?? 0),
    totalWeight: Number(s.totalWeight ?? 0),
    location: String(s.location ?? ""),
    equipped: Boolean(s.equipped),
    identified: Boolean(s.identified),
    magicBonus: Number(s.magicBonus ?? 0),
    isContainer: type === "equipment" ? Boolean(s.container) : false,
    capacity: type === "equipment" ? ((s.capacity as number | null) ?? null) : null,
    contentsWeightMultiplier:
      type === "equipment" ? Number(s.contentsWeightMultiplier ?? 1) : 1,
  };
  if (type === "weapon") {
    view.weapon = {
      damageVsSM: (s.damageVsSM as string | null) ?? null,
      damageVsL: (s.damageVsL as string | null) ?? null,
      speedFactor: Number(s.speedFactor ?? 0),
      range: rangeToString(s.range),
      category: (s.category as "melee" | "thrown" | "bow" | "crossbow" | undefined) ?? "melee",
      damageType: (s.damageType as PhysicalItemView["weapon"] extends undefined ? never : NonNullable<PhysicalItemView["weapon"]>["damageType"]) ?? null,
    };
  }
  if (type === "armor") {
    view.armor = {
      baseAc: Number(s.baseAc ?? 10),
      isShield: Boolean(s.isShield),
      shieldAcBonus: Number(s.shieldAcBonus ?? 0),
      armorType: (s.armorType as ArmorType | undefined) ?? "none",
    };
  }
  return view;
}

export function toWeaponProfView(it: RawItem): WeaponProfView {
  const s = it.system as {
    weaponOrGroup: string;
    isGroup: boolean;
    slotsInvested: number;
    masteryTier: 0 | 1 | 2 | 3;
  };
  return {
    id: it.id,
    name: it.name,
    weaponOrGroup: s.weaponOrGroup,
    isGroup: s.isGroup,
    slotsInvested: s.slotsInvested,
    masteryTier: s.masteryTier,
    // Placeholders — buildWeaponProfRow (context.ts) recomputes both from
    // the actor's owned weapon Items + class chassis + available slots.
    category: null,
    masteryTierLabelKey: null,
    canAdvanceMastery: false,
  };
}

export function toNwpView(it: RawItem): NwpView {
  const s = it.system as {
    governingAbility: string;
    modifier: number;
    slotCost: number;
    slotsInvested: number;
    isRacial: boolean;
  };
  return {
    id: it.id,
    name: it.name,
    governingAbility: s.governingAbility,
    modifier: s.modifier,
    slotCost: s.slotCost,
    slotsInvested: s.slotsInvested,
    isRacial: s.isRacial,
    governingAbilityLabel: "", // buildNwpRow fills this from config.abilities
    checkTarget: null, // buildSkills recomputes from the governing ability score
  };
}

export function toSpellView(it: RawItem, spellbookIds: Set<string>): SpellItemView {
  const s = it.system as {
    casterClass: string;
    level: number;
    schools: string[];
    spheres: string[];
    range: string;
    castingTime: string;
    savingThrow: string;
  };
  return {
    id: it.id,
    name: it.name,
    img: it.img,
    casterClass: s.casterClass,
    level: s.level,
    schools: [...(s.schools ?? [])],
    spheres: [...(s.spheres ?? [])],
    range: s.range,
    castingTime: s.castingTime,
    savingThrow: s.savingThrow,
    inSpellbook: spellbookIds.has(it.id),
    // Placeholders — buildSpells (context.ts) recomputes all five from the
    // actor's memorized list + slot state + spellbook/sphere-access/learn eligibility.
    memorized: false,
    expended: false,
    canMemorize: false,
    canCast: false,
    canLearn: false,
  };
}

export function toFeatureView(it: RawItem): FeatureItemView {
  const s = it.system as {
    sourceType: string;
    activation: string;
    uses: { value: number; max: number; per: string } | null;
    description: string;
  };
  return {
    id: it.id,
    name: it.name,
    img: it.img,
    sourceType: s.sourceType,
    activation: s.activation,
    uses: s.uses ?? null,
    description: s.description ?? "",
  };
}

export function toTraitView(it: RawItem): TraitItemView {
  const s = it.system as { traitId: string; cost: number; effect: RawTraitEffect };
  return { id: it.id, name: it.name, img: it.img, traitId: s.traitId, cost: s.cost, effect: { ...s.effect } };
}

/* ------------------------------------------------------------------------- */

export class Adnd2eCharacterSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "actor", "character"],
    position: { width: 720, height: 800 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollHp: Adnd2eCharacterSheet.#onRollHp,
      takeAverageHp: Adnd2eCharacterSheet.#onTakeAverageHp,
      seedSubAbilities: Adnd2eCharacterSheet.#onSeedSubAbilities,
      removeTrait: Adnd2eCharacterSheet.#onRemoveTrait,
      awardXp: Adnd2eCharacterSheet.#onAwardXp,
      toggleDualClass: Adnd2eCharacterSheet.#onToggleDualClass,
      rollAttack: Adnd2eCharacterSheet.#onRollAttack,
      rollSave: Adnd2eCharacterSheet.#onRollSave,
      memorizeSpell: Adnd2eCharacterSheet.#onMemorizeSpell,
      forgetSpell: Adnd2eCharacterSheet.#onForgetSpell,
      castSpell: Adnd2eCharacterSheet.#onCastSpell,
      restSpellcasting: Adnd2eCharacterSheet.#onRestSpellcasting,
      learnSpell: Adnd2eCharacterSheet.#onLearnSpell,
      advanceWeaponMastery: Adnd2eCharacterSheet.#onAdvanceWeaponMastery,
      rollNonweaponCheck: Adnd2eCharacterSheet.#onRollNonweaponCheck,
      allocateThiefSkillPoint: Adnd2eCharacterSheet.#onAllocateThiefSkillPoint,
      deallocateThiefSkillPoint: Adnd2eCharacterSheet.#onDeallocateThiefSkillPoint,
      rollThiefSkill: Adnd2eCharacterSheet.#onRollThiefSkill,
    },
  };

  static PARTS = {
    header: { template: T("header.hbs") },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    main: {
      template: T("main.hbs"),
      scrollable: [""],
      templates: [
        T("partials/ability-row.hbs"),
        T("partials/save-row.hbs"),
        T("partials/class-row.hbs"),
      ],
    },
    combat: { template: T("combat.hbs"), scrollable: [""] },
    inventory: { template: T("inventory.hbs"), scrollable: [""] },
    skills: { template: T("skills.hbs"), scrollable: [""] },
    spells: { template: T("spells.hbs"), scrollable: [""] },
    features: { template: T("features.hbs"), scrollable: [""] },
    biography: { template: T("biography.hbs"), scrollable: [""] },
  };

  static TABS = {
    primary: {
      initial: "main",
      labelPrefix: "ADND2E.sheet.tabs",
      tabs: [
        { id: "main", icon: "fa-solid fa-user" },
        { id: "combat", icon: "fa-solid fa-shield-halved" },
        { id: "inventory", icon: "fa-solid fa-box-open" },
        { id: "skills", icon: "fa-solid fa-hand-fist" },
        { id: "spells", icon: "fa-solid fa-wand-sparkles" },
        { id: "features", icon: "fa-solid fa-star" },
        { id: "biography", icon: "fa-solid fa-book" },
      ],
    },
  };

  override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    context.adnd2e = buildCharacterSheetContext(this.#buildInput());
    context.editable = this.isEditable;
    context.notEditable = !this.isEditable;
    // The SYSTEM DataModel's own schema — distinct from `context.fields`,
    // which DocumentSheetV2._prepareContext already exposes as the actor's
    // top-level (name/img/system/…) schema. Needed so biography.hbs can
    // render the rich-text fields via the real `{{formInput}}` field helper
    // (a genuine self-activating <prose-mirror> element) instead of the
    // standalone `{{editor}}` helper, whose "edit" button is only ever wired
    // up by the legacy appv1 FormApplication/DocumentSheet API and is inert
    // under ApplicationV2.
    context.systemFields = (this.document as unknown as {
      system: { schema: { fields: Record<string, unknown> } };
    }).system.schema.fields;
    context.alignments = (
      CONFIG as unknown as { ADND2E: { alignments: Record<string, string> } }
    ).ADND2E.alignments;
    return context;
  }

  override async _preparePartContext(
    partId: string,
    context: Record<string, unknown>,
    options: unknown,
  ): Promise<Record<string, unknown>> {
    const ctx = await super._preparePartContext(partId, context, options);
    const tabs = ctx.tabs as Record<string, unknown> | undefined;
    if (tabs && partId in tabs) ctx.tab = tabs[partId];
    return ctx;
  }

  #buildInput(): CharacterSheetInput {
    const actor = this.document as unknown as {
      name: string;
      img: string;
      _source: Record<string, unknown>;
      system: Record<string, unknown>;
      isOwner: boolean;
      items: Iterable<RawItem>;
    };
    const items = [...actor.items];
    const cfg = (CONFIG as unknown as { ADND2E: Record<string, Record<string, string>> }).ADND2E;
    const spellbookIds = new Set(
      (actor.system as { spellcasting?: { wizard?: { spellbookItemIds?: string[] } } }).spellcasting
        ?.wizard?.spellbookItemIds ?? [],
    );

    const classItems: ClassItemView[] = [];
    let raceItem: RaceItemView | null = null;
    const physicalItems: PhysicalItemView[] = [];
    const weaponProfs: WeaponProfView[] = [];
    const nonweaponProfs: NwpView[] = [];
    const spellItems: SpellItemView[] = [];
    const featureItems: FeatureItemView[] = [];
    const traitItems: TraitItemView[] = [];

    for (const it of items) {
      switch (it.type) {
        case "class":
          classItems.push(toClassView(it));
          break;
        case "race":
          raceItem ??= toRaceView(it);
          break;
        case "weapon":
        case "armor":
        case "equipment":
          physicalItems.push(toPhysicalView(it));
          break;
        case "weaponProficiency":
          weaponProfs.push(toWeaponProfView(it));
          break;
        case "nonweaponProficiency":
          nonweaponProfs.push(toNwpView(it));
          break;
        case "spell":
          spellItems.push(toSpellView(it, spellbookIds));
          break;
        case "classFeature":
          featureItems.push(toFeatureView(it));
          break;
        case "trait":
          traitItems.push(toTraitView(it));
          break;
        default:
          break;
      }
    }

    const rules = getOptionalRules();
    return {
      name: actor.name,
      img: actor.img,
      source: actor._source,
      derived: actor.system as never,
      classItems,
      raceItem,
      physicalItems,
      proficiencyItems: { weapon: weaponProfs, nonweapon: nonweaponProfs },
      thiefSkillAllocations: [
        ...(actor.system as { thiefSkills: { allocations: { skill: ThiefSkill; allocatedPoints: number }[] } })
          .thiefSkills.allocations,
      ],
      spellItems,
      featureItems,
      traitItems,
      config: {
        abilities: cfg.abilities,
        saves: cfg.saves,
        alignments: cfg.alignments,
        encumbranceCategories: cfg.encumbranceCategories,
        classGroups: cfg.classGroups,
        schools: cfg.schools,
        spheres: cfg.spheres,
      },
      perms: {
        isGM: (game as unknown as { user: { isGM: boolean } }).user.isGM,
        isOwner: actor.isOwner,
        editable: this.isEditable,
      },
      optionalRules: rules,
      subAbilityUi: subAbilitiesEnabled(rules),
    };
  }

  override async _onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown> {
    const actor = this.document as unknown as {
      system: { proficiencies: { weapon: { available: number }; nonweapon: { available: number } } };
      items: Iterable<{
        type: string;
        system: { chassisId?: string | null; slotCost?: number; group?: NonweaponGroup };
      }>;
    };
    const existing = [...actor.items];
    const dropped = item as unknown as {
      type: string;
      system: { chassisId?: string | null; slotCost?: number; group?: NonweaponGroup };
    };
    const isNewDrop =
      (item as unknown as { parent?: { uuid?: string } }).parent?.uuid !==
      (this.document as unknown as { uuid: string }).uuid;
    // Re-sorting an already-owned trait is not a purchase — never validated.
    if (dropped.type === "trait" && !isNewDrop) return super._onDropItem(event, item);
    // Re-derived from the actor's CURRENT authored state + settings at drop time.
    const traitInputs: Partial<TraitDropInputs> =
      dropped.type === "trait" ? traitDropInputs(this.document as never, dropped as never) : {};

    let dropSlotCost: number | undefined;
    let availableSlots: number | undefined;
    if (dropped.type === "weaponProficiency") {
      dropSlotCost = 1;
      availableSlots = actor.system.proficiencies.weapon.available;
    } else if (dropped.type === "nonweaponProficiency") {
      const firstClassId = existing.find((i) => i.type === "class")?.system.chassisId ?? null;
      dropSlotCost = firstClassId
        ? nonweaponSlotCost(dropped.system.slotCost ?? 1, dropped.system.group ?? "general", firstClassId as never)
        : (dropped.system.slotCost ?? 1);
      availableSlots = actor.system.proficiencies.nonweapon.available;
    }

    const verdict = validateItemDrop({
      dropType: dropped.type,
      dropChassisId: dropped.system?.chassisId ?? null,
      hasRace: existing.some((i) => i.type === "race"),
      existingChassisIds: existing
        .filter((i) => i.type === "class")
        .map((i) => i.system.chassisId ?? "")
        .filter(Boolean),
      dropSlotCost,
      availableSlots,
      ...traitInputs,
    });
    if (!verdict.ok) {
      ui.notifications?.warn(game.i18n!.localize(verdict.reason!));
      return null;
    }

    const result = await super._onDropItem(event, item);
    if (
      result &&
      isNewDrop &&
      dropSlotCost !== undefined &&
      (dropped.type === "weaponProficiency" || dropped.type === "nonweaponProficiency")
    ) {
      await (result as unknown as { update(data: Record<string, unknown>): Promise<unknown> }).update({
        "system.slotsInvested": dropSlotCost,
      });
    }
    if (result && isNewDrop && dropped.type === "trait" && traitRefundCapped(traitInputs)) {
      ui.notifications?.info(game.i18n!.localize("ADND2E.sheet.traits.refundCappedToast"));
    }
    return result;
  }

  override async _onRender(context: unknown, options: unknown): Promise<void> {
    await super._onRender(context, options);
    const fields = Array.from(
      this.element.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-item-id][data-field]"),
    );
    for (const el of fields) {
      el.addEventListener("change", () => {
        void this.#onItemFieldChange(el);
      });
    }
  }

  async #onItemFieldChange(el: HTMLInputElement | HTMLSelectElement): Promise<void> {
    const item = this.#getClassOrItem(el.dataset.itemId);
    if (!item) return;
    const field = el.dataset.field;
    if (!field) return;
    const value =
      el instanceof HTMLInputElement && el.type === "checkbox"
        ? el.checked
        : el instanceof HTMLInputElement && el.type === "number"
          ? Number(el.value)
          : el.value;
    await item.update({ [`system.${field}`]: value });
  }

  #getClassOrItem(id: string | undefined): RawItemHandle | undefined {
    if (!id) return undefined;
    return (this.document as unknown as { items: { get(id: string): RawItemHandle | undefined } }).items.get(
      id,
    );
  }

  #classItems(): RawItemHandle[] {
    return [...(this.document as unknown as { items: Iterable<RawItemHandle> }).items].filter(
      (i) => i.type === "class",
    );
  }

  // Interaction handlers — SP2 Task 8.
  static async #onRollHp(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const item = this.#getClassOrItem(target.dataset.classId);
    if (item) await rollHitPoints(item as never, { average: false });
  }

  static async #onTakeAverageHp(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const item = this.#getClassOrItem(target.dataset.classId);
    if (item) await rollHitPoints(item as never, { average: true });
  }

  static async #onSeedSubAbilities(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    _target: HTMLElement,
  ): Promise<void> {
    await seedSubAbilities(this.document as never);
  }

  static async #onRemoveTrait(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const itemId = target.dataset.itemId;
    if (itemId && this.isEditable) await removeTrait(this.document as never, itemId);
  }

  static async #onAwardXp(this: Adnd2eCharacterSheet): Promise<void> {
    const amount = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n!.localize("ADND2E.sheet.xp.award") },
      content: `<p>${game.i18n!.localize("ADND2E.sheet.xp.awardPrompt")}</p>
        <input type="number" name="amount" value="0" step="1" autofocus>`,
      ok: {
        label: game.i18n!.localize("ADND2E.sheet.xp.award"),
        callback: (_event: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
          const input = button.form?.elements.namedItem("amount");
          return input instanceof HTMLInputElement ? input.valueAsNumber : NaN;
        },
      },
    });
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return;
    const classItems = this.#classItems();
    const share = awardXpSplit(amount, classItems.length);
    await Promise.all(
      classItems.map((c) => c.update({ "system.xp": (Number(c.system.xp) || 0) + share })),
    );
  }

  static async #onToggleDualClass(this: Adnd2eCharacterSheet): Promise<void> {
    const classItems = this.#classItems();
    if (classItems.length !== 2) return;
    const anyDual = classItems.some((c) => c.system.dualClassState !== null);
    if (anyDual) {
      await Promise.all(classItems.map((c) => c.update({ "system.dualClassState": null })));
    } else {
      // Ascending by level: index 0 is the freshly-added (lower-level) class
      // ("active"); index 1 is the abandoned, higher-level class ("primary") —
      // see resolveDualClass in core/classes/multiclass.ts. Only ever runs with
      // exactly 2 class items, per the length guard above.
      const [active, primary] = [...classItems].sort(
        (a, b) => (Number(a.system.level) || 1) - (Number(b.system.level) || 1),
      );
      await primary.update({ "system.dualClassState": "primary" });
      await active.update({ "system.dualClassState": "active" });
    }
  }

  // Interaction handlers — SP3 Task 5.
  static async #onRollAttack(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const weaponItemId = target.dataset.itemId;
    if (!weaponItemId) return;
    const weaponRow = target.closest(".weapon-row");
    const backstabCheckbox = weaponRow?.querySelector<HTMLInputElement>(".backstab-toggle");
    const maneuverSelect = weaponRow?.querySelector<HTMLSelectElement>(".maneuver-select");
    const maneuverId = (maneuverSelect?.value || null) as ManeuverId | null;
    await rollAttack(this.document as never, weaponItemId, backstabCheckbox?.checked ?? false, maneuverId);
  }

  static async #onRollSave(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const category = target.dataset.save as SaveCategory | undefined;
    if (category) await rollSave(this.document as never, category);
  }

  // Interaction handlers — SP4a.
  static async #onMemorizeSpell(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const spellItemId = target.dataset.itemId;
    if (spellItemId) await memorizeSpell(this.document as never, spellItemId);
  }

  static async #onForgetSpell(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const spellItemId = target.dataset.itemId;
    if (spellItemId) await forgetSpell(this.document as never, spellItemId);
  }

  static async #onCastSpell(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const spellItemId = target.dataset.itemId;
    if (spellItemId) await castSpell(this.document as never, spellItemId);
  }

  static async #onRestSpellcasting(this: Adnd2eCharacterSheet): Promise<void> {
    await restSpellcasting(this.document as never);
  }

  static async #onLearnSpell(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const spellItemId = target.dataset.itemId;
    if (spellItemId) await learnSpell(this.document as never, spellItemId);
  }

  // Interaction handlers — SP5a.
  static async #onAdvanceWeaponMastery(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const weaponProfItemId = target.dataset.itemId;
    if (weaponProfItemId) await advanceWeaponMastery(this.document as never, weaponProfItemId);
  }

  static async #onRollNonweaponCheck(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const nwpItemId = target.dataset.itemId;
    if (nwpItemId) await rollNonweaponCheck(this.document as never, nwpItemId);
  }

  static async #onAllocateThiefSkillPoint(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const skill = target.dataset.skill;
    if (skill) await allocateThiefSkillPoint(this.document as never, skill as never);
  }

  static async #onDeallocateThiefSkillPoint(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const skill = target.dataset.skill;
    if (skill) await deallocateThiefSkillPoint(this.document as never, skill as never);
  }

  static async #onRollThiefSkill(
    this: Adnd2eCharacterSheet,
    _event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const skill = target.dataset.skill;
    if (skill) await rollThiefSkill(this.document as never, skill as never);
  }
}

// Pin the class name so DocumentSheetConfig.registerSheet's id (adnd2e.<name>)
// survives minification.
Object.defineProperty(Adnd2eCharacterSheet, "name", {
  value: "Adnd2eCharacterSheet",
  configurable: true,
});
