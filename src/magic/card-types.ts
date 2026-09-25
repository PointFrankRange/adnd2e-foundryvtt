import type { CanLearnResult } from "../core/magic/spellbook";

export interface CastCardInput {
  actorName: string;
  actorImg: string;
  spellName: string;
  spellLevel: number;
  range: string;
  duration: string;
  castingTime: string;
  /** the spell's `savingThrow` field value — "none" means no save (see `SAVING_THROW_KINDS` in src/data/item/choices.ts) */
  savingThrow: string;
  components: { v: boolean; s: boolean; m: boolean };
  /** the result of rolling the spell's automation.damage/healing formula, or null when neither is set */
  rollResult: { kind: "damage" | "healing"; formula: string; total: number } | null;
}

export interface CastCardContext {
  actorName: string;
  actorImg: string;
  spellName: string;
  spellLevel: number;
  range: string;
  duration: string;
  castingTime: string;
  savingThrow: string;
  /** true when savingThrow !== "none" — lets the template skip an empty line without a helper */
  hasSavingThrow: boolean;
  components: { v: boolean; s: boolean; m: boolean };
  /** rollResult plus a precomputed i18n label key — templates never build keys themselves */
  rollResult: { kind: "damage" | "healing"; label: string; formula: string; total: number } | null;
  /** carried into the Apply button's dataset; null when rollResult is null (nothing to apply) */
  applyContext: { amount: number; kind: "damage" | "healing" } | null;
}

export interface LearnSpellCardInput {
  actorName: string;
  actorImg: string;
  spellName: string;
  spellLevel: number;
  result: CanLearnResult;
  /** null when result.allowed is false — a rejected attempt never rolls */
  roll: { d100: number; success: boolean } | null;
}

export interface LearnSpellCardContext {
  actorName: string;
  actorImg: string;
  spellName: string;
  spellLevel: number;
  allowed: boolean;
  chance: number;
  /** i18n key for the rejection reason; null when allowed is true */
  reasonLabel: string | null;
  roll: { d100: number; success: boolean } | null;
}

export interface CastingNoticeInput {
  actorName: string;
  actorImg: string;
  spellName: string;
  spellLevel: number;
  /** "begin" when a timed cast starts in combat; "lost" when it is disrupted */
  kind: "begin" | "lost";
  /** round spells: the round at whose end it takes effect */
  completeRound: number | null;
  /** segment spells: the initiative addition */
  initiativeAdd: number | null;
}

export interface CastingNoticeContext {
  actorName: string;
  actorImg: string;
  spellName: string;
  spellLevel: number;
  headlineKey: string;
  /** i18n key of the detail line, or null when there is none */
  detailKey: string | null;
  detailValue: number | null;
  lost: boolean;
}
