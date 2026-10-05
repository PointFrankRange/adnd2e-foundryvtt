/* SP11 Plan C: kit overrides of base-class abilities. Pure; Foundry-free.
 * `resolveKitOverrides` is the ONE read point: consumers never read a kit's
 * `overrides` directly, so a later override (e.g. a kit that grants a spell
 * progression) plugs in here without touching every consumer again. */

export const CASTING_MODES = ["inherit", "none"] as const;
export type CastingMode = (typeof CASTING_MODES)[number];

export const TURNING_MODES = ["inherit", "offset", "none"] as const;
export type TurningMode = (typeof TURNING_MODES)[number];

export interface TurningRule {
  mode: TurningMode;
  /** only meaningful for `offset`: turning level = class level + offset (0 = full class level) */
  offset: number;
}

export interface KitOverrides {
  casting: CastingMode;
  turning: TurningRule;
  /** free-text names of base-class abilities the kit removes; display only (the engine models none of them) */
  removedAbilities: string[];
}

export const INHERIT_TURNING: TurningRule = { mode: "inherit", offset: 0 };
export const NO_OVERRIDES: KitOverrides = { casting: "inherit", turning: INHERIT_TURNING, removedAbilities: [] };

export interface RawOverrides {
  casting?: unknown;
  turning?: { mode?: unknown; offset?: unknown } | null;
  removedAbilities?: unknown;
}

/** Lenient read, like a malformed trait effect: anything invalid falls back to "no override". */
export function normalizeOverrides(raw: RawOverrides | null | undefined): KitOverrides {
  const turning = raw?.turning ?? undefined;
  const mode = (TURNING_MODES as readonly unknown[]).includes(turning?.mode) ? (turning?.mode as TurningMode) : "inherit";
  const rawOffset = turning?.offset;
  const offset = typeof rawOffset === "number" && Number.isInteger(rawOffset) ? rawOffset : 0;
  const removedRaw = raw?.removedAbilities;
  const removed = Array.isArray(removedRaw) ? (removedRaw as unknown[]) : [];
  return {
    casting: raw?.casting === "none" ? "none" : "inherit",
    turning: { mode, offset: mode === "offset" ? offset : 0 },
    removedAbilities: removed.filter((n): n is string => typeof n === "string" && n !== ""),
  };
}

export interface ResolvedOverrides {
  castingDisabled: boolean;
  turning: TurningRule;
  removedAbilities: string[];
}

/** The overrides of the kit modifying this chassis (Plan A allows one kit per class), or the defaults. */
export function resolveKitOverrides(
  kits: readonly { chassisId: string; overrides: KitOverrides }[],
  chassisId: string,
): ResolvedOverrides {
  const kit = kits.find((k) => k.chassisId === chassisId);
  if (!kit) return { castingDisabled: false, turning: INHERIT_TURNING, removedAbilities: [] };
  return {
    castingDisabled: kit.overrides.casting === "none",
    turning: kit.overrides.turning,
    removedAbilities: kit.overrides.removedAbilities,
  };
}

/** The turning level after a kit rule. `base` is the class's normal turning level (null = cannot turn). */
export function effectiveTurnerLevel(base: number | null, classLevel: number, rule: TurningRule): number | null {
  if (rule.mode === "none") return null;
  if (rule.mode === "offset") {
    const level = classLevel + rule.offset;
    return level >= 1 ? level : null;
  }
  return base;
}
