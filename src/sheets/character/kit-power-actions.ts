import { TEMPLATE_PATH } from "../../constants";
import {
  buildPowerUseCardContext,
  canUsePower,
  powerKey,
  powerRemaining,
  resetKeys,
  spendPower,
  usageResetUpdate,
  usageSpendUpdate,
  usedCount,
  type PowerFrequency,
  type PowerUsage,
} from "../../core/kits";
import { activeKitEntries } from "../../data/derive/character/kits";

/* SP11 Plan B — kit powers. Foundry glue only; the rules live in
 * src/core/kits/powers.ts. Every write targets the acting actor's own
 * `system.kitPowers`, so a non-GM owner can Use a power. */

export interface KitPowerActor {
  name: string;
  img: string;
  items: Iterable<{ id: string; name: string; type: string; system: unknown }>;
  system: { kitPowers?: PowerUsage };
  update(data: Record<string, unknown>): Promise<unknown>;
}

function findPower(actor: KitPowerActor, kitId: string, powerId: string) {
  const kit = activeKitEntries(actor.items).find((k) => k.id === kitId);
  const power = kit?.powers.find((p) => p.id === powerId);
  return kit && power ? { kit, power } : null;
}

const usageOf = (actor: KitPowerActor): PowerUsage => actor.system.kitPowers ?? {};

/** Spends one use (at-will powers are free) and posts the chat card. */
export async function usePower(actor: KitPowerActor, kitId: string, powerId: string): Promise<void> {
  const found = findPower(actor, kitId, powerId);
  if (!found) return;
  const { power } = found;
  const used = usedCount(usageOf(actor), kitId, powerId);
  if (!canUsePower(power, used)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.kits.noUsesLeft"));
    return;
  }
  const next = spendPower(power, used);
  if (next !== used) await actor.update(usageSpendUpdate(powerKey(kitId, powerId), next));

  const context = buildPowerUseCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    power,
    remaining: powerRemaining(power, next),
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/kit-power-use.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
  } as never);
}

/** Manual reset of one power's counter. */
export async function resetPower(actor: KitPowerActor, kitId: string, powerId: string): Promise<void> {
  if (!findPower(actor, kitId, powerId)) return;
  if (usedCount(usageOf(actor), kitId, powerId) === 0) return;
  await actor.update(usageResetUpdate([powerKey(kitId, powerId)]));
}

/** Zeroes every used power of one frequency across the actor's active kits (New day / New encounter / Rest). */
export async function resetKitPowers(actor: KitPowerActor, per: PowerFrequency): Promise<void> {
  const keys = resetKeys(activeKitEntries(actor.items), usageOf(actor), per);
  if (keys.length > 0) await actor.update(usageResetUpdate(keys));
}
