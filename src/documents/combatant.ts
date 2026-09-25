import { initiativeFormula } from "../core/dice/formula";
import { initiativeModifiers } from "../core/combat/initiative";
import { expandedCastingTimeEnabled } from "../core/magic/casting-time";
import { getOptionalRules } from "../settings";
import { SYSTEM_ID } from "../constants";

/**
 * System Combatant document — individual initiative (PHB Table 3 DEX reaction
 * adjustment, always; weapon speed factor when the `weaponSpeedInitiative`
 * optional rule is on) instead of the manifest's bare `1d10`.
 */
export class Adnd2eCombatant extends Combatant {
  override _getInitiativeFormula(): string {
    const actor = this.actor as unknown as {
      type: string;
      system: { abilities?: { dex?: { mods?: { reactionAdj?: number } } } };
      items: Iterable<{ type: string; system: { equipped?: boolean; speedFactor?: number } }>;
    } | null;
    if (!actor || (actor.type !== "character" && actor.type !== "npc")) {
      // Creatures don't have a DEX-mods/weapon-item combat profile yet (SP6) —
      // fall back to the bare system default rather than guessing.
      return super._getInitiativeFormula();
    }

    const reactionAdj = actor.system.abilities?.dex?.mods?.reactionAdj ?? 0;

    const rules = getOptionalRules();
    let weaponSpeedFactor = 0;
    if (rules.weaponSpeedInitiative) {
      const equippedWeapon = [...actor.items].find((i) => i.type === "weapon" && i.system.equipped);
      weaponSpeedFactor = equippedWeapon?.system.speedFactor ?? 0;
    }

    const getFlag = (key: string) =>
      (this as unknown as { getFlag(scope: string, key: string): unknown }).getFlag(SYSTEM_ID, key);
    // SP9a: a segment spell begun before this round's roll adds its casting time here (PHB p.95).
    const castingSegments = expandedCastingTimeEnabled(rules) ? Number(getFlag("castingSegments") ?? 0) : 0;
    const situationalModifier = Number(getFlag("initiativeModifier") ?? 0) + castingSegments;

    const { total } = initiativeModifiers({ weaponSpeedFactor, reactionAdj, situationalModifier });
    return initiativeFormula(total);
  }
}
