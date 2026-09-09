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
