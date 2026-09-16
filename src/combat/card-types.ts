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
  damageContext: { weaponItemId: string; actorUuid: string; targetSize: string | null } | null;
}

export interface AttackCardContext {
  actorName: string; actorImg: string;
  weaponName: string; targetName: string | null;
  formula: string; naturalD20: number; total: number;
  needed: number; margin: number;
  hit: boolean; autoHit: boolean; autoMiss: boolean;
  /** zero-value modifiers are omitted — a clean card, not a wall of "+0" lines */
  modifierBreakdown: ModifierLine[];
  damageContext: { weaponItemId: string; actorUuid: string; targetSize: string | null } | null;
}

/* ---------- damage ---------- */

export interface DamageCardInput {
  actorName: string; actorImg: string;
  weaponName: string;
  formula: string;
  rolledBaseDamage: number;
  /** from core/combat/damage.ts damageModifiers().total */
  damageBonus: number;
  /** set only for a backstab attack — the pre-floor total (rolled + bonus,
   *  floored at 1 by damageResult) is multiplied by this before display.
   *  null for a normal (non-backstab) damage roll. */
  backstabMultiplier: number | null;
}

export interface DamageCardContext {
  actorName: string; actorImg: string;
  weaponName: string;
  formula: string; rolled: number; bonus: number; total: number;
  /** null for a normal roll — the template shows a "×N backstab!" line only
   *  when this is non-null. */
  backstabMultiplier: number | null;
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

/* ---------- non-weapon proficiency check ---------- */

export interface NonweaponCheckCardInput {
  actorName: string;
  actorImg: string;
  proficiencyName: string;
  /** i18n key, e.g. config.abilities["dex"] */
  abilityLabel: string;
  formula: string;
  /** the 1d20 result actually rolled */
  roll: number;
  result: { success: boolean; autoFail: boolean; target: number };
}

export interface NonweaponCheckCardContext {
  actorName: string;
  actorImg: string;
  proficiencyName: string;
  abilityLabel: string;
  formula: string;
  roll: number;
  target: number;
  success: boolean;
  /** true only on a natural 20 — the card shows a distinct "fumble" line
   *  instead of the plain failure line when this is true (PHB p.55: a
   *  natural 20 always fails regardless of how high the target is) */
  autoFail: boolean;
}

/* ---------- thief/bard skill check ---------- */

export interface ThiefSkillCardInput {
  actorName: string;
  actorImg: string;
  /** i18n key, e.g. "ADND2E.chat.thiefSkill.skills.pickPockets" */
  skillLabel: string;
  formula: string;
  /** the d100 result actually rolled */
  roll: number;
  result: { success: boolean; target: number };
}

export interface ThiefSkillCardContext {
  actorName: string;
  actorImg: string;
  skillLabel: string;
  formula: string;
  roll: number;
  target: number;
  success: boolean;
}
