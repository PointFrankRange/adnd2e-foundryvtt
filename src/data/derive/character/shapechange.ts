// The druid's shapechange overlay on the derived character data (SP16, #84). Pure. The form snapshot lives on the actor
// (system.shapechange.form, copied at shift time); while it is set, AC and the current movement rate come from the form,
// so every reader of system.attributes.ac / .movement (targeting, the sheet) sees the shifted values. Wrestling uses its
// own AC-10 rule instead of attributes.ac, so it zeroes worn-armor bonuses while shifted (see wrestlerStats).
import { formArmorClass, type FormSnapshot } from "../../../core/shapechange";

export interface OverlayInput {
  ac: { normal: number; rearAttack: number; surprised: number; shieldless: number };
  movement: { base: number; current: number; encumbranceCategory: string };
}

export function applyShapechangeOverlay(derived: OverlayInput, form: FormSnapshot | null): OverlayInput {
  if (!form) return derived;
  return {
    ac: formArmorClass(form),
    movement: { ...derived.movement, current: form.movement.land },
  };
}
