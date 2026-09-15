// PHB p.61 / DMG (Individual Initiative optional rule): 1d10, lower total acts
// first. Weapon speed factor and spell casting time modify the roll additively
// (both already roll-signed: a slower weapon/longer cast = a larger positive
// number = a worse, later initiative). DEX reaction adjustment is core PHB
// initiative (Table 3), independent of the weapon-speed optional rule.

export interface InitiativeModifierInput {
  /** the currently equipped weapon's speed factor; 0 if unarmed or the
   *  weaponSpeedInitiative optional rule is off */
  weaponSpeedFactor?: number;
  /** dexterity(dex).reactionAdj — already roll-signed (negative = better) */
  reactionAdj?: number;
  /** a manual per-round entry (e.g. a spell's casting time in segments) */
  situationalModifier?: number;
}

export interface InitiativeModifierResult {
  total: number;
  breakdown: { weaponSpeed: number; reaction: number; situational: number };
}

/** 2E initiative is a straight sum — lower `total` acts first. */
export function initiativeModifiers(input: InitiativeModifierInput): InitiativeModifierResult {
  const weaponSpeed = input.weaponSpeedFactor ?? 0;
  const reaction = input.reactionAdj ?? 0;
  const situational = input.situationalModifier ?? 0;
  return {
    total: weaponSpeed + reaction + situational,
    breakdown: { weaponSpeed, reaction, situational },
  };
}
