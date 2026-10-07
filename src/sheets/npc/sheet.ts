import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import { abilityScoresOf, actorLevelRulesFor } from "../../data/derive/character/kits";
import type { ManeuverId } from "../../core/combat/maneuvers";
import { nonweaponSlotCost } from "../../core/proficiencies/nonweapon";
import type { NonweaponGroup, ThiefSkill } from "../../core/types";
import { getOptionalRules } from "../../settings";
import { tierForConditionId } from "../../core/magic/channeller-fatigue";
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
import { derivedClassState } from "../character/xp";
import { advanceWeaponMastery, rollNonweaponCheck, rollThiefSkill } from "../character/proficiency-actions";
import { castOrBegin, completeCasting, disruptCasting, readCastingStatus } from "../character/casting-actions";
import { deleteOwnedItem, editOwnedItem } from "../item-row-actions";
import { forgetSpell, learnSpell, memorizeSpell, recoverChannellerSp, restSpellcasting } from "../character/spell-actions";
import { recoverFromFatigue } from "../character/fatigue-actions";
import { promptRecoverChannelling } from "../character/recover-dialog";
import { bindSheetKit, clearSheetKit } from "../kit-dom";
import { toggleFavoriteFlag } from "../kit-actions";

/* ---------------------------------------------------------------------------
 * Adnd2eNpcSheet — SP6 Task 4; rebuilt on the parchment kit (sheet redesign
 * R2 Task 2).
 *
 * A streamlined 4-tab sheet for `npc` actors, built on the SAME left column
 * / header / tabs / inventory / spells kit parts the PC sheet
 * (Adnd2eCharacterSheet) uses — `npc` shares the exact same DataModel schema
 * as `character`, so this class reuses the SAME item-mapper functions (now
 * exported from character/sheet.ts), the SAME pure `buildCharacterSheetContext`
 * (character/context.ts, unchanged), and the SAME action-function glue
 * (combat-rolls / spell-actions / proficiency-actions) the PC sheet already
 * uses — zero new pure logic. Only the template set (4 tabs instead of 6) and
 * a couple of PC-only affordances differ.
 *
 * The `pcActions` root-context flag (set `true` by Adnd2eCharacterSheet to
 * gate awardXp / toggleDualClass / seedSubAbilities / the thief allocate-
 * deallocate buttons / the traits panel) is deliberately left UNSET here —
 * this sheet never registers those PC-only actions, so the shared kit
 * partials render as if `pcActions` were absent, exactly as before this task
 * (no traits panel, no XP/dual-class controls). The edit-lock and favorites
 * wiring (`#unlocked`, `#sheetKitKey`, `bindSheetKit`/`clearSheetKit`,
 * `proseDisabled`, `unlocked`/`favorites` in `#buildInput`) mirrors the PC
 * sheet exactly, since those affordances are not PC-only.
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
  // Not awaited by the close process (see Adnd2eCharacterSheet's own Base for
  // the client/applications/api/application.mjs citation).
  _onClose(options: unknown): void;
  render(options?: unknown): Promise<unknown>;
};

/** Minimal shape needed to mutate an owned Item's `system.*` field from the
 *  `[data-item-id][data-field]` inputs the reused `pc-item-table.hbs` partial
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
    classes: ["adnd2e", "sheet", "actor", "pc-sheet", "npc-sheet"],
    position: { width: 1045, height: 960 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      toggleLock: Adnd2eNpcSheet.#onToggleLock,
      toggleFavorite: Adnd2eNpcSheet.#onToggleFavorite,
      rollHp: Adnd2eNpcSheet.#onRollHp,
      takeAverageHp: Adnd2eNpcSheet.#onTakeAverageHp,
      rollAttack: Adnd2eNpcSheet.#onRollAttack,
      rollSave: Adnd2eNpcSheet.#onRollSave,
      memorizeSpell: Adnd2eNpcSheet.#onMemorizeSpell,
      forgetSpell: Adnd2eNpcSheet.#onForgetSpell,
      castSpell: Adnd2eNpcSheet.#onCastSpell,
      restSpellcasting: Adnd2eNpcSheet.#onRestSpellcasting,
      recoverChannellerSp: Adnd2eNpcSheet.#onRecoverChannellerSp,
      recoverFromFatigue: Adnd2eNpcSheet.#onRecoverFromFatigue,
      learnSpell: Adnd2eNpcSheet.#onLearnSpell,
      completeCasting: Adnd2eNpcSheet.#onCompleteCasting,
      disruptCasting: Adnd2eNpcSheet.#onDisruptCasting,
      cancelCasting: Adnd2eNpcSheet.#onCancelCasting,
      editItem: Adnd2eNpcSheet.#onEditItem,
      deleteItem: Adnd2eNpcSheet.#onDeleteItem,
      advanceWeaponMastery: Adnd2eNpcSheet.#onAdvanceWeaponMastery,
      rollNonweaponCheck: Adnd2eNpcSheet.#onRollNonweaponCheck,
      rollThiefSkill: Adnd2eNpcSheet.#onRollThiefSkill,
    },
  };

  // Reuses the PC sheet's left/header/tabs/inventory/spells kit parts
  // verbatim by path (byte-identical, no npc-specific markup needed) — same
  // "reuse, don't duplicate" pattern the pre-redesign header PART already
  // followed. Only main.hbs and journal.hbs are npc-specific (they fold in
  // the npc morale/xpValue/disposition fields the PC sheet doesn't have).
  static PARTS = {
    left: { template: TEMPLATE_PATH("actor/pc", "left.hbs") },
    header: { template: TEMPLATE_PATH("actor/pc", "header.hbs") },
    tabs: { template: TEMPLATE_PATH("actor/pc", "tabs.hbs") },
    main: { template: TEMPLATE_PATH("actor/npc", "main.hbs"), scrollable: [""] },
    inventory: { template: TEMPLATE_PATH("actor/pc", "inventory.hbs"), scrollable: [""] },
    spells: { template: TEMPLATE_PATH("actor/pc", "spells.hbs"), scrollable: [""] },
    journal: { template: TEMPLATE_PATH("actor/npc", "journal.hbs"), scrollable: [""] },
  };

  static TABS = {
    primary: {
      initial: "main",
      labelPrefix: "ADND2E.sheet.tabs",
      tabs: [
        { id: "main", icon: "fa-solid fa-user" },
        { id: "inventory", icon: "fa-solid fa-box-open" },
        { id: "spells", icon: "fa-solid fa-wand-sparkles" },
        { id: "journal", icon: "fa-solid fa-book" },
      ],
    },
  };

  /** sheet redesign R2: the viewer's unlock state — never persisted, opens locked
   *  (mirrors Adnd2eCharacterSheet's own `#unlocked`). */
  #unlocked = false;

  override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    context.adnd2e = buildCharacterSheetContext(this.#buildInput());
    context.editable = this.isEditable;
    context.notEditable = !this.isEditable;
    context.proseDisabled = !this.isEditable || !this.#unlocked;
    // Deliberately NOT set here: `context.pcActions`. Its absence keeps every
    // PC-only action (awardXp, toggleDualClass, seedSubAbilities, the thief
    // allocate/deallocate buttons, the traits panel) hidden on this sheet —
    // see this class's header comment.
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
          {
            const view = toClassView(it);
            const lr = actorLevelRulesFor(items, view.chassisId, getOptionalRules(), abilityScoresOf(actor.system));
            Object.assign(view, derivedClassState((actor.system as { classes?: { chassisId: string; level: number; canLevelUp: boolean }[] }).classes, view.chassisId, view));
            classItems.push({ ...view, xpModifierPercent: lr.xpPercent, levelLimit: lr.rules.limit, beyondMultiplier: lr.rules.beyondMultiplier });
          }
          break;
        case "race":
          raceItem ??= toRaceView(it);
          break;
        case "weapon":
        case "armor":
        case "equipment":
        case "ammo":
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

    // Sub-project 14 Plan C whole-branch review finding I1: a Character NPC
    // channeller had no way to ever SEE or RECOVER from fatigue — the fatigue
    // panel renders unconditionally once gated by this field being present
    // (pc-main-panels.hbs), but `fatigueTier` was never threaded into this
    // sheet's render-context input. Mirrors Adnd2eCharacterSheet's own
    // #buildInput exactly (character/sheet.ts).
    const npcActorStatuses = (this.document as unknown as { statuses: ReadonlySet<string> }).statuses;
    const fatigueTier = [...npcActorStatuses].map(tierForConditionId).find((t) => t !== null) ?? null;
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
      castingStatus: readCastingStatus(this.document as never),
      fatigueTier,
      unlocked: this.#unlocked,
      favorites: (this.document as unknown as { getFlag(scope: string, key: string): unknown }).getFlag(
        SYSTEM_ID,
        "favorites",
      ),
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
      system: { slotCost?: number; group?: NonweaponGroup; alsoGroups?: NonweaponGroup[] };
    };
    // SP8 Plan 8c: traits are PC-sheet-only (spec §7). The shared derive would
    // apply a dropped trait's effects invisibly on this streamlined sheet, so refuse it.
    if (dropped.type === "trait") {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.drop.traitsPcOnly"));
      return null;
    }
    if (dropped.type === "kit") {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.drop.kitsPcOnly"));
      return null;
    }
    // SP15: this sheet has no Psionics tab, so a power would be learned invisibly
    if (dropped.type === "power") {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.psionics.pcOnly"));
      return null;
    }

    let dropSlotCost: number | undefined;
    if (dropped.type === "weaponProficiency") {
      dropSlotCost = 1;
    } else if (dropped.type === "nonweaponProficiency") {
      const firstClassId = [...actor.items].find((i) => i.type === "class")?.system.chassisId ?? null;
      dropSlotCost = firstClassId
        ? nonweaponSlotCost(dropped.system.slotCost ?? 1, dropped.system.group ?? "general", firstClassId as never, dropped.system.alsoGroups ?? [])
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

  /** the same key `bindSheetKit`/`clearSheetKit` use to namespace this sheet's
   *  client-side DOM state (collapsed sections, the inventory filter) — one
   *  getter so `_onRender` and `_onClose` can't drift out of sync with each
   *  other. Mirrors Adnd2eCharacterSheet's own `#sheetKitKey` exactly (a
   *  distinct `npc-` prefix keeps it from colliding with a `character`
   *  actor's own sheet-kit state if the two ever shared an id namespace). */
  get #sheetKitKey(): string {
    return `npc-${(this.document as unknown as { id: string }).id}`;
  }

  // Wires the `[data-item-id][data-field]` inputs the reused `pc-item-table.hbs`
  // partial renders (inventory quantity/location/equipped/identified) — same
  // pattern as Adnd2eCharacterSheet's own `_onRender`/`#onItemFieldChange`,
  // needed because the reused `pc/inventory.hbs` PART folds in the PC
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
    bindSheetKit(this.element, this.#sheetKitKey);
  }

  // v14 caches the sheet instance across close/reopen (see Adnd2eCharacterSheet's
  // own `_onClose` for the client-document.mjs citation) — every sheet must open
  // locked (spec), so reset it on close.
  override _onClose(options: unknown): void {
    super._onClose(options);
    this.#unlocked = false;
    clearSheetKit(this.#sheetKitKey);
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

  // Interaction handlers — sheet redesign R2 (edit lock + favorites). Mirror
  // Adnd2eCharacterSheet's own #onToggleLock/#onToggleFavorite exactly.
  static async #onToggleLock(this: Adnd2eNpcSheet): Promise<void> {
    if (!this.isEditable) return;
    this.#unlocked = !this.#unlocked;
    await this.render();
  }

  static async #onToggleFavorite(this: Adnd2eNpcSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    await toggleFavoriteFlag(this.document, target);
  }

  // Wires pc-class-row.hbs's rollHp/takeAverageHp buttons — that partial is
  // reused verbatim from the PC sheet (class rows render in the pc header,
  // see header.hbs) and renders these buttons whenever a class item has
  // canLevelUp:true, so they must stay wired here too or clicking them on
  // an npc actor is a silent no-op. Mirrors Adnd2eCharacterSheet's own
  // #onRollHp/#onTakeAverageHp exactly.
  static async #onRollHp(this: Adnd2eNpcSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const item = this.#getItem(target.dataset.classId);
    if (item) await rollHitPoints(item as never, { average: false });
  }

  static async #onTakeAverageHp(this: Adnd2eNpcSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const item = this.#getItem(target.dataset.classId);
    if (item) await rollHitPoints(item as never, { average: true });
  }

  // rollAttack reads the optional per-weapon-row backstab toggle exactly like
  // Adnd2eCharacterSheet's own #onRollAttack — the same pc-main-panels.hbs
  // weapon-row markup (backstab checkbox included) is reused verbatim in this
  // sheet's folded-together main.hbs, so it must stay wired the same way or
  // the checkbox would silently do nothing.
  static async #onRollAttack(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const weaponItemId = target.dataset.itemId;
    if (!weaponItemId) return;
    const weaponRow = target.closest(".weapon-row");
    const backstabCheckbox = weaponRow?.querySelector<HTMLInputElement>(".backstab-toggle");
    const maneuverSelect = weaponRow?.querySelector<HTMLSelectElement>(".maneuver-select");
    const maneuverId = (maneuverSelect?.value || null) as ManeuverId | null;
    const ammoSelect = weaponRow?.querySelector<HTMLSelectElement>(".ammo-select");
    const ammoItemId = ammoSelect?.value || null;
    await rollAttack(this.document as never, weaponItemId, backstabCheckbox?.checked ?? false, maneuverId, ammoItemId);
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
    if (id) await castOrBegin(this.document as never, id);
  }

  static async #onRestSpellcasting(this: Adnd2eNpcSheet): Promise<void> {
    await restSpellcasting(this.document as never);
  }

  // Sub-project 14 Plan B whole-branch fix I2: a Character NPC channeller had
  // no way to ever gain spell points — the SP bar renders unconditionally
  // (spells.hbs), but the Recover button was gated behind pcActions with no
  // matching action-map entry here. Reuses the exact same recoverChannellerSp/
  // promptRecoverChannelling functions the PC sheet uses.
  static async #onRecoverChannellerSp(this: Adnd2eNpcSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const caster = target.dataset.caster === "priest" ? "priest" : "wizard";
    const result = await promptRecoverChannelling();
    if (result) await recoverChannellerSp(this.document as never, caster, result.activity, result.hours);
  }

  // Sub-project 14 Plan C whole-branch review finding I1: a Character NPC
  // channeller could become fatigued (castOrBegin fatigues both sheet types
  // identically) but had no way to ever recover — the fatigue panel's Recover
  // button was gated behind pcActions with no matching action-map entry here.
  // Reuses the exact same recoverFromFatigue function the PC sheet uses.
  static async #onRecoverFromFatigue(this: Adnd2eNpcSheet): Promise<void> {
    await recoverFromFatigue(this.document as never);
  }

  static async #onLearnSpell(this: Adnd2eNpcSheet, _e: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.itemId;
    if (id) await learnSpell(this.document as never, id);
  }

  static async #onCompleteCasting(this: Adnd2eNpcSheet): Promise<void> {
    if (this.isEditable) await completeCasting(this.document as never);
  }

  static async #onDisruptCasting(this: Adnd2eNpcSheet): Promise<void> {
    if (game.user?.isGM) await disruptCasting(this.document as never, { announce: true });
  }

  static #onEditItem(this: Adnd2eNpcSheet, _event: PointerEvent, target: HTMLElement): void {
    const itemId = target.dataset.itemId;
    if (itemId) editOwnedItem(this.document as never, itemId);
  }

  static async #onDeleteItem(this: Adnd2eNpcSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const itemId = target.dataset.itemId;
    if (itemId && this.isEditable) await deleteOwnedItem(this.document as never, itemId);
  }

  static async #onCancelCasting(this: Adnd2eNpcSheet): Promise<void> {
    if (game.user?.isGM) await disruptCasting(this.document as never, { announce: false });
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
