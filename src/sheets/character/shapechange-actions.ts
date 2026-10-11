import { TEMPLATE_PATH } from "../../constants";
import { canAct } from "../../combat/condition-effects";
import {
  buildShapechangeCardContext,
  canShift,
  newDayUpdate,
  planShift,
  resolveShapechangeSpec,
  returnUpdate,
  shapechangeAvailable,
  snapshotForm,
  usesLeft,
  type FormSnapshot,
  type FormSource,
  type ShapechangeSpec,
  type ShiftBlock,
} from "../../core/shapechange";
import { activeKitEntries } from "../../data/derive/character/kits";
import { themedPrompt } from "../../dialogs/themed-dialog-foundry";

/* SP16 — druid shapechanging. Foundry glue only; every decision lives in src/core/shapechange. Every write targets
 * the acting actor's own `system`, so a non-GM owner can shift. */

export interface ShapechangeActor {
  name: string;
  img: string;
  statuses: ReadonlySet<string> | readonly string[];
  items: Iterable<{ id: string; name: string; type: string; system: unknown }>;
  system: {
    classes?: { chassisId: string; level: number }[];
    attributes: { hp: { value: number; max: number } };
    shapechange: { usedToday: number; categoriesUsed: string[]; form: FormSnapshot | null };
  };
  update(data: Record<string, unknown>): Promise<unknown>;
}

export interface ShapechangeView {
  visible: boolean;
  level: number;
  usesLeft: number;
  usesMax: number;
  categoriesUsed: string[];
  form: FormSnapshot | null;
  canAct: boolean;
}

export interface EligibleForm {
  id: string;
  name: string;
  img: string;
  category: string;
  blocked: ShiftBlock | null;
}

/** The world Monster NPC a form is copied from (structural: only what the glue reads). */
interface FormActorDoc extends FormSource {
  id: string;
  type: string;
  testUserPermission(user: unknown, level: string): boolean;
  system: FormSource["system"] & { details: { shapechange: { category: string; habitats: string[]; giant: boolean } } };
}

const druidLevel = (actor: ShapechangeActor): number =>
  actor.system.classes?.find((c) => c.chassisId === "druid")?.level ?? 0;

function specOf(actor: ShapechangeActor): ShapechangeSpec {
  const kit = activeKitEntries(actor.items).find((k) => k.chassisId === "druid" && k.powers.some((p) => p.id === "shapechange"));
  return resolveShapechangeSpec(kit?.powers.find((p) => p.id === "shapechange"));
}

export function shapechangeView(actor: ShapechangeActor): ShapechangeView {
  const spec = specOf(actor);
  const level = druidLevel(actor);
  const sc = actor.system.shapechange;
  return {
    visible: level > 0 && shapechangeAvailable(level, spec),
    level,
    usesLeft: usesLeft(sc, spec),
    usesMax: spec.uses,
    categoriesUsed: [...sc.categoriesUsed],
    form: sc.form,
    canAct: canAct(actor.statuses),
  };
}

const worldForms = (): FormActorDoc[] =>
  [...(game.actors as unknown as Iterable<FormActorDoc>)].filter(
    (a) => a.type === "creature" && a.system.details.shapechange.category !== "" && a.testUserPermission(game.user, "OBSERVER"),
  );

const tagsOf = (a: FormActorDoc) => ({
  category: a.system.details.shapechange.category as never,
  habitats: a.system.details.shapechange.habitats,
  giant: a.system.details.shapechange.giant,
});

export function eligibleForms(actor: ShapechangeActor): EligibleForm[] {
  const spec = specOf(actor);
  return worldForms().map((a) => {
    const verdict = canShift(actor.system.shapechange, spec, tagsOf(a));
    return { id: a.id, name: a.name, img: a.img, category: a.system.details.shapechange.category, blocked: verdict.ok ? null : verdict.reason };
  });
}

const warn = (key: string): void => {
  ui.notifications?.warn(game.i18n!.localize(key));
};

async function postCard(actor: ShapechangeActor, context: ReturnType<typeof buildShapechangeCardContext>): Promise<void> {
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/shapechange-use.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actor as never }), content } as never);
}

/** Re-validates everything at click time, rolls 1d6, then writes counters + form + healed hp in ONE update. */
export async function shiftToForm(actor: ShapechangeActor, formActorId: string): Promise<void> {
  const spec = specOf(actor);
  if (!shapechangeAvailable(druidLevel(actor), spec) || !canAct(actor.statuses)) return warn("ADND2E.sheet.shapechange.cannotAct");
  const source = worldForms().find((a) => a.id === formActorId);
  const snapshot = source ? snapshotForm(source) : null;
  if (!source || !snapshot) return warn("ADND2E.sheet.shapechange.blocked.notEligible");
  const verdict = canShift(actor.system.shapechange, spec, tagsOf(source));
  if (!verdict.ok) return warn(`ADND2E.sheet.shapechange.blocked.${verdict.reason}`);

  const roll = await new Roll("1d6").evaluate();
  const d6 = roll.total ?? 1;
  const leftBefore = usesLeft(actor.system.shapechange, spec);
  const plan = planShift(actor.system.shapechange, snapshot, actor.system.attributes.hp, d6);
  await actor.update(plan.update);
  ui.notifications?.info(game.i18n!.format("ADND2E.sheet.shapechange.shifted", { name: snapshot.name }));
  await postCard(
    actor,
    buildShapechangeCardContext({
      actorName: actor.name, actorImg: actor.img, formName: snapshot.name, d6, healed: plan.healed,
      usesLeft: leftBefore - 1, usesMax: spec.uses, returning: false,
    }),
  );
}

/** Back to normal form: the form becomes null; no use is spent. */
export async function returnToNormal(actor: ShapechangeActor): Promise<void> {
  const form = actor.system.shapechange.form;
  if (!form) return;
  await actor.update(returnUpdate());
  await postCard(
    actor,
    buildShapechangeCardContext({
      actorName: actor.name, actorImg: actor.img, formName: form.name, d6: 0, healed: 0, usesLeft: 0, usesMax: 0, returning: true,
    }),
  );
}

/** Manual new day: zeroes the counters and leaves the current form. */
export async function resetShapechangeDay(actor: ShapechangeActor): Promise<void> {
  await actor.update(newDayUpdate());
}

const escape = (s: string) => foundry.utils.escapeHTML(s);

/** The form picker; blocked forms show disabled with the reason. */
export async function promptShift(actor: ShapechangeActor): Promise<void> {
  if (!canAct(actor.statuses)) return warn("ADND2E.sheet.shapechange.cannotAct");
  const forms = eligibleForms(actor);
  if (forms.length === 0) return warn("ADND2E.sheet.shapechange.noForms");
  const i18n = game.i18n!;
  const options = forms
    .map((f) => {
      const reason = f.blocked ? ` (${i18n.localize(`ADND2E.sheet.shapechange.blocked.${f.blocked}`)})` : "";
      return `<option value="${escape(f.id)}"${f.blocked ? " disabled" : ""}>${escape(f.name)} [${escape(f.category)}]${escape(reason)}</option>`;
    })
    .join("");
  const id = await themedPrompt({
    window: { title: i18n.localize("ADND2E.sheet.shapechange.shiftTitle") },
    content: `<p>${i18n.localize("ADND2E.sheet.shapechange.pick")}</p><select name="form" autofocus>${options}</select>`,
    ok: {
      label: i18n.localize("ADND2E.sheet.shapechange.shift"),
      callback: (_event: PointerEvent | SubmitEvent, button: HTMLButtonElement) => {
        const select = button.form?.elements.namedItem("form");
        return select instanceof HTMLSelectElement ? select.value : null;
      },
    },
  });
  if (typeof id === "string" && id) await shiftToForm(actor, id);
}
