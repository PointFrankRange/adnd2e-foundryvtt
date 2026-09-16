import { TEMPLATE_PATH } from "../../constants";
import type { SaveCategory } from "../../core/types";
import { rollAttack, rollSave } from "./combat-rolls";
import { buildCreatureSheetContext } from "./context";
import type { CreatureSheetInput } from "./context-types";

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
};

const T = (p: string): string => TEMPLATE_PATH("actor/creature", p);

export class Adnd2eCreatureSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["adnd2e", "sheet", "actor", "creature"],
    position: { width: 560, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollAttack: Adnd2eCreatureSheet.#onRollAttack,
      rollSave: Adnd2eCreatureSheet.#onRollSave,
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
    };
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
}

// Pin the class name so DocumentSheetConfig.registerSheet's id (adnd2e.<name>)
// survives minification — same convention as Adnd2eCharacterSheet.
Object.defineProperty(Adnd2eCreatureSheet, "name", { value: "Adnd2eCreatureSheet", configurable: true });
