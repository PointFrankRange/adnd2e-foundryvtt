import { armorClass } from "../../../core/combat/armor-class";
import { effectiveBaseArmorAc } from "../../../core/combat/natural-ac";
import type { EquippedArmor, EquippedShield } from "./snapshot";

export interface AcInput {
  equippedArmor: EquippedArmor | null;
  equippedShield: EquippedShield | null;
  /** dexterity(dex).defensiveAdj — AC-signed (negative = agile) */
  dexDefensiveAdj: number;
  /** SP21 (PHBR10 p.15): the race's natural armor class; absent/null = none */
  naturalAc?: number | null;
  /** SP18: added directly to AC (negative improves) - the active martial arts style's modifier */
  situationalModifier?: number;
}

/**
 * §5.6 step 6 — AC in four attack contexts (spec §5.1). The shield's own magic
 * bonus is dropped alongside the shield in the `denyShield` variants.
 *
 * NOTE: this is the pre-encumbrance AC. The step-10 encumbrance penalty
 * (`deriveEncumbrance(...).penalty.armorClass`, additive, positive = worse) is
 * NOT folded in here — pipeline ordering puts encumbrance after AC. The sheet
 * (1c.4) applies it on top.
 */
export function deriveAc(input: AcInput): {
  normal: number;
  rearAttack: number;
  surprised: number;
  shieldless: number;
} {
  const armorAc = input.equippedArmor?.baseArmorAc ?? 10;
  const baseArmorAc = effectiveBaseArmorAc(armorAc, input.naturalAc ?? null);
  const shieldBonus = input.equippedShield?.shieldBonus ?? 0;
  const armorMagic = input.equippedArmor?.magicBonus ?? 0;
  const shieldMagic = input.equippedShield?.magicBonus ?? 0;
  const common = { baseArmorAc, shieldBonus, dexDefensiveAdj: input.dexDefensiveAdj, situationalModifier: input.situationalModifier ?? 0 };
  const withShield = armorMagic + shieldMagic;
  return {
    normal: armorClass({ ...common, magicBonus: withShield }).value,
    shieldless: armorClass({ ...common, magicBonus: armorMagic, denyShield: true }).value,
    surprised: armorClass({ ...common, magicBonus: withShield, denyDexBonus: true }).value,
    rearAttack: armorClass({ ...common, magicBonus: armorMagic, denyShield: true, denyDexBonus: true }).value,
  };
}
