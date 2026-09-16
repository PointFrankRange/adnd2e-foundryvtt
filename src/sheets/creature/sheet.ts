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
}

// Pin the class name so DocumentSheetConfig.registerSheet's id (adnd2e.<name>)
// survives minification — same convention as Adnd2eCharacterSheet.
Object.defineProperty(Adnd2eCreatureSheet, "name", { value: "Adnd2eCreatureSheet", configurable: true });
