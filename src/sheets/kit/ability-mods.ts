// Ability-modifier mini-box formatting (sheet redesign R1 dev-world fix 1).
// The Roll20-style ability boxes show a captioned, readable value for every
// entry in a StrengthModifiers/.../CharismaModifiers object — this is the
// pure formatting rule shared by all of them. Pure.

/** Keys whose numeric value is always shown with an explicit sign, including
 *  a non-negative zero as "+0". */
const SIGNED_KEYS: ReadonlySet<string> = new Set([
  "hitProb", "damageAdj", "reactionAdj", "missileAttackAdj", "defensiveAdj",
  "hpAdjustment", "poisonSave", "magicalDefenseAdj", "loyaltyBase",
]);

/** Keys whose numeric value is a percentage. */
const PERCENT_KEYS: ReadonlySet<string> = new Set([
  "systemShock", "resurrectionSurvival", "bendBarsLiftGates", "learnSpellChance", "spellFailureChance",
]);

/** Formats one ability-modifier entry for the mini-box's value span.
 *  `key` is the StrengthModifiers/.../CharismaModifiers field name (e.g.
 *  "hitProb", "bonusPriestSpells"); `value` is that field's raw value. */
export function formatAbilityMod(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";

  if (key === "bonusPriestSpells") {
    const counts = value as readonly number[];
    const parts = counts
      .map((count, i) => (count !== 0 ? `${i + 1}×${count}` : null))
      .filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join(" ") : "—";
  }

  if (typeof value === "number") {
    if (SIGNED_KEYS.has(key)) return value >= 0 ? `+${value}` : String(value);
    if (PERCENT_KEYS.has(key)) return `${value}%`;
    return String(value);
  }

  return String(value);
}
