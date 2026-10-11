import { TEMPLATE_PATH } from "../../constants";
import { canAct } from "../../combat/condition-effects";
import {
  TRACKING_ILLUMINATIONS, TRACKING_TERRAINS, buildTrackingCardContext, canTrack, movementLimit, resolveCheck, trackingInputFromForm, trackingScore,
} from "../../core/tracking";
import { themedPrompt } from "../../dialogs/themed-dialog-foundry";

/* SP20 — ranger tracking. Foundry glue only; every decision lives in src/core/tracking. Nothing is written to the actor:
 * a Track is a roll plus a chat card (trail found/lost state is deliberately not stored). */

export interface TrackingActor {
  name: string;
  img: string;
  statuses: ReadonlySet<string> | readonly string[];
  system: {
    abilities: { wis: { score: number } };
    classes?: { chassisId: string; level: number }[];
    tracking: { primaryTerrain: string; specialized: boolean };
  };
}

export interface TrackingView {
  visible: boolean;
  level: number;
  wisdom: number;
  primaryTerrain: string;
  specialized: boolean;
  canAct: boolean;
}

const rangerLevel = (actor: TrackingActor): number => actor.system.classes?.find((c) => c.chassisId === "ranger")?.level ?? 0;

export function trackingView(actor: TrackingActor): TrackingView {
  const level = rangerLevel(actor);
  const { primaryTerrain, specialized } = actor.system.tracking;
  return { visible: level > 0, level, wisdom: actor.system.abilities.wis.score, primaryTerrain, specialized, canAct: canAct(actor.statuses) };
}

const warn = (key: string): void => {
  ui.notifications?.warn(game.i18n!.localize(key));
};

const esc = (s: string): string => foundry.utils.escapeHTML(s);

/** The "trail in my primary terrain" box exists only for a specialized ranger with a primary terrain set. */
const hasPrimary = (view: TrackingView): boolean => view.specialized && view.primaryTerrain !== "";

function dialogContent(view: TrackingView): string {
  const i18n = game.i18n!;
  const L = (key: string): string => esc(i18n.localize(key));
  const options = (ids: readonly string[], prefix: string, selected: string): string =>
    ids.map((id) => `<option value="${id}"${id === selected ? " selected" : ""}>${L(`${prefix}.${id}`)}</option>`).join("");
  const number = (name: string, labelKey: string): string =>
    `<label class="tracking-field"><span>${L(labelKey)}</span><input type="number" name="${name}" min="0" step="1" value="0"></label>`;
  const check = (name: string, labelKey: string, checked = false): string =>
    `<label class="tracking-check"><input type="checkbox" name="${name}"${checked ? " checked" : ""}> <span>${L(labelKey)}</span></label>`;
  return `<div class="tracking-dialog">
    <label class="tracking-field"><span>${L("ADND2E.sheet.tracking.terrain")}</span><select name="terrain">${options(TRACKING_TERRAINS, "ADND2E.trackingTerrains", "normal")}</select></label>
    <label class="tracking-field"><span>${L("ADND2E.sheet.tracking.illumination")}</span><select name="illumination">${options(TRACKING_ILLUMINATIONS, "ADND2E.trackingIlluminations", "good")}</select></label>
    ${number("creaturesTracked", "ADND2E.sheet.tracking.creatures")}
    ${number("assistingTrackers", "ADND2E.sheet.tracking.assistants")}
    ${number("hoursSinceMade", "ADND2E.sheet.tracking.hours")}
    ${number("rainHours", "ADND2E.sheet.tracking.rainHours")}
    ${check("animalFollower", "ADND2E.sheet.tracking.animalFollower")}
    ${hasPrimary(view) ? check("trailInPrimaryTerrain", "ADND2E.sheet.tracking.inPrimaryTerrain") : ""}
    ${check("nonNatural", "ADND2E.sheet.tracking.nonNatural")}
    ${check("quarryHidesTrail", "ADND2E.sheet.tracking.quarryHides")}
    ${check("quarryIsSpecializedHiding", "ADND2E.sheet.tracking.quarrySpecialized")}
    ${check("identify", "ADND2E.sheet.tracking.identify", true)}
    <p class="hint tracking-preview"><output name="preview"></output></p>
  </div>`;
}

/** Reads the dialog form into typed input (pure parsing lives in core). */
function readForm(form: HTMLFormElement, view: TrackingView) {
  const raw = new foundry.applications.ux.FormDataExtended(form).object as Record<string, unknown>;
  return trackingInputFromForm(raw, hasPrimary(view));
}

function previewText(view: TrackingView, form: HTMLFormElement): string {
  const i18n = game.i18n!;
  const result = trackingScore({ wisdom: view.wisdom, level: view.level, ...readForm(form, view) });
  if (!canTrack(result.score)) return i18n.format("ADND2E.sheet.tracking.previewImpossible", { score: String(result.score) });
  const limit = movementLimit(result.score);
  return i18n.format("ADND2E.sheet.tracking.preview", { score: String(result.score), movement: limit ? i18n.localize(`ADND2E.tracking.movement.${limit}`) : "" });
}

/** Opens the dialog, rolls tracking (and identification after a success when asked), and posts one chat card. */
export async function trackQuarry(actor: TrackingActor): Promise<void> {
  const view = trackingView(actor);
  if (!view.visible) return;
  if (!view.canAct) return warn("ADND2E.sheet.tracking.cannotAct");
  const i18n = game.i18n!;
  const values = await themedPrompt({
    window: { title: i18n.localize("ADND2E.sheet.tracking.dialogTitle") },
    content: dialogContent(view),
    // the dialog wait() forwards `render` to a "render" event listener, called as (event, dialog); the live preview only updates the <output>
    render: (_event: Event, dialog: { element: HTMLElement }) => {
      const form = dialog.element.querySelector("form");
      const out = dialog.element.querySelector("output[name='preview']");
      if (!form || !out) return;
      const update = (): void => {
        out.textContent = previewText(view, form);
      };
      form.addEventListener("input", update);
      form.addEventListener("change", update);
      update();
    },
    ok: {
      label: i18n.localize("ADND2E.sheet.tracking.roll"),
      callback: (_event: PointerEvent | SubmitEvent, button: HTMLButtonElement) => (button.form ? readForm(button.form, view) : null),
    },
  } as never);
  if (!values) return;

  const { identify, ...rest } = values as ReturnType<typeof trackingInputFromForm>;
  const result = trackingScore({ wisdom: view.wisdom, level: view.level, ...rest });
  const roll = canTrack(result.score) ? ((await new Roll("1d20").evaluate()).total ?? 1) : null;
  const found = roll !== null && resolveCheck(roll, result.score);
  const identifyRoll = found && identify ? ((await new Roll("1d20").evaluate()).total ?? 1) : null;

  const context = buildTrackingCardContext({
    actorName: actor.name, actorImg: actor.img, level: view.level,
    score: result.score, halved: result.halved, breakdown: result.breakdown, roll, identifyRoll,
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/ranger-tracking.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as never);
}
