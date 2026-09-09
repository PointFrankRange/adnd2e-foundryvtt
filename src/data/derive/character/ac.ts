import { armorClass } from "../../../core/combat/armor-class";
import type { EquippedArmor, EquippedShield } from "./snapshot";

export interface AcInput {
  equippedArmor: EquippedArmor | null;
  equippedShield: EquippedShield | null;
  /** dexterity(dex).defensiveAdj — AC-signed (negative = agile) */
  dexDefensiveAdj: number;
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
  const baseArmorAc = input.equippedArmor?.baseArmorAc ?? 10;
  const shieldBonus = input.equippedShield?.shieldBonus ?? 0;
  const armorMagic = input.equippedArmor?.magicBonus ?? 0;
  const shieldMagic = input.equippedShield?.magicBonus ?? 0;
  const common = { baseArmorAc, shieldBonus, dexDefensiveAdj: input.dexDefensiveAdj };
  const withShield = armorMagic + shieldMagic;
  return {
    normal: armorClass({ ...common, magicBonus: withShield }).value,
    shieldless: armorClass({ ...common, magicBonus: armorMagic, denyShield: true }).value,
    surprised: armorClass({ ...common, magicBonus: withShield, denyDexBonus: true }).value,
    rearAttack: armorClass({ ...common, magicBonus: armorMagic, denyShield: true, denyDexBonus: true }).value,
  };
}
