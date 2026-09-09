import type { ActorType } from "../data/derive/effect-keys";
import { isDeferredChangeKey } from "../data/derive/effect-keys";

/** Foundry's own default: an unset `priority` falls back to `mode * 10`
 *  (MULTIPLY 10, ADD 20, DOWNGRADE 30, UPGRADE 40, OVERRIDE 50). Mirrors the
 *  global sort `applyActiveEffects` (`_prepareEffectChanges`) does in pass 1. */
function effectiveChangePriority(change: { priority?: number | null; mode?: number | null }): number {
  return change.priority ?? (change.mode ?? 0) * 10;
}

/**
 * System Actor document. Two responsibilities beyond the base class:
 *  - suppress an item-transferred ActiveEffect whose item is unequipped
 *    (`system.suppressWhenUnequipped` on the `adnd2e` effect subtype);
 *  - re-apply ActiveEffect changes that target a *derived* path AFTER
 *    `prepareDerivedData` computes those values (spec §5.6 two-pass).
 */
export class Adnd2eActor extends Actor {
  override *allApplicableEffects(): Generator<ActiveEffect.Implementation, void, void> {
    for (const effect of super.allApplicableEffects()) {
      if (this._effectSuppressed(effect)) continue;
      yield effect;
    }
  }

  /** True for an `adnd2e` effect on a physical item that is not equipped. */
  _effectSuppressed(effect: ActiveEffect.Implementation): boolean {
    const parent = effect.parent;
    return (
      !!(effect.system as { suppressWhenUnequipped?: boolean } | undefined)?.suppressWhenUnequipped &&
      parent instanceof Item &&
      ["weapon", "armor", "equipment"].includes(parent.type) &&
      !(parent.system as { equipped?: boolean }).equipped
    );
  }

  override prepareDerivedData(): void {
    super.prepareDerivedData(); // runs this.system.prepareDerivedData() — the derive+cache
    const actorType = this.type as ActorType;
    type Change = ActiveEffect.Implementation["changes"][number];
    const deferred: { change: Change; effect: ActiveEffect.Implementation }[] = [];
    for (const effect of this.allApplicableEffects()) {
      if (!effect.active) continue;
      for (const change of effect.changes) {
        if (change.key && isDeferredChangeKey(change.key, actorType)) deferred.push({ change, effect });
      }
    }
    deferred.sort((a, b) => effectiveChangePriority(a.change) - effectiveChangePriority(b.change));
    for (const { change, effect } of deferred) {
      const applied = effect.apply(this, change);
      this.overrides = foundry.utils.mergeObject(
        this.overrides ?? {},
        foundry.utils.expandObject(applied as Record<string, unknown>),
      );
    }
  }
}
