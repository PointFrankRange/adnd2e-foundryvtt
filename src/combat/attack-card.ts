import type { AttackCardContext, AttackCardInput, ModifierLine } from "./card-types";

const MODIFIER_LABELS: Record<keyof AttackCardInput["modifierBreakdown"], string> = {
  strength: "ADND2E.chat.attack.modStrength",
  dexterityMissile: "ADND2E.chat.attack.modDexMissile",
  weaponMagic: "ADND2E.chat.attack.modWeaponMagic",
  proficiency: "ADND2E.chat.attack.modProficiency",
  range: "ADND2E.chat.attack.modRange",
  situational: "ADND2E.chat.attack.modSituational",
};

/** Turn a resolved attack roll into the chat-card's display data. Zero-value
 *  modifiers are dropped from the breakdown — a clean card, not a wall of "+0"s. */
export function buildAttackCardContext(input: AttackCardInput): AttackCardContext {
  const modifierBreakdown: ModifierLine[] = (
    Object.entries(input.modifierBreakdown) as [keyof AttackCardInput["modifierBreakdown"], number][]
  )
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => ({ label: MODIFIER_LABELS[key], value }));

  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    weaponName: input.weaponName,
    targetName: input.targetName,
    formula: input.formula,
    naturalD20: input.naturalD20,
    total: input.hit.total,
    needed: input.hit.needed,
    margin: input.hit.margin,
    hit: input.hit.hit,
    autoHit: input.hit.autoHit,
    autoMiss: input.hit.autoMiss,
    backstab: input.backstab,
    critLabel: input.critLabel,
    fumbleLabel: input.fumbleLabel,
    modifierBreakdown,
    damageContext: input.damageContext,
  };
}
