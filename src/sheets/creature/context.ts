import type { CreatureSheetContext, CreatureSheetInput, CreatureSpellView } from "./context-types";
import type { SaveCategory } from "../../core/types";
import { monsterWeaponAttackType, monsterWeaponDamageLabel } from "../../combat/monster-gear";

const SAVE_CATEGORIES: readonly SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];
const MOVEMENT_LABELS: Record<"burrow" | "climb" | "fly" | "swim", string> = {
  burrow: "burrow", climb: "climb", fly: "fly", swim: "swim",
};

/** "12, climb 3, fly 18 (C)" — land is always shown first (unlabeled, even if 0),
 *  every other mode is omitted when it's 0. `flyManeuverability` (a bare class
 *  letter/number like "C") is appended in parens only when fly > 0. */
function buildMovementSummary(m: CreatureSheetInput["attributes"]["movement"]): string {
  const parts = [String(m.land)];
  for (const mode of ["burrow", "climb", "fly", "swim"] as const) {
    const value = m[mode];
    if (value <= 0) continue;
    const suffix = mode === "fly" && m.flyManeuverability ? ` (${m.flyManeuverability})` : "";
    parts.push(`${MOVEMENT_LABELS[mode]} ${value}${suffix}`);
  }
  return parts.join(", ");
}

function buildSpellGroups(spells: readonly CreatureSpellView[]): CreatureSheetContext["spells"] {
  const levels = [...new Set(spells.map((s) => s.level))].sort((a, b) => a - b);
  return levels.map((level) => ({
    level,
    items: spells.filter((s) => s.level === level).map((s) => ({ id: s.id, name: s.name, img: s.img })),
  }));
}

/** Pure sheet-context builder for the `creature` actor type — mirrors the
 *  established `buildCharacterSheetContext` pattern (thin, section-by-section,
 *  no Foundry calls) but is a wholly separate function, since CreatureModel's
 *  schema shares nothing with CharacterModel's. */
export function buildCreatureSheetContext(input: CreatureSheetInput): CreatureSheetContext {
  return {
    identity: {
      name: input.name,
      img: input.img,
    },
    vitals: {
      hp: { ...input.attributes.hp },
      ac: input.attributes.ac.value,
      thac0: input.attributes.thac0.value,
      movementSummary: buildMovementSummary(input.attributes.movement),
    },
    attacks: input.attacks.map((a, index) => ({
      index, name: a.name, count: a.count, damage: a.damage, type: a.type, special: a.special,
    })),
    saves: SAVE_CATEGORIES.map((category) => ({
      category,
      label: `ADND2E.saves.${category}`,
      target: input.saves.effective[category],
    })),
    details: {
      size: input.details.size,
      alignment: input.details.alignment,
      intelligence: input.details.intelligence,
      morale: input.details.morale,
      magicResistance: input.details.magicResistance,
      treasureType: input.details.treasureType,
      numberAppearing: input.details.numberAppearing,
      xpValue: input.details.xpValue,
      specialAttacks: input.details.specialAttacks,
      specialDefenses: input.details.specialDefenses,
      description: input.details.description,
    },
    perms: { ...input.perms },
    gear: (input.gear ?? []).map((g) => ({
      id: g.id, name: g.name, img: g.img, type: g.type, quantity: g.quantity, equipped: g.equipped,
    })),
    weaponAttacks: (input.gear ?? [])
      .filter((g) => g.type === "weapon" && g.equipped && g.weapon)
      .map((g) => ({
        id: g.id,
        name: g.name,
        damage: monsterWeaponDamageLabel(g.weapon!),
        type: monsterWeaponAttackType(g.weapon!.category),
      })),
    spells: buildSpellGroups(input.spells ?? []),
  };
}
