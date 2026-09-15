/**
 * System Combat document — 2E initiative is ascending (lower total acts
 * first); Foundry's own default `_sortCombatants` is descending (high-first).
 * Combatants with no roll yet (`initiative` not a finite number) sort to the
 * END under ascending order too (mirrors core's `-Infinity`-for-descending
 * convention, inverted to `Infinity` here), so "hasn't gone yet" still reads
 * as "hasn't gone yet," not "always first."
 */
export class Adnd2eCombat extends Combat {
  override _sortCombatants(a: Combatant.Implementation, b: Combatant.Implementation): number {
    const ia = Number.isFinite(a.initiative as number) ? (a.initiative as number) : Infinity;
    const ib = Number.isFinite(b.initiative as number) ? (b.initiative as number) : Infinity;
    return ia - ib || (a.id! > b.id! ? 1 : -1);
  }
}
