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

export interface KitPower {
  id: string;
  name: string;
  /** 0 ⇔ at-will. */
  uses: number;
  per: PowerFrequency;
  scope: string;
  params: PowerParam[];
}

export type PowerUsage = Record<string, { used: number }>;

export interface RawPower {
  id?: unknown;
  name?: unknown;
  uses?: unknown;
  per?: unknown;
  scope?: unknown;
  params?: unknown;
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

/** Lenient read, like a malformed trait effect: a bad power is dropped (inert).
 *  Afterwards at-will ⇔ `per === "at-will"` ⇔ `uses === 0`. */
export function normalizePowers(raw: readonly RawPower[]): KitPower[] {
  const seen = new Set<string>();
  const out: KitPower[] = [];
  for (const p of raw) {
    if (typeof p.id !== "string" || !SLUG.test(p.id) || seen.has(p.id)) continue;
    if (typeof p.name !== "string" || p.name === "") continue;
    if (!(POWER_FREQUENCIES as readonly unknown[]).includes(p.per)) continue;
    seen.add(p.id);
    const finite = typeof p.uses === "number" && Number.isInteger(p.uses) && p.uses > 0;
    const atWill = !finite || p.per === "at-will";
    out.push({
      id: p.id,
      name: p.name,
      uses: atWill ? 0 : (p.uses as number),
      per: atWill ? "at-will" : (p.per as PowerFrequency),
      scope: typeof p.scope === "string" ? p.scope : "",
      params: normalizeParams(p.params),
    });
  }
  return out;
}

export function usedCount(usage: PowerUsage, kitId: string, powerId: string): number {
  const n = usage[powerKey(kitId, powerId)]?.used;
  return typeof n === "number" && n > 0 ? n : 0;
}

export function powerRemaining(power: KitPower, used: number): number | null {
  return power.per === "at-will" ? null : Math.max(0, power.uses - used);
}

export function canUsePower(power: KitPower, used: number): boolean {
  const remaining = powerRemaining(power, used);
  return remaining === null || remaining > 0;
}

/** The new `used` count after one use; at-will powers are never counted. */
export function spendPower(power: KitPower, used: number): number {
  return power.per === "at-will" || !canUsePower(power, used) ? used : used + 1;
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
}

export function buildPowerRows(kitId: string, powers: readonly KitPower[], usage: PowerUsage): PowerRow[] {
  return powers.map((p) => {
    const used = usedCount(usage, kitId, p.id);
    return {
      id: p.id,
      name: p.name,
      per: p.per,
      atWill: p.per === "at-will",
      uses: p.uses,
      used,
      remaining: powerRemaining(p, used),
      scope: p.scope,
      params: p.params,
      canUse: canUsePower(p, used),
      canReset: p.per !== "at-will" && used > 0,
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

/** Actor update that deletes every counter of a removed kit (Foundry's `-=` operator). */
export function usagePruneUpdate(usage: PowerUsage, kitId: string): Record<string, unknown> {
  const prefix = `${kitId}:`;
  return Object.fromEntries(
    Object.keys(usage)
      .filter((k) => k.startsWith(prefix))
      .map((k) => [`system.kitPowers.-=${k}`, null]),
  );
}

export interface PowerUseCardInput {
  actorName: string;
  actorImg: string;
  power: KitPower;
  /** Remaining uses AFTER this use; null for at-will. */
  remaining: number | null;
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
    uses: power.uses,
    perKey: `ADND2E.sheet.kits.per.${power.per}`,
  };
}
