// The status conditions the system ships (SP1). Each is also an ActiveEffect
// document in the `conditions` compendium; the two are drift-tested. Per-condition
// mechanical `changes` are SP3 / SP7 — this file and the pack carry id / name /
// icon only. No Foundry import — pure data.

export interface Condition {
  id: string;
  name: string;
  img: string;
}

export const CONDITIONS: readonly Condition[] = [
  { id: "blinded", name: "Blinded", img: "icons/svg/blind.svg" },
  { id: "deafened", name: "Deafened", img: "icons/svg/deaf.svg" },
  { id: "prone", name: "Prone", img: "icons/svg/falling.svg" },
  { id: "stunned", name: "Stunned", img: "icons/svg/daze.svg" },
  { id: "unconscious", name: "Unconscious", img: "icons/svg/unconscious.svg" },
  { id: "paralyzed", name: "Paralyzed", img: "icons/svg/paralysis.svg" },
  { id: "poisoned", name: "Poisoned", img: "icons/svg/poison.svg" },
  { id: "held", name: "Held", img: "icons/svg/net.svg" },
  { id: "entangled", name: "Entangled", img: "icons/svg/net.svg" },
  { id: "invisible", name: "Invisible", img: "icons/svg/invisible.svg" },
  { id: "sleeping", name: "Sleeping", img: "icons/svg/sleep.svg" },
  { id: "charmed", name: "Charmed", img: "icons/svg/terror.svg" },
  { id: "frightened", name: "Frightened", img: "icons/svg/terror.svg" },
  { id: "incapacitated", name: "Incapacitated", img: "icons/svg/downgrade.svg" },
  { id: "dead", name: "Dead", img: "icons/svg/skull.svg" },
];

/** The exact shape a CONFIG.statusEffects entry needs (real v14.364 fields:
 *  id/name/img/hud always read; `type` is a legal ActiveEffectData field that
 *  Actor#toggleStatusEffect/ActiveEffect.fromStatusEffect deep-clone through,
 *  so setting it here makes a Token HUD toggle create a real `adnd2e`-subtype
 *  ActiveEffect with these `system` defaults — no extra wiring needed). */
export interface StatusEffectConfig {
  id: string;
  name: string;
  img: string;
  type: "adnd2e";
  hud: boolean;
  system: { conditionId: string; isCondition: true; suppressWhenUnequipped: false; schoolTag: null };
}

export function buildStatusEffects(): readonly StatusEffectConfig[] {
  return CONDITIONS.map((c) => ({
    id: c.id,
    name: c.name,
    img: c.img,
    type: "adnd2e" as const,
    hud: true,
    system: { conditionId: c.id, isCondition: true as const, suppressWhenUnequipped: false as const, schoolTag: null },
  }));
}
