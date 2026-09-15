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
