// Thin adapter — local-interface casts stand in until the Item/Actor DataModels
// carry named Schema types (deferred; Ruling S2). Not unit-tested (spec §9) —
// dev-world verified. All logic lives in deriveCharacter.
import type {
  ActorSnapshot, ClassEntry, DualClassState, EquippedArmor, EquippedShield, MemorizedEntry,
} from "../derive/character";
import type { ClassId, Race, ThiefSkill, WizardSchool } from "../../core/types";
import { toTraitEntries } from "../derive/character";
import { containerAdjustedCarriedWeight } from "../derive/character/container-weight";

interface ClassItemSystem {
  chassisId: ClassId;
  specialistSchool: WizardSchool | null;
  xp: number;
  hpRolls: readonly number[];
  dualClassState: DualClassState | null;
  level?: number;
}
interface RaceItemSystem {
  raceId: Race;
  baseMovement?: number;
}
interface ArmorItemSystem {
  isShield: boolean;
  equipped: boolean;
  baseAc: number;
  shieldAcBonus: number;
  magicBonus: number;
}
interface ProfItemSystem {
  slotsInvested: number;
}
interface SpellcastingSystem {
  wizard: { memorized: readonly MemorizedEntry[] };
  priest: { memorized: readonly MemorizedEntry[] };
}
interface ThiefSkillsSystem {
  allocations: readonly { skill: ThiefSkill; allocatedPoints: number }[];
}

export function snapshotActor(actor: Actor.Implementation): ActorSnapshot {
  // Ruling S2 shim — named actor Schema types land in Plan 1c.3b; until then the
  // Foundry Actor's `system` is `UnknownSystem`. Task 5 hardens the walk below.
  const doc = actor as unknown as {
    system: {
      abilities: Record<string, { score: number; exceptional: number | null }>;
      spellcasting: SpellcastingSystem;
      thiefSkills: ThiefSkillsSystem;
      options?: { spellsAndMagic?: { casting?: unknown } };
    };
    items: Iterable<{ id: string; type: string; system: unknown }>;
  };
  const items = [...doc.items];
  const raceItem = items.find((i) => i.type === "race");

  const classes: ClassEntry[] = items
    .filter((i) => i.type === "class")
    .map((i) => {
      const s = i.system as ClassItemSystem;
      return {
        chassisId: s.chassisId,
        specialistSchool: s.specialistSchool,
        xp: s.xp,
        hpRolls: s.hpRolls,
        dualClassState: s.dualClassState,
        level: s.level ?? 1,
      };
    });

  const armorItems = items.filter((i) => i.type === "armor").map((i) => i.system as ArmorItemSystem);
  const bodyArmor = armorItems.find((a) => !a.isShield && a.equipped) ?? null;
  const shield = armorItems.find((a) => a.isShield && a.equipped) ?? null;
  const equippedArmor: EquippedArmor | null = bodyArmor
    ? { baseArmorAc: bodyArmor.baseAc, magicBonus: bodyArmor.magicBonus }
    : null;
  const equippedShield: EquippedShield | null = shield
    ? { shieldBonus: shield.shieldAcBonus, magicBonus: shield.magicBonus }
    : null;

  const carriedWeight = containerAdjustedCarriedWeight(
    items.map((i) => {
      const s = i.system as {
        totalWeight?: number; location?: string; container?: boolean; contentsWeightMultiplier?: number;
      };
      return {
        id: (i as { id: string }).id,
        type: i.type,
        totalWeight: s.totalWeight ?? 0,
        location: s.location ?? "",
        isContainer: s.container ?? false,
        contentsWeightMultiplier: s.contentsWeightMultiplier ?? 1,
      };
    }),
  );

  const spentWeaponSlots = items
    .filter((i) => i.type === "weaponProficiency")
    .reduce((s, i) => s + (i.system as ProfItemSystem).slotsInvested, 0);
  const spentNonweaponSlots = items
    .filter((i) => i.type === "nonweaponProficiency")
    .reduce((s, i) => s + (i.system as ProfItemSystem).slotsInvested, 0);

  const wizardMemorized: MemorizedEntry[] = [...doc.system.spellcasting.wizard.memorized];
  const priestMemorized: MemorizedEntry[] = [...doc.system.spellcasting.priest.memorized];
  const thiefSkillAllocations = [...doc.system.thiefSkills.allocations];

  const a = doc.system.abilities;
  return {
    abilities: {
      str: a.str.score, dex: a.dex.score, con: a.con.score,
      int: a.int.score, wis: a.wis.score, cha: a.cha.score,
    },
    exceptionalStrengthPercentile: a.str.exceptional,
    race: raceItem ? (raceItem.system as RaceItemSystem).raceId : null,
    classes,
    equippedArmor,
    equippedShield,
    carriedWeight,
    wizardMemorized,
    priestMemorized,
    spentWeaponSlots,
    spentNonweaponSlots,
    baseMovement: raceItem ? ((raceItem.system as RaceItemSystem).baseMovement ?? 12) : 12,
    thiefSkillAllocations,
    traits: toTraitEntries(items),
    isCasting: Boolean(doc.system.options?.spellsAndMagic?.casting),
  };
}
