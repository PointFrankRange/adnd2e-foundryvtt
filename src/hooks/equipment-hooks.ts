import { actorEquipmentRules, itemNotPermitted } from "../data/derive/character/equipment-rules";

/* SP11 Plan A: equipping a weapon or armor the character's class (plus kit) does
 * not permit warns the user who equipped it. It still equips — the GM rules. Runs
 * only on the client that made the update. Registered once from the `ready` hook. */

export function registerEquipmentHooks(): void {
  Hooks.on("updateItem", (item: unknown, changed: unknown, _options: unknown, userId: string) => {
    if (userId !== game.user?.id) return;
    const doc = item as { type: string; name: string; system: unknown; parent: { type: string; items: Iterable<{ type: string; system: unknown }> } | null };
    if (doc.type !== "weapon" && doc.type !== "armor") return;
    if (foundry.utils.getProperty(changed as object, "system.equipped") !== true) return;
    const actor = doc.parent;
    if (!actor || actor.type !== "character") return;
    if (itemNotPermitted(actorEquipmentRules(actor.items), doc)) {
      ui.notifications?.warn(game.i18n!.format("ADND2E.sheet.equipment.notPermitted", { item: doc.name }));
    }
  });
}
