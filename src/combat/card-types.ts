export interface ModifierLine { label: string; value: number }

/* ---------- attack ---------- */

export interface AttackCardInput {
  actorName: string;
  actorImg: string;
  weaponName: string;
  /** the targeted token's actor name, or null if no target was selected */
  targetName: string | null;
  formula: string;
  naturalD20: number;
  /** from core/combat/attack.ts hitResult() */
  hit: { hit: boolean; autoHit: boolean; autoMiss: boolean; needed: number; total: number; margin: number };
  /** from core/combat/attack.ts attackModifiers().breakdown */
  modifierBreakdown: {
    strength: number; dexterityMissile: number; weaponMagic: number;
    proficiency: number; range: number; situational: number;
  };
  /** carried into the chat message's flags so the "Roll Damage" button knows
   *  what to roll; null when there is no weapon item to roll damage from
   *  (should not normally happen — a "Roll Attack" always originates from a weapon row) */
  damageContext: { weaponItemId: string; actorId: string; targetSize: string | null } | null;
}

export interface AttackCardContext {
  actorName: string; actorImg: string;
  weaponName: string; targetName: string | null;
  formula: string; naturalD20: number; total: number;
  needed: number; margin: number;
  hit: boolean; autoHit: boolean; autoMiss: boolean;
  /** zero-value modifiers are omitted — a clean card, not a wall of "+0" lines */
  modifierBreakdown: ModifierLine[];
  damageContext: { weaponItemId: string; actorId: string; targetSize: string | null } | null;
}

/* ---------- damage ---------- */

export interface DamageCardInput {
  actorName: string; actorImg: string;
  weaponName: string;
  formula: string;
  rolledBaseDamage: number;
  /** from core/combat/damage.ts damageModifiers().total */
  damageBonus: number;
}

export interface DamageCardContext {
  actorName: string; actorImg: string;
  weaponName: string;
  formula: string; rolled: number; bonus: number; total: number;
}

/* ---------- save ---------- */

export interface SaveCardInput {
  actorName: string; actorImg: string;
  /** i18n key, e.g. config.saves["ppd"] */
  categoryLabel: string;
  formula: string;
  naturalD20: number;
  rollModifier: number;
  target: number;
}

export interface SaveCardContext {
  actorName: string; actorImg: string;
  categoryLabel: string;
  formula: string; naturalD20: number; total: number;
  target: number; success: boolean;
}
