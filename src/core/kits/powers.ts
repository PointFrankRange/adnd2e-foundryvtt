/* SP11 Plan B: tracked, parametrized kit powers. Pure; Foundry-free.
 * A power is DEFINITION data on a kit item; how many times it has been used
 * lives on the actor (`system.kitPowers`, keyed "<kitItemId>:<powerId>"). No
 * power's effect is automated — the GM narrates it. */

export const POWER_FREQUENCIES = ["day", "week", "encounter", "at-will"] as const;
export type PowerFrequency = (typeof POWER_FREQUENCIES)[number];

export interface PowerParam {
  key: string;
  value: string;
}

export interface PowerBracket {
  minLevel: number;
  uses: number;
}

export interface KitPower {
  id: string;
  name: string;
  /** Flat uses per `per`. Stored as 0 for an at-will power and for a scaled one (which takes its uses from `usesByLevel` via `powerUses`). */
  uses: number;
  per: PowerFrequency;
  scope: string;
  params: PowerParam[];
  usesByLevel: PowerBracket[];
}

export type PowerUsage = Record<string, { used: number }>;

export interface RawPower {
  id?: unknown;
  name?: unknown;
  uses?: unknown;
  per?: unknown;
  scope?: unknown;
  params?: unknown;
  usesByLevel?: unknown;
}

/** Slug ids: no "." (they appear in dotted update paths) and no ":" (the key separator). */
const SLUG = /^[a-z0-9-]+$/;

export function powerKey(kitId: string, powerId: string): string {
  return `${kitId}:${powerId}`;
}

function normalizeParams(raw: unknown): PowerParam[] {
  if (!Array.isArray(raw)) return [];
  const out: PowerParam[] = [];
  for (const p of raw as { key?: unknown; value?: unknown }[]) {
    if (p && typeof p.key === "string" && p.key !== "" && typeof p.value === "string") {
      out.push({ key: p.key, value: p.value });
    }
  }
  return out;
}

function normalizeBrackets(raw: unknown): PowerBracket[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: PowerBracket[] = [];
  for (const b of raw as { minLevel?: unknown; uses?: unknown }[]) {
    if (!b || typeof b.minLevel !== "number" || !Number.isInteger(b.minLevel) || b.minLevel < 1) continue;
    if (typeof b.uses !== "number" || !Number.isInteger(b.uses) || b.uses < 0) continue;
    if (seen.has(b.minLevel)) continue;
    seen.add(b.minLevel);
    out.push({ minLevel: b.minLevel, uses: b.uses });
  }
  return out.sort((a, b) => a.minLevel - b.minLevel);
}

/** Lenient read, like a malformed trait effect: a bad power is dropped (inert).
 *  Afterwards at-will ⇔ `per === "at-will"` (a flat `uses: 0` is coerced to at-will);
 *  a scaled power stores `uses: 0` and takes its uses from `usesByLevel` via `powerUses`. */
export function normalizePowers(raw: readonly RawPower[]): KitPower[] {
  const seen = new Set<string>();
  const out: KitPower[] = [];
  for (const p of raw) {
    if (typeof p.id !== "string" || !SLUG.test(p.id) || seen.has(p.id)) continue;
    if (typeof p.name !== "string" || p.name === "") continue;
    if (!(POWER_FREQUENCIES as readonly unknown[]).includes(p.per)) continue;
    const usesByLevel = normalizeBrackets(p.usesByLevel);
    if (usesByLevel.length > 0 && p.per === "at-will") continue;
    seen.add(p.id);
    const scaled = usesByLevel.length > 0;
    const finite = typeof p.uses === "number" && Number.isInteger(p.uses) && p.uses > 0;
    const atWill = !scaled && (!finite || p.per === "at-will");
    out.push({
      id: p.id,
      name: p.name,
      uses: atWill || scaled ? 0 : (p.uses as number),
      per: atWill ? "at-will" : (p.per as PowerFrequency),
      scope: typeof p.scope === "string" ? p.scope : "",
      params: normalizeParams(p.params),
      usesByLevel,
    });
  }
  return out;
}

export function usedCount(usage: PowerUsage, kitId: string, powerId: string): number {
  const n = usage[powerKey(kitId, powerId)]?.used;
  return typeof n === "number" && n > 0 ? n : 0;
}

/** The uses available at this class level: the highest `usesByLevel` bracket at or below it (0 below the first), or the flat `uses` with no table. */
export function powerUses(power: KitPower, classLevel: number): number {
  if (power.usesByLevel.length === 0) return power.uses;
  let uses = 0;
  for (const b of power.usesByLevel) if (b.minLevel <= classLevel) uses = b.uses;
  return uses;
}

export function powerRemaining(power: KitPower, used: number, classLevel = 1): number | null {
  return power.per === "at-will" ? null : Math.max(0, powerUses(power, classLevel) - used);
}

export function canUsePower(power: KitPower, used: number, classLevel = 1): boolean {
  const remaining = powerRemaining(power, used, classLevel);
  return remaining === null || remaining > 0;
}

/** The new `used` count after one use; at-will powers are never counted. */
export function spendPower(power: KitPower, used: number, classLevel = 1): number {
  return power.per === "at-will" || !canUsePower(power, used, classLevel) ? used : used + 1;
}

export interface PowerRow {
  id: string;
  name: string;
  per: PowerFrequency;
  atWill: boolean;
  uses: number;
  used: number;
  remaining: number | null;
  scope: string;
  params: PowerParam[];
  canUse: boolean;
  canReset: boolean;
  locked: boolean;
}

export function buildPowerRows(kitId: string, powers: readonly KitPower[], usage: PowerUsage, classLevel = 1): PowerRow[] {
  return powers.map((p) => {
    const used = usedCount(usage, kitId, p.id);
    const uses = powerUses(p, classLevel);
    return {
      id: p.id,
      name: p.name,
      per: p.per,
      atWill: p.per === "at-will",
      uses,
      used,
      remaining: powerRemaining(p, used, classLevel),
      scope: p.scope,
      params: p.params,
      canUse: canUsePower(p, used, classLevel),
      canReset: p.per !== "at-will" && used > 0,
      locked: p.per !== "at-will" && uses === 0,
    };
  });
}

/** Keys of used, non-at-will powers with the given frequency, across the given kits. */
export function resetKeys(
  kits: readonly { id: string; powers: readonly KitPower[] }[],
  usage: PowerUsage,
  per: PowerFrequency,
): string[] {
  const keys: string[] = [];
  for (const kit of kits) {
    for (const p of kit.powers) {
      if (p.per === per && p.per !== "at-will" && usedCount(usage, kit.id, p.id) > 0) keys.push(powerKey(kit.id, p.id));
    }
  }
  return keys;
}

/** Actor update that zeroes the given keys (set, not delete: an ObjectField update merges). */
export function usageResetUpdate(keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [`system.kitPowers.${k}`, { used: 0 }]));
}

export function usageSpendUpdate(key: string, used: number): Record<string, unknown> {
  return { [`system.kitPowers.${key}`]: { used } };
}

/** The counter keys of a removed kit — the caller deletes each with a `ForcedDeletion` (pure: core stays Foundry-free). */
export function usagePruneKeys(usage: PowerUsage, kitId: string): string[] {
  const prefix = `${kitId}:`;
  return Object.keys(usage).filter((k) => k.startsWith(prefix));
}

export interface PowerUseCardInput {
  actorName: string;
  actorImg: string;
  power: KitPower;
  /** Remaining uses AFTER this use; null for at-will. */
  remaining: number | null;
  /** resolved uses at the class level; defaults to the power's flat uses */
  uses?: number;
}

export interface PowerUseCardContext {
  actorName: string;
  actorImg: string;
  powerName: string;
  scope: string;
  params: PowerParam[];
  atWill: boolean;
  remaining: number | null;
  uses: number;
  perKey: string;
}

export function buildPowerUseCardContext(input: PowerUseCardInput): PowerUseCardContext {
  const { power } = input;
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    powerName: power.name,
    scope: power.scope,
    params: power.params,
    atWill: power.per === "at-will",
    remaining: input.remaining,
    uses: input.uses ?? power.uses,
    perKey: `ADND2E.sheet.kits.per.${power.per}`,
  };
}
