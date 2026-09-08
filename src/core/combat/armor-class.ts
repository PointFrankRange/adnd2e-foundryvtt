// PHB p.89 (descending AC scale, -10..10) + Table 46: ARMOR CLASS RATINGS (p.75).
// Combined model: final AC = baseArmorAc + DEX defensive adj - shield - magic + situational.

const AC_BEST = -10;
const AC_WORST = 10;

export interface ArmorClassInput {
  /** the armor's AC rating: 10 (none) .. 1 (full plate) */
  baseArmorAc: number;
  /** amount a shield lowers AC (0 default; 1 for a normal shield) */
  shieldBonus?: number;
  /** dexterity(dex).defensiveAdj — AC-style (negative = agile) */
  dexDefensiveAdj?: number;
  /** total magic protection that lowers AC (armor + shield + ring/cloak) */
  magicBonus?: number;
  /** added directly to the final AC; negative improves, positive worsens (e.g. a DM ad-hoc AC adjustment) */
  situationalModifier?: number;
  /** drop a beneficial DEX adjustment (surprised / prone / rear); a penalty still applies */
  denyDexBonus?: boolean;
  /** drop the shield contribution (rear / rear-flank attacks) */
  denyShield?: boolean;
}

export interface ArmorClassResult {
  /** final AC, clamped to [-10, 10] */
  value: number;
  /** AC before the [-10, 10] clamp (may differ from `value` for stacked magic or a big DEX penalty) */
  raw: number;
  breakdown: {
    baseArmorAc: number;
    /** amount subtracted for the shield (post-deny) */
    shield: number;
    /** DEX defensive adjustment applied (post-deny) */
    dexterity: number;
    /** amount subtracted for magic */
    magic: number;
    situational: number;
  };
}

function clamp(n: number): number {
  return Math.min(AC_WORST, Math.max(AC_BEST, n));
}

export function armorClass(input: ArmorClassInput): ArmorClassResult {
  const shieldRaw = input.shieldBonus ?? 0;
  const dexRaw = input.dexDefensiveAdj ?? 0;
  const magic = input.magicBonus ?? 0;
  const situational = input.situationalModifier ?? 0;

  const shield = input.denyShield ? 0 : shieldRaw;
  const dexterity = input.denyDexBonus ? Math.max(0, dexRaw) : dexRaw;

  const raw = input.baseArmorAc + dexterity - shield - magic + situational;
  const value = clamp(raw);
  return {
    value,
    raw,
    breakdown: { baseArmorAc: input.baseArmorAc, shield, dexterity, magic, situational },
  };
}
