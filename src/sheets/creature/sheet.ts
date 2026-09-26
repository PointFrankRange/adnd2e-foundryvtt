import { TEMPLATE_PATH } from "../../constants";
import type { SaveCategory } from "../../core/types";
import { monsterDropVerdict } from "../../combat/monster-gear";
import { rollAttack, rollSave, rollWeaponAttack } from "./combat-rolls";
import { rollSpellAutomation, postCastCard } from "../character/spell-actions";
import { editOwnedItem, deleteOwnedItem } from "../item-row-actions";
import { buildCreatureSheetContext } from "./context";
import type { CreatureGearView, CreatureSheetInput, CreatureSpellView } from "./context-types";

/* ---------------------------------------------------------------------------
 * Adnd2eCreatureSheet — SP6 Task 3.
 *
 * The real creature sheet: a single-page stat-block, replacing the SP1
 * raw-field stub as the default for `creature` actors. No `TABS` (spec §2
 * "layout style" decision — matches 2E's own single-block stat-block
 * convention). Foundry-coupled, no unit tests (matches
 * src/sheets/character/sheet.ts's established convention) — verified in a
 * linked dev world. All rendering data is produced by the pure
 * `buildCreatureSheetContext` (Task 1); this class only reads the document,
 * assembles the plain input, and wires the two roll actions (Task 2).
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
  _onRender(context: unknown, options: unknown): Promise<void>;
  _onDropItem(event: DragEvent, item: Item.Implementation): Promise<unknown>;
};

const T = (p: string): string => TEMPLATE_PATH("actor/creature", p);

export class Adnd2eCreatureSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "actor", "creature"],
    // Bumped from the original 640 — the C1 whole-branch-review fix added
    // several new panels (movement, an editable attacks table, a saves
    // authoring panel) and 640 left only the header/vitals visible before
    // scrolling. 760 shows meaningfully more content on a typical screen
    // while still fitting comfortably; the sheet is scrollable regardless
    // (see styles/actor/creature.scss) so this is a convenience, not a fix.
    position: { width: 560, height: 760 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
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
    sheet: { template: T("sheet.hbs"), scrollable: [""] },
  };

  override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    context.adnd2e = buildCreatureSheetContext(this.#buildInput());
    context.editable = this.isEditable;
    context.notEditable = !this.isEditable;
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
    const actor = this.document as unknown as {
      system: { attacks: CreatureSheetInput["attacks"] };
      update(data: Record<string, unknown>): Promise<unknown>;
    };
    const blank = { name: "", count: 1, damage: "", thac0Override: null, type: "melee" as const, special: "" };
    await actor.update({ "system.attacks": [...actor.system.attacks, blank] });
  }

  static async #onDeleteAttack(this: Adnd2eCreatureSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
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
    const actor = this.document as unknown as { items: { get(id: string): unknown } };
    const spell = actor.items.get(itemId);
    if (!spell) return;
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
