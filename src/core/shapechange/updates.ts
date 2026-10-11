// The actor.update payloads for the shapechange actions (SP16). Pure, so the shape of every write is tested.
import { afterNewDay, afterShift, healOnShift, type FormSnapshot, type ShapechangeState } from "./rules";

export interface ShiftPlan {
  healed: number;
  update: Record<string, unknown>;
}

/** One update: the counters, the form snapshot and the healed hit points (never above max). */
export function planShift(
  state: ShapechangeState,
  snapshot: FormSnapshot,
  hp: { value: number; max: number },
  d6: number,
): ShiftPlan {
  const damage = Math.max(0, hp.max - hp.value);
  const healed = Math.min(healOnShift(damage, d6), damage);
  const next = afterShift(state, snapshot.category);
  return {
    healed,
    update: {
      "system.shapechange.usedToday": next.usedToday,
      "system.shapechange.categoriesUsed": next.categoriesUsed,
      "system.shapechange.form": snapshot,
      "system.attributes.hp.value": Math.min(hp.max, hp.value + healed),
    },
  };
}

/** Back to normal form: the form becomes null (not deleted); no use is spent. */
export function returnUpdate(): Record<string, unknown> {
  return { "system.shapechange.form": null };
}

/** New day: counters zero, the current form is kept. */
export function newDayUpdate(): Record<string, unknown> {
  const s = afterNewDay();
  return { "system.shapechange.usedToday": s.usedToday, "system.shapechange.categoriesUsed": s.categoriesUsed };
}
