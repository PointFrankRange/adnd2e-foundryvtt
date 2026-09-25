import { describe, expect, it } from "vitest";
import enJson from "../../lang/en.json";
import { buildAdnd2eConfig } from "../../src/config";
import { SUB_ABILITIES } from "../../src/core/abilities/sub-abilities";
import { SETTING_DESCRIPTORS } from "../../src/settings/registry";
import { ACTOR_SUBTYPES } from "../../src/data/actor/subtypes";
import { ITEM_SUBTYPES } from "../../src/data/item/subtypes";
import { ACTIVE_EFFECT_SUBTYPES } from "../../src/data/active-effect/subtypes";

const en = enJson as unknown as Record<string, unknown>;

/** Resolve a dotted i18n key against the nested lang object. */
function resolve(key: string): unknown {
  return key.split(".").reduce<unknown>((node, seg) => {
    if (node && typeof node === "object" && seg in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[seg];
    }
    return undefined;
  }, en);
}

/** Every string value reachable from buildAdnd2eConfig() that looks like an i18n key. */
function configLabelKeys(): string[] {
  const cfg = buildAdnd2eConfig() as unknown as Record<string, Record<string, unknown>>;
  const keys: string[] = [];
  for (const entry of Object.values(cfg)) {
    for (const v of Object.values(entry)) {
      if (typeof v === "string" && v.startsWith("ADND2E.")) keys.push(v);
      else if (v && typeof v === "object" && "label" in v) keys.push((v as { label: string }).label);
    }
  }
  return keys;
}

describe("lang/en.json coverage", () => {
  it("resolves every CONFIG.ADND2E label key to a string", () => {
    for (const key of configLabelKeys()) {
      expect(typeof resolve(key), key).toBe("string");
    }
  });

  it("resolves name + hint for every registered setting", () => {
    for (const d of SETTING_DESCRIPTORS) {
      expect(typeof resolve(`ADND2E.settings.${d.key}.name`), d.key).toBe("string");
      expect(typeof resolve(`ADND2E.settings.${d.key}.hint`), d.key).toBe("string");
    }
  });

  it("no longer references the deleted example app", () => {
    expect(JSON.stringify(en)).not.toContain("exampleApp");
    expect(JSON.stringify(en)).not.toContain("exampleSetting");
  });
});

describe("lang/en.json TYPES", () => {
  const types = (en as { TYPES?: { Actor?: object; Item?: object; ActiveEffect?: object } }).TYPES ?? {};

  it("TYPES.Actor keys == ACTOR_SUBTYPES", () => {
    expect(Object.keys(types.Actor ?? {}).sort()).toEqual([...ACTOR_SUBTYPES].sort());
  });
  it("TYPES.Item keys == ITEM_SUBTYPES", () => {
    expect(Object.keys(types.Item ?? {}).sort()).toEqual([...ITEM_SUBTYPES].sort());
  });
  it("TYPES.ActiveEffect keys == ACTIVE_EFFECT_SUBTYPES", () => {
    expect(Object.keys(types.ActiveEffect ?? {}).sort()).toEqual([...ACTIVE_EFFECT_SUBTYPES].sort());
  });
  it("every TYPES value is a non-empty string", () => {
    for (const group of Object.values(types)) {
      for (const [k, v] of Object.entries(group as Record<string, unknown>)) {
        expect(typeof v, k).toBe("string");
        expect((v as string).length, k).toBeGreaterThan(0);
      }
    }
  });
});

describe("lang/en.json — sheet strings", () => {
  it("resolves every sheet label + message the sheet layer references", () => {
    for (const key of [
      "ADND2E.sheets.rawActor",
      "ADND2E.sheets.rawItem",
      "ADND2E.sheets.rawEffect",
      "ADND2E.sheets.badJson",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP2 sheet strings", () => {
  it("resolves every ADND2E.sheet.* key the character sheet layer references", () => {
    for (const key of [
      "ADND2E.sheet.title",
      "ADND2E.sheet.namePlaceholder",
      "ADND2E.sheet.tabs.main",
      "ADND2E.sheet.tabs.combat",
      "ADND2E.sheet.tabs.inventory",
      "ADND2E.sheet.tabs.skills",
      "ADND2E.sheet.tabs.spells",
      "ADND2E.sheet.tabs.features",
      "ADND2E.sheet.tabs.biography",
      "ADND2E.sheet.vitals.hp",
      "ADND2E.sheet.vitals.ac",
      "ADND2E.sheet.vitals.thac0",
      "ADND2E.sheet.vitals.saves",
      "ADND2E.sheet.vitals.movement",
      "ADND2E.sheet.drop.duplicateRace",
      "ADND2E.sheet.drop.duplicateClass",
      "ADND2E.sheet.xp.rollHp",
      "ADND2E.sheet.xp.award",
      "ADND2E.sheet.xp.awardPrompt",
      "ADND2E.sheet.xp.takeAverage",
      "ADND2E.sheet.xp.hpRollFlavor",
      "ADND2E.sheet.xp.hpAverageFlavor",
      "ADND2E.sheet.dualClass.toggle",
      "ADND2E.sheet.dualClass.clear",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP2 Task 6 sheet strings (Combat/Inventory/Features/Biography)", () => {
  it("resolves every ADND2E.sheet.* key the Combat/Inventory/Features/Biography tabs reference", () => {
    for (const key of [
      "ADND2E.sheet.combat.weapons",
      "ADND2E.sheet.combat.armor",
      "ADND2E.sheet.combat.acBreakdown",
      "ADND2E.sheet.combat.acBase",
      "ADND2E.sheet.combat.acShield",
      "ADND2E.sheet.combat.acMagic",
      "ADND2E.sheet.combat.acDex",
      "ADND2E.sheet.combat.equipped",
      "ADND2E.sheet.combat.notEquipped",
      "ADND2E.sheet.combat.shield",
      "ADND2E.sheet.combat.noWeapons",
      "ADND2E.sheet.combat.noArmor",
      "ADND2E.sheet.combat.speedFactor",
      "ADND2E.sheet.details.age",
      "ADND2E.sheet.details.sex",
      "ADND2E.sheet.details.height",
      "ADND2E.sheet.details.weight",
      "ADND2E.sheet.details.hairEyes",
      "ADND2E.sheet.details.homeland",
      "ADND2E.sheet.details.deity",
      "ADND2E.sheet.details.kit",
      "ADND2E.sheet.inventory.empty",
      "ADND2E.sheet.inventory.equipped",
      "ADND2E.sheet.inventory.identified",
      "ADND2E.sheet.inventory.quantity",
      "ADND2E.sheet.inventory.weight",
      "ADND2E.sheet.inventory.location",
      "ADND2E.sheet.inventory.magicBonus",
      "ADND2E.sheet.inventory.carried",
      "ADND2E.sheet.inventory.category",
      "ADND2E.sheet.inventory.penaltyAttack",
      "ADND2E.sheet.inventory.penaltyAc",
      "ADND2E.sheet.features.none",
      "ADND2E.sheet.features.sourceTypes.class",
      "ADND2E.sheet.features.sourceTypes.kit",
      "ADND2E.sheet.features.sourceTypes.race",
      "ADND2E.sheet.features.sourceTypes.other",
      "ADND2E.sheet.features.reputation",
      "ADND2E.sheet.features.henchmen",
      "ADND2E.sheet.features.followers",
      "ADND2E.sheet.features.languagesHint",
      "ADND2E.sheet.biography.notes",
      "ADND2E.sheet.biography.campaignNotes",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP2 Task 7 sheet strings (Skills/Spells)", () => {
  it("resolves every ADND2E.sheet.* key the Skills/Spells tab shells reference", () => {
    for (const key of [
      "ADND2E.sheet.skills.group",
      "ADND2E.sheet.skills.masteryTier.1",
      "ADND2E.sheet.skills.masteryTier.2",
      "ADND2E.sheet.skills.masteryTier.3",
      "ADND2E.sheet.skills.racial",
      "ADND2E.sheet.skills.none",
      "ADND2E.sheet.spells.level",
      "ADND2E.sheet.spells.slotLevel",
      "ADND2E.sheet.spells.slotsMax",
      "ADND2E.sheet.spells.slotsUsed",
      "ADND2E.sheet.spells.none",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP3 chat/combat strings", () => {
  it("resolves every ADND2E.sheet.combat.{rollAttack,rollSave} + ADND2E.chat.* key the combat-roll layer references", () => {
    for (const key of [
      "ADND2E.sheet.combat.rollAttack",
      "ADND2E.sheet.combat.rollSave",
      "ADND2E.chat.attack.rollAttack",
      "ADND2E.chat.attack.manualAcTitle",
      "ADND2E.chat.attack.noTargetHint",
      "ADND2E.chat.attack.multiTargetHint",
      "ADND2E.chat.attack.hit",
      "ADND2E.chat.attack.miss",
      "ADND2E.chat.attack.autoHit",
      "ADND2E.chat.attack.autoMiss",
      "ADND2E.chat.attack.modStrength",
      "ADND2E.chat.attack.modDexMissile",
      "ADND2E.chat.attack.modWeaponMagic",
      "ADND2E.chat.attack.modProficiency",
      "ADND2E.chat.attack.modRange",
      "ADND2E.chat.attack.modSituational",
      "ADND2E.chat.attack.rollDamage",
      "ADND2E.chat.attack.cannotActWarning",
      "ADND2E.chat.attack.crit.solid",
      "ADND2E.chat.attack.crit.devastating",
      "ADND2E.chat.attack.crit.brutal",
      "ADND2E.chat.attack.fumble.miss",
      "ADND2E.chat.attack.fumble.weaponDrops",
      "ADND2E.chat.attack.fumble.selfInjury",
      "ADND2E.chat.attack.fumbleSelfInjury",
      "ADND2E.chat.attack.critApplied",
      "ADND2E.sheet.combat.maneuverNone",
      "ADND2E.sheet.combat.maneuver.calledShotHead",
      "ADND2E.sheet.combat.maneuver.calledShotHand",
      "ADND2E.sheet.combat.maneuver.calledShotLeg",
      "ADND2E.sheet.combat.maneuver.disarm",
      "ADND2E.sheet.combat.maneuver.tripKnockDown",
      "ADND2E.sheet.combat.maneuver.grapple",
      "ADND2E.sheet.combat.maneuver.bullRush",
      "ADND2E.chat.attack.maneuverLabel.calledShotHead",
      "ADND2E.chat.attack.maneuverLabel.calledShotHand",
      "ADND2E.chat.attack.maneuverLabel.calledShotLeg",
      "ADND2E.chat.attack.maneuverLabel.disarm",
      "ADND2E.chat.attack.maneuverLabel.tripKnockDown",
      "ADND2E.chat.attack.maneuverLabel.grapple",
      "ADND2E.chat.attack.maneuverLabel.bullRush",
      "ADND2E.chat.damage.applyToTargets",
      "ADND2E.chat.damage.noTargetsWarning",
      "ADND2E.chat.damage.notOwnerWarning",
      "ADND2E.chat.damage.sourceNotFoundWarning",
      "ADND2E.chat.save.success",
      "ADND2E.chat.save.failure",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP4a spell memorize/cast strings", () => {
  it("resolves every ADND2E.sheet.spells.{memorize,forget,cast,rest,expended} + ADND2E.chat.cast.* key the spell-actions layer references", () => {
    for (const key of [
      "ADND2E.sheet.spells.memorize",
      "ADND2E.sheet.spells.forget",
      "ADND2E.sheet.spells.cast",
      "ADND2E.sheet.spells.rest",
      "ADND2E.sheet.spells.expended",
      "ADND2E.sheet.spells.memorizeBlockedWarning",
      "ADND2E.sheet.spells.castBlockedWarning",
      "ADND2E.sheet.spells.castRollFailedWarning",
      "ADND2E.sheet.spells.orphaned",
      "ADND2E.sheet.spells.orphanedEntry",
      "ADND2E.chat.cast.range",
      "ADND2E.chat.cast.duration",
      "ADND2E.chat.cast.castingTime",
      "ADND2E.chat.cast.savingThrow",
      "ADND2E.chat.cast.damageRoll",
      "ADND2E.chat.cast.healingRoll",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP4b learn-spell strings", () => {
  it("resolves every ADND2E.sheet.spells.{learn,learnBlockedWarning} + ADND2E.chat.learnSpell.* key the learn-spell layer references", () => {
    for (const key of [
      "ADND2E.sheet.spells.learn",
      "ADND2E.sheet.spells.learnBlockedWarning",
      "ADND2E.chat.learnSpell.chance",
      "ADND2E.chat.learnSpell.success",
      "ADND2E.chat.learnSpell.failure",
      "ADND2E.chat.learnSpell.rejection.intTooLow",
      "ADND2E.chat.learnSpell.rejection.spellLevelExceedsInt",
      "ADND2E.chat.learnSpell.rejection.oppositionSchool",
      "ADND2E.chat.learnSpell.rejection.perLevelCapReached",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP5a proficiency strings", () => {
  it("resolves every ADND2E.sheet.skills.{advanceMastery,check,advanceMasteryBlockedWarning,checkBlockedWarning} + ADND2E.sheet.drop.insufficientSlots + ADND2E.chat.nwpCheck.* key the proficiency-actions layer references", () => {
    for (const key of [
      "ADND2E.sheet.skills.advanceMastery",
      "ADND2E.sheet.skills.check",
      "ADND2E.sheet.skills.advanceMasteryBlockedWarning",
      "ADND2E.sheet.skills.checkBlockedWarning",
      "ADND2E.sheet.drop.insufficientSlots",
      "ADND2E.chat.nwpCheck.success",
      "ADND2E.chat.nwpCheck.failure",
      "ADND2E.chat.nwpCheck.autoFail",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP5b thief/bard-skill + backstab strings", () => {
  it("resolves every ADND2E.sheet.skills.thief* + ADND2E.sheet.combat.backstab* + ADND2E.chat.thiefSkill.* + ADND2E.chat.attack.backstabHit key the proficiency-actions/combat-rolls layer references", () => {
    for (const key of [
      "ADND2E.sheet.skills.thief",
      "ADND2E.sheet.skills.thiefArmorDisabled",
      "ADND2E.sheet.skills.thiefAllocateBlockedWarning",
      "ADND2E.sheet.skills.thiefArmorDisabledWarning",
      "ADND2E.sheet.skills.thiefSkillNotUsableWarning",
      "ADND2E.sheet.skills.notUsableYet",
      "ADND2E.sheet.combat.backstab",
      "ADND2E.sheet.combat.backstabApplied",
      "ADND2E.chat.attack.backstabHit",
      "ADND2E.chat.thiefSkill.success",
      "ADND2E.chat.thiefSkill.failure",
      "ADND2E.chat.thiefSkill.skills.pick-pockets",
      "ADND2E.chat.thiefSkill.skills.open-locks",
      "ADND2E.chat.thiefSkill.skills.find-remove-traps",
      "ADND2E.chat.thiefSkill.skills.move-silently",
      "ADND2E.chat.thiefSkill.skills.hide-in-shadows",
      "ADND2E.chat.thiefSkill.skills.detect-noise",
      "ADND2E.chat.thiefSkill.skills.climb-walls",
      "ADND2E.chat.thiefSkill.skills.read-languages",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP6 creature damage-roll flavor", () => {
  it("resolves ADND2E.chat.creature.damageFlavor", () => {
    const resolved = resolve("ADND2E.chat.creature.damageFlavor");
    expect(typeof resolved).toBe("string");
    expect((resolved as string).length).toBeGreaterThan(0);
  });
});

describe("lang/en.json — SP6 creature sheet strings", () => {
  it("resolves ADND2E.sheet.creatureTitle and every ADND2E.sheet.creature.* key", () => {
    for (const key of [
      "ADND2E.sheet.creatureTitle",
      "ADND2E.sheet.vitals.effective",
      "ADND2E.sheet.creature.hd",
      "ADND2E.sheet.creature.hdBonus",
      "ADND2E.sheet.creature.fixedHp",
      "ADND2E.sheet.creature.thac0AsFighterLevel",
      "ADND2E.sheet.creature.intelligence",
      "ADND2E.sheet.creature.attacks",
      "ADND2E.sheet.creature.noAttacks",
      "ADND2E.sheet.creature.attackName",
      "ADND2E.sheet.creature.attackCount",
      "ADND2E.sheet.creature.attackDamage",
      "ADND2E.sheet.creature.attackType",
      "ADND2E.sheet.creature.attackSpecial",
      "ADND2E.sheet.creature.attackThac0Override",
      "ADND2E.sheet.creature.addAttack",
      "ADND2E.sheet.creature.deleteAttack",
      "ADND2E.sheet.creature.savesAuthoring",
      "ADND2E.sheet.creature.saveMode",
      "ADND2E.sheet.creature.saveClassGroup",
      "ADND2E.sheet.creature.saveClassLevel",
      "ADND2E.sheet.creature.flyManeuverability",
      "ADND2E.sheet.creature.morale",
      "ADND2E.sheet.creature.magicResistance",
      "ADND2E.sheet.creature.treasureType",
      "ADND2E.sheet.creature.numberAppearing",
      "ADND2E.sheet.creature.xpValue",
      "ADND2E.sheet.creature.specialAttacks",
      "ADND2E.sheet.creature.specialDefenses",
      "ADND2E.sheet.creature.description",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP6 NPC sheet title", () => {
  it("resolves ADND2E.sheet.npcTitle", () => {
    const resolved = resolve("ADND2E.sheet.npcTitle");
    expect(typeof resolved).toBe("string");
    expect((resolved as string).length).toBeGreaterThan(0);
  });
});

describe("lang/en.json — SP6 NPC panel fields (whole-branch fix I3)", () => {
  it("resolves every ADND2E.sheet.npc.* key", () => {
    for (const key of [
      "ADND2E.sheet.npc.morale",
      "ADND2E.sheet.npc.xpValue",
      "ADND2E.sheet.npc.disposition",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP7a initiative-modifier Combat Tracker UI strings", () => {
  it("resolves every ADND2E.combat.initiativeModifier.* key", () => {
    for (const key of [
      "ADND2E.combat.initiativeModifier.title",
      "ADND2E.combat.initiativeModifier.hint",
      "ADND2E.combat.initiativeModifier.set",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — migration + import strings", () => {
  it("resolves every migration + import key the runtime references", () => {
    for (const key of [
      "ADND2E.migration.migrated",
      "ADND2E.migration.dryRunComplete",
      "ADND2E.migration.failed",
      "ADND2E.migration.dryRunSetting.name",
      "ADND2E.migration.dryRunSetting.hint",
      "ADND2E.import.done",
      "ADND2E.import.doneWithFailures",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP8a sub-ability strings", () => {
  it("has a non-empty label for every sub-ability in SUB_ABILITIES", () => {
    for (const ids of Object.values(SUB_ABILITIES)) {
      for (const id of ids) {
        const key = `ADND2E.sheet.subAbilities.${id}`;
        expect(typeof resolve(key), key).toBe("string");
        expect((resolve(key) as string).length, key).toBeGreaterThan(0);
      }
    }
  });

  it("has the seed / main-locked / blocked strings", () => {
    for (const leaf of ["seed", "mainLocked", "seedBlockedWarning"]) {
      const key = `ADND2E.sheet.subAbilities.${leaf}`;
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP8 Plan 8c trait strings", () => {
  it("resolves every ADND2E.sheet.traits.* and trait drop key the sheet layer references", () => {
    for (const key of [
      "ADND2E.sheet.drop.duplicateTrait",
      "ADND2E.sheet.drop.insufficientCp",
      "ADND2E.sheet.drop.traitsDisabled",
      "ADND2E.sheet.drop.traitsPcOnly",
      "ADND2E.sheet.traits.title",
      "ADND2E.sheet.traits.pool",
      "ADND2E.sheet.traits.poolGmOnly",
      "ADND2E.sheet.traits.spent",
      "ADND2E.sheet.traits.available",
      "ADND2E.sheet.traits.overspent",
      "ADND2E.sheet.traits.refundCapped",
      "ADND2E.sheet.traits.refundCappedToast",
      "ADND2E.sheet.traits.none",
      "ADND2E.sheet.traits.remove",
      "ADND2E.sheet.traits.removeBlockedWarning",
      "ADND2E.sheet.traits.mode.melee",
      "ADND2E.sheet.traits.mode.ranged",
      "ADND2E.sheet.traits.track.weapon",
      "ADND2E.sheet.traits.track.nonweapon",
      "ADND2E.sheet.traits.target.hp",
      "ADND2E.sheet.traits.target.none",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP9a casting chat strings", () => {
  it("resolves every ADND2E.chat.casting.* key", () => {
    for (const key of [
      "ADND2E.chat.casting.begin",
      "ADND2E.chat.casting.lost",
      "ADND2E.chat.casting.initiativeAdded",
      "ADND2E.chat.casting.completesRound",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — SP9a casting sheet strings", () => {
  it("resolves every ADND2E.sheet.casting.* and casting warning key", () => {
    for (const key of [
      "ADND2E.sheet.casting.title",
      "ADND2E.sheet.casting.badge",
      "ADND2E.sheet.casting.badgeHint",
      "ADND2E.sheet.casting.completesRound",
      "ADND2E.sheet.casting.onYourTurn",
      "ADND2E.sheet.casting.complete",
      "ADND2E.sheet.casting.disrupt",
      "ADND2E.sheet.casting.cancel",
      "ADND2E.sheet.casting.busyWarning",
      "ADND2E.sheet.casting.notReadyWarning",
      "ADND2E.sheet.casting.initiativeNotice",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});

describe("lang/en.json — owned-item row controls", () => {
  it("resolves every ADND2E.sheet.itemControls.* key", () => {
    for (const key of [
      "ADND2E.sheet.itemControls.edit",
      "ADND2E.sheet.itemControls.delete",
      "ADND2E.sheet.itemControls.deleteTitle",
      "ADND2E.sheet.itemControls.deleteConfirm",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
