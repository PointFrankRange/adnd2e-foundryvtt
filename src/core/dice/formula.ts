// Dice-formula string builders. The engine never constructs a Foundry Roll — it
// returns the formula text for the Foundry layer to roll.

/** A modifier as a formula suffix: 0 -> "", 3 -> " + 3", -2 -> " - 2". */
export function signedTerm(modifier: number): string {
  if (modifier === 0) return "";
  return modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
}

/** A 1d20 attack roll with its total modifier. */
export function attackFormula(attackBonus: number): string {
  return `1d20${signedTerm(attackBonus)}`;
}

/** A weapon damage roll: the weapon's dice string plus the damage bonus. */
export function damageFormula(baseDice: string, damageBonus: number): string {
  return `${baseDice}${signedTerm(damageBonus)}`;
}
