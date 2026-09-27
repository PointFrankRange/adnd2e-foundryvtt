import { TEMPLATE_PATH } from "../../constants";
import type { SaveCategory } from "../../core/types";
import { monsterDropVerdict } from "../../combat/monster-gear";
import { rollAttack, rollSave, rollWeaponAttack } from "./combat-rolls";
import { rollSpellAutomation, postCastCard } from "../character/spell-actions";
import { editOwnedItem, deleteOwnedItem } from "../item-row-actions";
import { buildCreatureSheetContext } from "./context";
import type { CreatureGearView, CreatureSheetInput, CreatureSpellView } from "./context-types";
import { bindSheetKit, clearSheetKit } from "../kit-dom";

/* ---------------------------------------------------------------------------
 * Adnd2eCreatureSheet — SP6 Task 3; rebuilt on the parchment kit (sheet
 * redesign R3 Task 2).
 *
 * The Monster NPC sheet, now built on the SAME left column / header / tabs
 * kit parts as the PC and Character NPC sheets, but with its own creature-
 * specific tab set (statblock/gear/spells/notes — 4 tabs) since CreatureModel's
 * schema shares nothing with CharacterModel's. Carries the same edit lock
 * (`#unlocked`/`#sheetKitKey`/`bindSheetKit`/`clearSheetKit`/`proseDisabled`)
 * as the PC/NPC sheets — every sheet in this redesign opens locked and reveals
 * its authoring inputs (movement modes, the editable attacks table, the saves
 * authoring panel) only once unlocked. No favorites (spec — Monster NPC has
 * no favorites bar). Foundry-coupled, no unit tests (matches
 * src/sheets/character/sheet.ts's established convention) — verified in a
 * linked dev world. All rendering data is produced by the pure
 * `buildCreatureSheetContext` (Task 1); this class only reads the document,
 * assembles the plain input, and wires the action handlers.
 * ------------------------------------------------------------------------- */

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

// Same TS2510-dodging collapse as Adnd2eCharacterSheet: ActorSheetV2 extends
// DocumentSheetV2 directly (no HandlebarsApplicationMixin baked in under
// v14.364), so the mixin is applied here and the intersection is collapsed to
// a single constructor describing only the members this class touches.
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

export class Adnd2eCreatureSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "actor", "pc-sheet", "creature-sheet"],
    // Matches the PC/Character NPC kit sheets' own size (sheet redesign R3).
    position: { width: 1045, height: 960 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      toggleLock: Adnd2eCreatureSheet.#onToggleLock,
      rollAttack: Adnd2eCreatureSheet.#onRollAttack,
      rollSave: Adnd2eCreatureSheet.#onRollSave,
      addAttack: Adnd2eCreatureSheet.#onAddAttack,
      deleteAttack: Adnd2eCreatureSheet.#onDeleteAttack,
      rollWeaponAttack: Adnd2eCreatureSheet.#onRollWeaponAttack,
      castMonsterSpell: Adnd2eCreatureSheet.#onCastMonsterSpell,
      toggleEquipped: Adnd2eCreatureSheet.#onToggleEquipped,
      editItem: Adnd2eCreatureSheet.#onEditItem,
      deleteItem: Adnd2eCreatureSheet.#onDeleteItem,
    },
  };

  static PARTS = {
    left: { template: TEMPLATE_PATH("actor/creature", "left.hbs") },
    header: { template: TEMPLATE_PATH("actor/creature", "header.hbs") },
    tabs: { template: TEMPLATE_PATH("actor/pc", "tabs.hbs") },
    statblock: { template: TEMPLATE_PATH("actor/creature", "statblock.hbs"), scrollable: [""] },
    gear: { template: TEMPLATE_PATH("actor/creature", "gear.hbs"), scrollable: [""] },
    spells: { template: TEMPLATE_PATH("actor/creature", "spells.hbs"), scrollable: [""] },
    notes: { template: TEMPLATE_PATH("actor/creature", "notes.hbs"), scrollable: [""] },
  };

  static TABS = {
    primary: {
      initial: "statblock",
      labelPrefix: "ADND2E.sheet.tabs",
      tabs: [
        { id: "statblock", label: "ADND2E.sheet.tabs.statBlock", icon: "fa-solid fa-dragon" },
        { id: "gear", icon: "fa-solid fa-box-open" },
        { id: "spells", icon: "fa-solid fa-wand-sparkles" },
        { id: "notes", icon: "fa-solid fa-book" },
      ],
    },
  };

  /** sheet redesign R3: the viewer's unlock state — never persisted, opens locked
   *  (mirrors Adnd2eCharacterSheet's/Adnd2eNpcSheet's own `#unlocked`). */
  #unlocked = false;

  override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    context.adnd2e = buildCreatureSheetContext(this.#buildInput());
    context.editable = this.isEditable;
    context.notEditable = !this.isEditable;
    context.proseDisabled = !this.isEditable || !this.#unlocked;
    // matches src/sheets/character/sheet.ts's own _prepareContext exactly —
    // `context.source` (the actor's `_source`) is already provided by
    // super._prepareContext(options) (DocumentSheetV2's own base behavior);
    // do not set it again here.
    context.systemFields = (this.document as unknown as {
      system: { schema: { fields: Record<string, unknown> } };
    }).system.schema.fields;
    // Exposed the same way Adnd2eNpcSheet exposes `alignments` — these are
    // read-only CONFIG.ADND2E label maps consumed by {{selectOptions}} in the
    // template; they need not flow through the pure buildCreatureSheetContext
    // builder (whole-branch-review C1 fix).
    const cfg = (CONFIG as unknown as { ADND2E: Record<string, Record<string, string>> }).ADND2E;
    context.sizes = cfg.sizes;
    context.alignments = cfg.alignments;
    context.classGroups = cfg.classGroups;
    context.attackTypes = cfg.attackTypes;
    context.saveModes = cfg.saveModes;
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

  /** the same key `bindSheetKit`/`clearSheetKit` use to namespace this sheet's
   *  client-side DOM state (collapsed gear sections, the gear filter) — one
   *  getter so `_onRender` and `_onClose` can't drift out of sync with each
   *  other. Mirrors Adnd2eNpcSheet's own `#sheetKitKey` exactly (a distinct
   *  `creature-` prefix keeps it from colliding with another actor type's own
   *  sheet-kit state if the two ever shared an id namespace). */
  get #sheetKitKey(): string {
    return `creature-${(this.document as unknown as { id: string }).id}`;
  }

  override async _onRender(context: unknown, options: unknown): Promise<void> {
    await super._onRender(context, options);
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

  static async #onToggleLock(this: Adnd2eCreatureSheet): Promise<void> {
    if (!this.isEditable) return;
    this.#unlocked = !this.#unlocked;
    await this.render();
  }

  #buildInput(): CreatureSheetInput {
    const actor = this.document as unknown as {
      name: string;
      img: string;
      isOwner: boolean;
      system: {
        hd: CreatureSheetInput["hd"];
        attributes: CreatureSheetInput["attributes"];
        attacks: CreatureSheetInput["attacks"];
        saves: CreatureSheetInput["saves"];
        details: CreatureSheetInput["details"];
      };
      items: Iterable<{ id: string; name: string; img: string; type: string; system: Record<string, unknown> }>;
    };
    const items = [...actor.items];
    const gear: CreatureGearView[] = items
      .filter((i) => i.type === "weapon" || i.type === "armor" || i.type === "equipment")
      .map((i) => ({
        id: i.id, name: i.name, img: i.img,
        type: i.type as "weapon" | "armor" | "equipment",
        quantity: Number(i.system.quantity ?? 1),
        equipped: Boolean(i.system.equipped),
        weapon: i.type === "weapon"
          ? {
              category: String(i.system.category ?? "melee"),
              magicBonus: Number(i.system.magicBonus ?? 0),
              damageVsSM: (i.system.damageVsSM as string | null) ?? null,
              damageVsL: (i.system.damageVsL as string | null) ?? null,
            }
          : undefined,
      }));
    const spells: CreatureSpellView[] = items
      .filter((i) => i.type === "spell")
      .map((i) => ({ id: i.id, name: i.name, img: i.img, level: Number(i.system.level ?? 1) }));
    return {
      name: actor.name,
      img: actor.img,
      hd: actor.system.hd,
      attributes: actor.system.attributes,
      attacks: actor.system.attacks,
      saves: actor.system.saves,
      details: actor.system.details,
      perms: {
        isGM: (game as unknown as { user: { isGM: boolean } }).user.isGM,
        isOwner: actor.isOwner,
        editable: this.isEditable,
      },
      unlocked: this.#unlocked,
      gear,
      spells,
    };
  }

  static async #onRollAttack(this: Adnd2eCreatureSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const index = target.dataset.attackIndex;
    if (index !== undefined) await rollAttack(this.document as never, Number(index));
  }

  static async #onRollSave(this: Adnd2eCreatureSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const category = target.dataset.save as SaveCategory | undefined;
    if (category) await rollSave(this.document as never, category);
  }

  // No existing precedent in this codebase for an editable ArrayField list —
  // add/delete are plain actor.update() calls on the whole `system.attacks`
  // array, matching every other action on this sheet's "read the document,
  // call update()" style (whole-branch-review C1 fix).
  static async #onAddAttack(this: Adnd2eCreatureSheet): Promise<void> {
    if (!this.isEditable) return;
    const actor = this.document as unknown as {
      system: { attacks: CreatureSheetInput["attacks"] };
      update(data: Record<string, unknown>): Promise<unknown>;
    };
    const blank = { name: "", count: 1, damage: "", thac0Override: null, type: "melee" as const, special: "" };
    await actor.update({ "system.attacks": [...actor.system.attacks, blank] });
  }

  static async #onDeleteAttack(this: Adnd2eCreatureSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    if (!this.isEditable) return;
    const index = target.dataset.attackIndex;
    if (index === undefined) return;
    const actor = this.document as unknown as {
      system: { attacks: CreatureSheetInput["attacks"] };
      update(data: Record<string, unknown>): Promise<unknown>;
    };
    const spliced = actor.system.attacks.filter((_, i) => i !== Number(index));
    await actor.update({ "system.attacks": spliced });
  }

  // Monster NPC inventory plan Task 3: which items a Monster NPC accepts —
  // weapons, armor, equipment and spells only, per `monsterDropVerdict`
  // (Task 1, pure). Every other item type (a class, race, proficiency, trait
  // or class feature — all PC/Character-NPC-only concepts on this actor
  // type) is rejected with a toast, matching Adnd2eCharacterSheet/
  // Adnd2eNpcSheet's own drop-guard convention.
  override async _onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown> {
    const verdict = monsterDropVerdict((item as unknown as { type: string }).type);
    if (!verdict.ok) {
      ui.notifications?.warn(game.i18n!.localize(verdict.reason));
      return null;
    }
    return super._onDropItem(event, item);
  }

  static async #onRollWeaponAttack(this: Adnd2eCreatureSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const itemId = target.dataset.itemId;
    if (itemId) await rollWeaponAttack(this.document as never, itemId);
  }

  static async #onCastMonsterSpell(this: Adnd2eCreatureSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const itemId = target.dataset.itemId;
    if (!itemId) return;
    const actor = this.document as unknown as { items: { get(id: string): { type: string } | undefined } };
    const spell = actor.items.get(itemId);
    // Defensive re-check (a stale button click, a since-deleted/changed item)
    // — mirrors the PC sheet's own castSpell/memorizeSpell "toast instead of
    // silence" convention (src/sheets/character/spell-actions.ts) rather
    // than letting rollSpellAutomation see a non-spell item's shape.
    if (!spell || spell.type !== "spell") {
      ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.spells.castBlockedWarning"));
      return;
    }
    const rolled = await rollSpellAutomation(spell as never);
    if (rolled) await postCastCard(this.document as never, spell as never, rolled);
  }

  static async #onToggleEquipped(this: Adnd2eCreatureSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    if (!this.isEditable) return;
    const itemId = target.dataset.itemId;
    if (!itemId) return;
    const actor = this.document as unknown as {
      items: { get(id: string): { system: { equipped?: boolean }; update(data: Record<string, unknown>): Promise<unknown> } | undefined };
    };
    const item = actor.items.get(itemId);
    if (!item) return;
    await item.update({ "system.equipped": !item.system.equipped });
  }

  static #onEditItem(this: Adnd2eCreatureSheet, _event: PointerEvent, target: HTMLElement): void {
    const itemId = target.dataset.itemId;
    if (itemId) editOwnedItem(this.document as never, itemId);
  }

  static async #onDeleteItem(this: Adnd2eCreatureSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    if (!this.isEditable) return;
    const itemId = target.dataset.itemId;
    if (itemId) await deleteOwnedItem(this.document as never, itemId);
  }
}

// Pin the class name so DocumentSheetConfig.registerSheet's id (adnd2e.<name>)
// survives minification — same convention as Adnd2eCharacterSheet.
Object.defineProperty(Adnd2eCreatureSheet, "name", { value: "Adnd2eCreatureSheet", configurable: true });
