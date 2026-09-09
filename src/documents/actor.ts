import { isDeferredChangeKey } from "../data/derive/effect-keys";

type ActorType = "character" | "npc" | "creature";

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
    for (const effect of this.allApplicableEffects()) {
      if (!effect.active) continue;
      for (const change of effect.changes) {
        if (!change.key || !isDeferredChangeKey(change.key, actorType)) continue;
        const applied = effect.apply(this, change);
        this.overrides = foundry.utils.mergeObject(
          this.overrides ?? {},
          foundry.utils.expandObject(applied as Record<string, unknown>),
        );
      }
    }
  }
}
