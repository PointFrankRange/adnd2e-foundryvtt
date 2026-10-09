// Effects-tab glue shared by the PC, Character NPC and Monster NPC sheets (#128). Foundry-coupled — verified in the dev
// world. Mapping from real ActiveEffect documents to the pure view model, plus the six tab actions. Every mutating
// action acts only on the actor's OWN effects collection (never an item's transferred effect), and the sheet handlers
// gate on isEditable before calling in.
import { buildEffectsView, type EffectRecord, type EffectsView } from "./effects/view";

interface EffectDoc {
  id: string;
  name: string;
  img: string;
  disabled: boolean;
  isSuppressed: boolean;
  isTemporary: boolean;
  duration: { label?: string };
  system: { isCondition?: boolean; conditionId?: string | null };
  parent: { documentName: string; id: string; name: string } | null;
  sheet: { render(options?: { force?: boolean }): unknown } | null;
  update(data: Record<string, unknown>): Promise<unknown>;
  delete(): Promise<unknown>;
}

interface EffectOwner {
  effects: { get(id: string): EffectDoc | undefined };
  items: { get(id: string): { sheet: { render(options?: { force?: boolean }): unknown } | null } | undefined };
  allApplicableEffects(): Iterable<EffectDoc>;
  createEmbeddedDocuments(type: "ActiveEffect", data: Record<string, unknown>[]): Promise<EffectDoc[]>;
  toggleStatusEffect(id: string, options: { active: boolean }): Promise<unknown>;
}

function recordOf(effect: EffectDoc): EffectRecord {
  const onItem = effect.parent?.documentName === "Item";
  return {
    id: effect.id,
    name: effect.name,
    img: effect.img,
    disabled: effect.disabled,
    suppressed: effect.isSuppressed,
    isCondition: !!effect.system.isCondition,
    conditionId: effect.system.conditionId ?? null,
    // core reports the word "None" for an indefinite duration — only label genuinely timed effects
    durationLabel: effect.isTemporary ? (effect.duration.label ?? "") : "",
    source: onItem ? { id: effect.parent!.id, name: effect.parent!.name } : null,
  };
}

/** The Effects tab's view model. Uses allApplicableEffects() so effects transferred from owned items appear too. */
export function effectsContext(actor: unknown, editable: boolean): EffectsView {
  const owner = actor as EffectOwner;
  return buildEffectsView([...owner.allApplicableEffects()].map(recordOf), editable);
}

/** "New effect": a blank adnd2e effect on the actor, opened in the existing raw-field editor. */
export async function createEffect(actor: unknown): Promise<void> {
  const owner = actor as EffectOwner;
  const [created] = await owner.createEmbeddedDocuments("ActiveEffect", [
    { name: game.i18n!.localize("ADND2E.sheet.effects.newName"), img: "icons/svg/aura.svg", type: "adnd2e" },
  ]);
  created?.sheet?.render({ force: true });
}

/** Custom effects only: a condition is removed, never toggled. */
export async function toggleEffect(actor: unknown, effectId: string): Promise<void> {
  const effect = (actor as EffectOwner).effects.get(effectId);
  if (!effect || effect.system.isCondition) return;
  await effect.update({ disabled: !effect.disabled });
}

export function editEffect(actor: unknown, effectId: string): void {
  (actor as EffectOwner).effects.get(effectId)?.sheet?.render({ force: true });
}

/** Custom effects only, after confirmation. */
export async function deleteEffect(actor: unknown, effectId: string): Promise<void> {
  const effect = (actor as EffectOwner).effects.get(effectId);
  if (!effect || effect.system.isCondition) return;
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n!.localize("ADND2E.sheet.effects.deleteTitle") },
    content: `<p>${game.i18n!.format("ADND2E.sheet.effects.deleteConfirm", { name: effect.name })}</p>`,
  });
  if (confirmed) await effect.delete();
}

/** Remove a condition through the same call as the Token HUD and the Stand Up button, so wrestling's held/grappling
 *  cleanup runs. An effect with no condition id falls back to a plain delete. */
export async function removeCondition(actor: unknown, effectId: string): Promise<void> {
  const owner = actor as EffectOwner;
  const effect = owner.effects.get(effectId);
  if (!effect?.system.isCondition) return;
  if (effect.system.conditionId) await owner.toggleStatusEffect(effect.system.conditionId, { active: false });
  else await effect.delete();
}

export function openEffectSource(actor: unknown, itemId: string): void {
  (actor as EffectOwner).items.get(itemId)?.sheet?.render({ force: true });
}
