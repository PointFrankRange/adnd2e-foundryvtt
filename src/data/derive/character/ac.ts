import { armorClass } from "../../../core/combat/armor-class";
import type { EquippedArmor, EquippedShield } from "./snapshot";

export interface AcInput {
  equippedArmor: EquippedArmor | null;
  equippedShield: EquippedShield | null;
  /** dexterity(dex).defensiveAdj — AC-signed (negative = agile) */
  dexDefensiveAdj: number;
}

/** §5.6 step 6 — AC in four attack contexts (spec §5.1). */
export function deriveAc(input: AcInput): {
  normal: number;
  rearAttack: number;
  surprised: number;
  shieldless: number;
} {
  const baseArmorAc = input.equippedArmor?.baseArmorAc ?? 10;
  const shieldBonus = input.equippedShield?.shieldBonus ?? 0;
  const magicBonus = (input.equippedArmor?.magicBonus ?? 0) + (input.equippedShield?.magicBonus ?? 0);
  const common = { baseArmorAc, shieldBonus, dexDefensiveAdj: input.dexDefensiveAdj, magicBonus };
  return {
    normal: armorClass(common).value,
    shieldless: armorClass({ ...common, denyShield: true }).value,
    surprised: armorClass({ ...common, denyDexBonus: true }).value,
    rearAttack: armorClass({ ...common, denyShield: true, denyDexBonus: true }).value,
  };
}
