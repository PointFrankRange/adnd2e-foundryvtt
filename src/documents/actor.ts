import type { ActorType } from "../data/derive/effect-keys";
import { isDeferredChangeKey } from "../data/derive/effect-keys";

/** Foundry's own default: an unset `priority` falls back to `mode * 10`
 *  (MULTIPLY 10, ADD 20, DOWNGRADE 30, UPGRADE 40, OVERRIDE 50). Mirrors the
 *  global sort `applyActiveEffects` (`_prepareEffectChanges`) does in pass 1. */
function effectiveChangePriority(change: { priority?: number | null; mode?: number | null }): number {
  return change.priority ?? (change.mode ?? 0) * 10;
}

/** The running Foundry major version (`13`, `14`, …). fvtt-types (v13-beta) does
 *  not type `game.release`; it exists at runtime. Ruling S2. */
function foundryGeneration(): number {
  return (game as unknown as { release?: { generation?: number } }).release?.generation ?? 13;
}

/**
 * System Actor document. Its extra behaviour is version-dependent:
 *  - **v14+**: Foundry natively applies `phase: "final"` ActiveEffect changes via
 *    `applyActiveEffects("final")` after `prepareDerivedData`, and the
 *    `Adnd2eActiveEffectModel.isSuppressed` model hook handles
 *    `suppressWhenUnequipped`. Nothing to do here — both overrides no-op.
 *  - **v13**: no change `phase`, so `prepareDerivedData` runs a manual second
 *    pass that re-applies derived-targeting changes after the derive step, and
 *    `applyActiveEffects` is reconstructed to skip those same keys in the single
 *    pre-derive pass so they are not double-applied. This branch is
 *    code-review-only (no v13 world to test against) — Ruling FR-3.
 */
export class Adnd2eActor extends Actor {
  override prepareDerivedData(): void {
    super.prepareDerivedData(); // no-op on the document; the system model already ran
    // v14+ applies phase:"final" ActiveEffect changes natively after this hook.
    // On v13 there is no phase, so re-apply derived-targeting changes here.
    if (foundryGeneration() >= 14) return;

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

  /**
   * v14: delegate to the native phase-filtered implementation unchanged.
   * v13: reconstruct Foundry's single-pass algorithm, minus the
   * derived-targeting changes (the manual second pass in `prepareDerivedData`
   * owns those). Ruling FR-3 — the v13 arm is untested.
   */
  override applyActiveEffects(...args: unknown[]): void {
    if (foundryGeneration() >= 14) {
      (Actor.prototype.applyActiveEffects as (...a: unknown[]) => void).apply(this, args);
      return;
    }
    const actorType = this.type as ActorType;
    const overrides: Record<string, unknown> = {};
    (this as unknown as { statuses: Set<string> }).statuses = new Set();
    const changes: {
      key: string;
      mode?: number;
      value?: unknown;
      priority: number;
      effect: ActiveEffect.Implementation;
    }[] = [];
    for (const effect of this.allApplicableEffects()) {
      if (!effect.active) continue;
      for (const change of effect.changes) {
        if (!change.key || isDeferredChangeKey(change.key, actorType)) continue;
        changes.push({ ...change, effect, priority: effectiveChangePriority(change) });
      }
      for (const status of effect.statuses) (this as unknown as { statuses: Set<string> }).statuses.add(status);
    }
    changes.sort((a, b) => a.priority - b.priority);
    for (const change of changes) {
      const applied = change.effect.apply(this, change as never);
      Object.assign(overrides, applied);
    }
    this.overrides = foundry.utils.expandObject(overrides) as typeof this.overrides;
  }
}
