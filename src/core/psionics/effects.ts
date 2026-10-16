/* Issue #180: what each telepathic attack mode does to a CONTACTED mind (PHBR5 ch.7). Pure: the glue rolls the dice and the saves. */

export type EffectKind = "losePower" | "daze" | "idle" | "crush" | "blast";

export interface EffectPlan {
  kind: EffectKind;
  /** the victim's save (both book saves, paralyzation and death, use the same save category); autoFail = the power score result */
  save: { label: "paralyzation" | "death"; autoFail: boolean } | null;
  duration: { dice: string; unit: "rounds" | "days" } | null;
  damageDice: string | null;
  /** the extra result of a roll exactly at the power score */
  special: "turnOnAllies" | "passOut" | null;
}

export interface EffectCheck {
  success: boolean;
  /** the roll equals the power score exactly */
  special: boolean;
  natural20: boolean;
}

/** The effect of a successful power check with the mode, or null for a failed check / a name that is not an attack mode. */
export function effectPlan(mode: string, check: EffectCheck): EffectPlan | null {
  if (!check.success) return null;
  switch (mode.trim().toLowerCase()) {
    case "mind thrust":
      return { kind: "losePower", save: null, duration: { dice: "2d6", unit: "days" }, damageDice: null, special: null };
    case "ego whip":
      return { kind: "daze", save: null, duration: { dice: "1d4", unit: "rounds" }, damageDice: null, special: null };
    case "id insinuation":
      return { kind: "idle", save: null, duration: { dice: "1d4", unit: "rounds" }, damageDice: null, special: check.special ? "turnOnAllies" : null };
    case "psychic crush":
      return { kind: "crush", save: { label: "paralyzation", autoFail: check.special }, duration: null, damageDice: "1d8", special: null };
    case "psionic blast":
      return { kind: "blast", save: { label: "death", autoFail: false }, duration: null, damageDice: null, special: check.special ? "passOut" : null };
    default:
      return null;
  }
}

/** The lang key of the book's natural-20 note for the mode, or null (only Id Insinuation and Psychic Crush have one). */
export function failureNote(mode: string, natural20: boolean): string | null {
  if (!natural20) return null;
  const m = mode.trim().toLowerCase();
  if (m === "id insinuation") return "idNat20";
  if (m === "psychic crush") return "crushNat20";
  return null;
}

export interface EffectOutcome {
  /** true = the victim failed the save, false = made it, null = not rolled (the target has no save to roll) */
  saveFailed: boolean | null;
  duration: number | null;
  damage: number | null;
  /** Mind Thrust: the power the victim loses, or null when it has none */
  lostPower: string | null;
  /** Psionic Blast: the victim's current hit points, or null when unknown */
  hp: number | null;
}

export interface EffectLine {
  key: string;
  params: Record<string, string | number>;
}

const line = (key: string, params: Record<string, string | number> = {}): EffectLine => ({ key, params });

/** The plain-language lines of the effect card (keys under ADND2E.chat.psionicEffect). */
export function effectLines(plan: EffectPlan, o: EffectOutcome): EffectLine[] {
  const unit = plan.duration?.unit ?? "rounds";
  const n = o.duration ?? 0;
  if (plan.save && o.saveFailed === null) return [line("saveManual", { save: plan.save.label })];
  switch (plan.kind) {
    case "losePower":
      return [o.lostPower === null ? line("mindThrustNone") : line("mindThrustLose", { power: o.lostPower, days: n })];
    case "daze":
      return [line("dazed", { rounds: n, unit })];
    case "idle":
      return [line(plan.special === "turnOnAllies" ? "idTurn" : "idIdle", { rounds: n })];
    case "crush":
      return [o.saveFailed ? line("crushHurt", { damage: o.damage ?? 0 }) : line("crushResisted")];
    case "blast": {
      if (!o.saveFailed) return [line("blastResisted")];
      const lines = [o.hp === null ? line("blastLoseUnknown") : line("blastLose", { lost: Math.floor(o.hp * 0.8) })];
      if (plan.special === "passOut") lines.push(line("blastPassOut"));
      return lines;
    }
  }
}
