import { TEMPLATE_PATH } from "../../constants";
import type { ManeuverId } from "../../core/combat/maneuvers";
import { nonweaponSlotCost } from "../../core/proficiencies/nonweapon";
import type { NonweaponGroup, ThiefSkill } from "../../core/types";
import { getOptionalRules } from "../../settings";
import {
  toClassView,
  toFeatureView,
  toNwpView,
  toPhysicalView,
  toRaceView,
  toSpellView,
  toWeaponProfView,
} from "../character/sheet";
import { rollAttack, rollSave } from "../character/combat-rolls";
import { buildCharacterSheetContext } from "../character/context";
import type { CharacterSheetInput } from "../character/context-types";
import { rollHitPoints } from "../character/hp-roll";
import { advanceWeaponMastery, rollNonweaponCheck, rollThiefSkill } from "../character/proficiency-actions";
import { castSpell, forgetSpell, learnSpell, memorizeSpell, restSpellcasting } from "../character/spell-actions";

/* ---------------------------------------------------------------------------
 * Adnd2eNpcSheet — SP6 Task 4.
 *
 * A streamlined 3-tab sheet for `npc` actors. `npc` shares the exact same
 * DataModel schema as `character` (both were served by Adnd2eCharacterSheet
 * before this task), so this class reuses the SAME item-mapper functions
 * (now exported from character/sheet.ts), the SAME pure
 * `buildCharacterSheetContext` (character/context.ts, unchanged), and the
 * SAME action-function glue (combat-rolls / spell-actions / proficiency-
 * actions) the PC sheet already uses — zero new pure logic. Only the
 * template set (3 tabs instead of 7) and a couple of PC-only affordances
 * (XP award, dual-class toggle, drag-drop item validation — see this task's
 * report for the explicit scoping rulings) differ.
 *
 * Foundry-coupled, no unit tests (matches src/sheets/character/sheet.ts's
 * and src/sheets/creature/sheet.ts's established convention) — verified in a
 * linked dev world.
 * ------------------------------------------------------------------------- */

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

// Same TS2510-dodging collapse used by Adnd2eCharacterSheet / Adnd2eCreatureSheet:
// ActorSheetV2 extends DocumentSheetV2 directly (no HandlebarsApplicationMixin
// baked in under v14.364), so the mixin is applied here and the intersection is
// collapsed to a single constructor describing only the members this class
// touches. `_onDropItem` IS included (whole-branch-review I2 fix) — the
// duplicate-race/class and slot-overflow validation half PC sheet does stays
// intentionally out of scope on npc (v1 ruling), but the slotsInvested write
// does not: see this class's `_onDropItem` override below.
const Base = HandlebarsApplicationMixin(ActorSheetV2 as never) as unknown as new (
  ...args: never[]
) => {
  document: Actor.Implementation;
  element: HTMLElement;
  isEditable: boolean;
  _prepareContext(options: unknown): Promise<Record<string, unknown>>;
  _preparePartContext(
    partId: string,
    context: Record<string, unknown>,
    options: unknown,
  ): Promise<Record<string, unknown>>;
  _onRender(context: unknown, options: unknown): Promise<void>;
  _onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown>;
};

const T = (p: string): string => TEMPLATE_PATH("actor/npc", p);

/** Minimal shape needed to mutate an owned Item's `system.*` field from the
 *  `[data-item-id][data-field]` inputs the reused `item-row.hbs` partial
 *  renders (inventory quantity/location/equipped/identified) — same pattern
 *  as Adnd2eCharacterSheet's own `#onItemFieldChange`. */
interface RawItemHandle {
  id: string;
  type: string;
  system: Record<string, unknown>;
  update(data: Record<string, unknown>): Promise<unknown>;
}

export class Adnd2eNpcSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "actor", "npc"],
    position: { width: 640, height: 680 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollHp: Adnd2eNpcSheet.#onRollHp,
      takeAverageHp: Adnd2eNpcSheet.#onTakeAverageHp,
      rollAttack: Adnd2eNpcSheet.#onRollAttack,
      rollSave: Adnd2eNpcSheet.#onRollSave,
      memorizeSpell: Adnd2eNpcSheet.#onMemorizeSpell,
      forgetSpell: Adnd2eNpcSheet.#onForgetSpell,
      castSpell: Adnd2eNpcSheet.#onCastSpell,
      restSpellcasting: Adnd2eNpcSheet.#onRestSpellcasting,
      learnSpell: Adnd2eNpcSheet.#onLearnSpell,
      advanceWeaponMastery: Adnd2eNpcSheet.#onAdvanceWeaponMastery,
      rollNonweaponCheck: Adnd2eNpcSheet.#onRollNonweaponCheck,
      rollThiefSkill: Adnd2eNpcSheet.#onRollThiefSkill,
    },
  };

  static PARTS = {
    // Reuses the PC sheet's header verbatim (unchanged) — it renders only
    // `adnd2e.identity.*`/`adnd2e.vitals.*` fields, which this sheet's
    // reused `buildCharacterSheetContext` produces identically for `npc`
    // actors. No npc-specific header.hbs is created (nothing about it needs
    // to differ), per this task's explicit "reuse, don't duplicate" brief.
    header: { template: TEMPLATE_PATH("actor/character", "header.hbs") },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    main: { template: T("main.hbs"), scrollable: [""] },
    // Reuses the PC sheet's spells.hbs by path (byte-identical, no npc-specific
    // markup needed) — same "reuse, don't duplicate" pattern the header PART
    // above already follows (whole-branch-review I4 fix; was a duplicated file).
    spells: { template: TEMPLATE_PATH("actor/character", "spells.hbs"), scrollable: [""] },
    details: { template: T("details.hbs"), scrollable: [""] },
  };

  static TABS = {
    primary: {
      initial: "main",
      labelPrefix: "ADND2E.sheet.tabs",
      tabs: [
        { id: "main", icon: "fa-solid fa-user" },
        { id: "spells", icon: "fa-solid fa-wand-sparkles" },
        { id: "details", icon: "fa-solid fa-box-open" },
      ],
    },
  };

  override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    context.adnd2e = buildCharacterSheetContext(this.#buildInput());
    context.editable = this.isEditable;
    context.notEditable = !this.isEditable;
    // matches src/sheets/character/sheet.ts's own _prepareContext exactly —
    // `context.source` and `context.user` are already provided by
    // super._prepareContext(options) (DocumentSheetV2's own base behavior);
    // do not set them again here.
    context.systemFields = (this.document as unknown as {
      system: { schema: { fields: Record<string, unknown> } };
    }).system.schema.fields;
    context.alignments = (
      CONFIG as unknown as { ADND2E: { alignments: Record<string, string> } }
    ).ADND2E.alignments;
    // whole-branch-review I3 fix — system.npc.disposition's <select> needs the
    // CONFIG.ADND2E.dispositions label map, exposed the same way as `alignments`.
    context.dispositions = (
      CONFIG as unknown as { ADND2E: { dispositions: Record<string, string> } }
    ).ADND2E.dispositions;
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
      items: Iterable<Parameters<typeof toClassView>[0]>;
    };
    const items = [...actor.items];
    const cfg = (CONFIG as unknown as { ADND2E: Record<string, Record<string, string>> }).ADND2E;
    const spellbookIds = new Set(
      (actor.system as { spellcasting?: { wizard?: { spellbookItemIds?: string[] } } }).spellcasting
        ?.wizard?.spellbookItemIds ?? [],
    );

    const classItems: ReturnType<typeof toClassView>[] = [];
    let raceItem: ReturnType<typeof toRaceView> | null = null;
    const physicalItems: ReturnType<typeof toPhysicalView>[] = [];
    const weaponProfs: ReturnType<typeof toWeaponProfView>[] = [];
    const nonweaponProfs: ReturnType<typeof toNwpView>[] = [];
    const spellItems: ReturnType<typeof toSpellView>[] = [];
    const featureItems: ReturnType<typeof toFeatureView>[] = [];

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
        default:
          break;
      }
    }

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
      optionalRules: getOptionalRules(),
    };
  }

  // Job (b) of Adnd2eCharacterSheet._onDropItem, and ONLY job (b) (whole-branch-
  // review I2 fix): write the class-adjusted `slotsInvested` onto a newly
  // dropped weapon/nonweapon proficiency item. The validation half (duplicate
  // race/class guard, slot-overflow guard — job (a)) is intentionally NOT
  // reproduced here per the earlier v1 scoping ruling for this sheet. Without
  // this override the item silently kept its schema default of `1` instead of
  // the class-adjusted cost, which is worse than "skips a warning dialog" —
  // it's data that silently differs from what the same drop produces on a PC
  // sheet (checkTarget / spent-slot totals read wrong forever).
  override async _onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown> {
    const actor = this.document as unknown as {
      items: Iterable<{ type: string; system: { chassisId?: string | null } }>;
    };
    const dropped = item as unknown as {
      type: string;
      system: { slotCost?: number; group?: NonweaponGroup };
    };

    let dropSlotCost: number | undefined;
    if (dropped.type === "weaponProficiency") {
      dropSlotCost = 1;
    } else if (dropped.type === "nonweaponProficiency") {
      const firstClassId = [...actor.items].find((i) => i.type === "class")?.system.chassisId ?? null;
      dropSlotCost = firstClassId
        ? nonweaponSlotCost(dropped.system.slotCost ?? 1, dropped.system.group ?? "general", firstClassId as never)
        : (dropped.system.slotCost ?? 1);
    }

    const result = await super._onDropItem(event, item);
    const isNewDrop =
      (item as unknown as { parent?: { uuid?: string } }).parent?.uuid !==
      (this.document as unknown as { uuid: string }).uuid;
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
    return result;
  }

  // Wires the `[data-item-id][data-field]` inputs the reused `item-row.hbs`
  // partial renders (inventory quantity/location/equipped/identified) — same
  // pattern as Adnd2eCharacterSheet's own `_onRender`/`#onItemFieldChange`,
  // needed because `details.hbs` (this task's Step 6) folds in the PC
  // sheet's inventory panel content verbatim, partial and all.
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
    const item = this.#getItem(el.dataset.itemId);
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

  #getItem(id: string | undefined): RawItemHandle | undefined {
    if (!id) return undefined;
    return (this.document as unknown as { items: { get(id: string): RawItemHandle | undefined } }).items.get(id);
  }

  // Wires class-row.hbs's rollHp/takeAverageHp buttons — that partial is
  // reused verbatim from the PC sheet (see main.hbs) and renders these
  // buttons whenever a class item has canLevelUp:true, so they must stay
  // wired here too or clicking them on an npc actor is a silent no-op.
  // Mirrors Adnd2eCharacterSheet's own #onRollHp/#onTakeAverageHp exactly.
  static async #onRollHp(this: Adnd2eNpcSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const item = this.#getItem(target.dataset.classId);
    if (item) await rollHitPoints(item as never, { average: false });
  }

  static async #onTakeAverageHp(this: Adnd2eNpcSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const item = this.#getItem(target.dataset.classId);
    if (item) await rollHitPoints(item as never, { average: true });
  }

  // rollAttack reads the optional per-weapon-row backstab toggle exactly like
  // Adnd2eCharacterSheet's own #onRollAttack — the same combat.hbs weapon-row
  // markup (backstab checkbox included) is reused verbatim in this sheet's
  // folded-together main.hbs, so it must stay wired the same way or the
  // checkbox would silently do nothing.
  static async #onRollAttack(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const weaponItemId = target.dataset.itemId;
    if (!weaponItemId) return;
    const weaponRow = target.closest(".weapon-row");
    const backstabCheckbox = weaponRow?.querySelector<HTMLInputElement>(".backstab-toggle");
    const maneuverSelect = weaponRow?.querySelector<HTMLSelectElement>(".maneuver-select");
    const maneuverId = (maneuverSelect?.value || null) as ManeuverId | null;
    await rollAttack(this.document as never, weaponItemId, backstabCheckbox?.checked ?? false, maneuverId);
  }

  static async #onRollSave(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const category = target.dataset.save;
    if (category) await rollSave(this.document as never, category as never);
  }

  static async #onMemorizeSpell(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await memorizeSpell(this.document as never, id);
  }

  static async #onForgetSpell(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await forgetSpell(this.document as never, id);
  }

  static async #onCastSpell(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await castSpell(this.document as never, id);
  }

  static async #onRestSpellcasting(this: Adnd2eNpcSheet): Promise<void> {
    await restSpellcasting(this.document as never);
  }

  static async #onLearnSpell(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await learnSpell(this.document as never, id);
  }

  static async #onAdvanceWeaponMastery(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await advanceWeaponMastery(this.document as never, id);
  }

  static async #onRollNonweaponCheck(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await rollNonweaponCheck(this.document as never, id);
  }

  static async #onRollThiefSkill(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const skill = target.dataset.skill;
    if (skill) await rollThiefSkill(this.document as never, skill as never);
  }
}

// Pin the class name so DocumentSheetConfig.registerSheet's id (adnd2e.<name>)
// survives minification — same convention as Adnd2eCharacterSheet / Adnd2eCreatureSheet.
Object.defineProperty(Adnd2eNpcSheet, "name", { value: "Adnd2eNpcSheet", configurable: true });
