import { getChassis } from "../../core/classes/chassis";
import type { ClassId } from "../../core/types";

/* ---------------------------------------------------------------------------
 * rollHitPoints — SP2 Task 8.
 *
 * Foundry-coupled (Roll, ChatMessage) — not unit-tested (spec §9). The pure
 * math (Math.floor(hitDie / 2) + 1) is trivial; the value it feeds (hp max
 * from accumulated rolls) is already engine-tested via `deriveCharacter`.
 * ------------------------------------------------------------------------- */

interface ClassItemLike {
  system: { chassisId: ClassId; hpRolls: number[]; canLevelUp?: boolean };
  parent: { name: string; system: { abilities: { con: { mods?: { hpAdjustment?: number } } } } } | null;
  name: string;
  update(data: Record<string, unknown>): Promise<unknown>;
}

/** Roll (or take the average of) this class's hit die and append it to `system.hpRolls`. */
export async function rollHitPoints(
  classItem: ClassItemLike,
  { average = false } = {},
): Promise<void> {
  if (!classItem.system.canLevelUp) return;
  const die = getChassis(classItem.system.chassisId).hitDie;
  let dieResult: number;
  let flavor: string;
  if (average) {
    dieResult = Math.floor(die / 2) + 1;
    flavor = game.i18n!.format("ADND2E.sheet.xp.hpAverageFlavor", {
      die: String(die),
      result: String(dieResult),
    });
  } else {
    const roll = await new Roll(`1d${die}`).evaluate();
    dieResult = roll.total ?? 0;
    await roll.toMessage({
      flavor: game.i18n!.format("ADND2E.sheet.xp.hpRollFlavor", { die: String(die), name: classItem.name }),
    });
    flavor = "";
  }
  const conAdj = classItem.parent?.system.abilities.con.mods?.hpAdjustment ?? 0;
  if (average || flavor) {
    await ChatMessage.create({
      content:
        flavor ||
        game.i18n!.format("ADND2E.sheet.xp.hpApplied", { result: String(dieResult), con: String(conAdj) }),
    });
  }
  await classItem.update({ "system.hpRolls": [...classItem.system.hpRolls, dieResult] });
}
