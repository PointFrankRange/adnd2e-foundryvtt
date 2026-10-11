// Ranger tracking (SP20; PHBR11 pp.14-17, Tables 15-19). Pure rules, no Foundry.

export const TRACKING_TERRAINS = ["freshSnow", "softGround", "thickBrush", "forestField", "normal", "desert", "swamp", "rocky"] as const;
export type TrackingTerrain = (typeof TRACKING_TERRAINS)[number];

/** Table 15 — use the one that applies. */
export const TERRAIN_MODIFIERS: Readonly<Record<TrackingTerrain, number>> = {
  freshSnow: 6, softGround: 4, thickBrush: 3, forestField: 2, normal: 0, desert: -2, swamp: -5, rocky: -10,
};

export const TRACKING_ILLUMINATIONS = ["good", "twilight", "moonlit", "dark"] as const;
export type TrackingIllumination = (typeof TRACKING_ILLUMINATIONS)[number];

/** Table 16 — use the one that applies. */
export const ILLUMINATION_MODIFIERS: Readonly<Record<TrackingIllumination, number>> = {
  good: 0, twilight: -3, moonlit: -6, dark: -10,
};

/** Table 14's nine terrains a ranger may specialize in (optional rule). */
export const PRIMARY_TERRAINS = ["aquatic", "arctic", "desert", "forest", "hill", "jungle", "mountain", "plain", "swamp"] as const;
export type PrimaryTerrain = (typeof PRIMARY_TERRAINS)[number];

export type MovementLimit = "quarter" | "half" | "threeQuarters";
export type IdentificationId = "generalType" | "specificTypeHeading" | "number" | "sizeAge" | "pace" | "recent" | "conditions";

export interface TrackingInput {
  wisdom: number;
  level: number;
  terrain: TrackingTerrain;
  illumination: TrackingIllumination;
  creaturesTracked: number;
  assistingTrackers: number;
  animalFollower: boolean;
  trailInPrimaryTerrain: boolean;
  hoursSinceMade: number;
  rainHours: number;
  quarryHidesTrail: boolean;
  quarryIsSpecializedHiding: boolean;
  nonNatural: boolean;
}

export interface ModifierRow {
  labelKey: string;
  amount: number;
}

export interface TrackingScore {
  /** the modified score the d20 is rolled against (after any halving) */
  score: number;
  /** the sum before the non-natural halving */
  total: number;
  halved: boolean;
  breakdown: ModifierRow[];
}

const count = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/** Table 15-17: Wisdom plus every applicable modifier; non-natural surroundings halve the final score (rounded down). */
export function trackingScore(input: TrackingInput): TrackingScore {
  const levelBonus = Math.floor(count(input.level) / 3);
  const breakdown: ModifierRow[] = [{ labelKey: "ADND2E.tracking.mod.wisdom", amount: Math.trunc(input.wisdom) }];
  const add = (labelKey: string, amount: number): void => {
    if (amount !== 0) breakdown.push({ labelKey, amount });
  };
  add("ADND2E.tracking.mod.level", levelBonus);
  add(`ADND2E.trackingTerrains.${input.terrain}`, TERRAIN_MODIFIERS[input.terrain]);
  add(`ADND2E.trackingIlluminations.${input.illumination}`, ILLUMINATION_MODIFIERS[input.illumination]);
  add("ADND2E.tracking.mod.creatures", Math.floor(count(input.creaturesTracked) / 2));
  add("ADND2E.tracking.mod.assistants", Math.min(count(input.assistingTrackers), levelBonus));
  add("ADND2E.tracking.mod.animal", input.animalFollower ? 1 : 0);
  add("ADND2E.tracking.mod.primaryTerrain", input.trailInPrimaryTerrain ? 2 : 0);
  add("ADND2E.tracking.mod.age", -Math.floor(count(input.hoursSinceMade) / 12));
  add("ADND2E.tracking.mod.rain", -5 * count(input.rainHours));
  add("ADND2E.tracking.mod.hides", input.quarryHidesTrail ? -5 : 0);
  add("ADND2E.tracking.mod.specializedHiding", input.quarryHidesTrail && input.quarryIsSpecializedHiding ? -2 : 0);
  const total = breakdown.reduce((sum, row) => sum + row.amount, 0);
  return { score: input.nonNatural ? Math.floor(total / 2) : total, total, halved: input.nonNatural, breakdown };
}

/** Tracking is possible only with a modified score above zero. */
export const canTrack = (score: number): boolean => score > 0;

/** d20 at or under the score succeeds; a natural 20 always fails. */
export const resolveCheck = (roll: number, score: number): boolean => roll <= score && roll !== 20;

/** Table 18: the fraction of normal movement the ranger can keep while tracking. */
export function movementLimit(score: number): MovementLimit | null {
  if (score < 1) return null;
  if (score <= 6) return "quarter";
  return score <= 14 ? "half" : "threeQuarters";
}

const IDENTIFICATION_STEPS: readonly { minLevel: number; id: IdentificationId }[] = [
  { minLevel: 1, id: "generalType" },
  { minLevel: 3, id: "specificTypeHeading" },
  { minLevel: 5, id: "number" },
  { minLevel: 7, id: "sizeAge" },
  { minLevel: 8, id: "pace" },
  { minLevel: 9, id: "recent" },
  { minLevel: 10, id: "conditions" },
];

/** Table 19: cumulative — a ranger gets every row up to his level. */
export const identificationInfo = (level: number): IdentificationId[] =>
  IDENTIFICATION_STEPS.filter((s) => level >= s.minLevel).map((s) => s.id);

export interface TrackingFormValues extends Omit<TrackingInput, "wisdom" | "level"> {
  /** also attempt the identification check after a tracking success */
  identify: boolean;
}

const flag = (v: unknown, fallback = false): boolean => (v === undefined ? fallback : v === true || v === "true" || v === "on" || v === 1);
const num = (v: unknown): number => count(Number(v));

/** Coerces the dialog's form data (strings, checkboxes) into typed input; invalid choices fall back to normal ground / good light. */
export function trackingInputFromForm(raw: Record<string, unknown>, specialized: boolean): TrackingFormValues {
  const terrain = TRACKING_TERRAINS.find((t) => t === raw.terrain) ?? "normal";
  const illumination = TRACKING_ILLUMINATIONS.find((i) => i === raw.illumination) ?? "good";
  return {
    terrain,
    illumination,
    creaturesTracked: num(raw.creaturesTracked),
    assistingTrackers: num(raw.assistingTrackers),
    animalFollower: flag(raw.animalFollower),
    trailInPrimaryTerrain: specialized && flag(raw.trailInPrimaryTerrain),
    hoursSinceMade: num(raw.hoursSinceMade),
    rainHours: num(raw.rainHours),
    quarryHidesTrail: flag(raw.quarryHidesTrail),
    quarryIsSpecializedHiding: flag(raw.quarryIsSpecializedHiding),
    nonNatural: flag(raw.nonNatural),
    identify: flag(raw.identify, true),
  };
}
