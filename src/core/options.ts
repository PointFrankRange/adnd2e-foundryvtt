export interface OptionalRules {
  /** PHB p.18: warriors roll d100 for exceptional Strength at STR 18. */
  exceptionalStrength: boolean;
  /** PHB p.17: cap on spells known per level from Intelligence (Table 4). */
  maxSpellsPerLevel: boolean;
}

export const DEFAULT_OPTIONAL_RULES: OptionalRules = {
  exceptionalStrength: true,
  maxSpellsPerLevel: false,
};
