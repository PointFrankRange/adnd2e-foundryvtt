import { describe, expect, it } from "vitest";
import { isDeferredChangeKey } from "../../../src/data/derive/effect-keys";

describe("isDeferredChangeKey", () => {
  it("character: derived paths return true", () => {
    for (const key of [
      "system.abilities.str.mods.toHit",
      "system.abilities.cha.mods",
      "system.attributes.hp.max",
      "system.attributes.thac0.melee",
      "system.attributes.ac.normal",
      "system.attributes.encumbrance.movementRate",
      "system.attributes.movement.current",
      "system.saves.spell.effectiveTarget",
      "system.proficiencies.weapon.available",
      "system.languagesKnown.max",
      "system.multiclass.hpAveraged",
      "system.spellcasting.wizard.slots",
      "system.classes",
    ]) {
      expect(isDeferredChangeKey(key, "character")).toBe(true);
    }
  });

  it("character: base / authored paths return false", () => {
    for (const key of [
      "system.abilities.str.score",
      "system.abilities.str.exceptional",
      "system.attributes.hp.value",
      "system.attributes.hp.temp",
      "system.details.alignment",
      "system.currency.gp",
      "name",
      "img",
    ]) {
      expect(isDeferredChangeKey(key, "character")).toBe(false);
    }
  });

  it("npc uses the same list as character", () => {
    expect(isDeferredChangeKey("system.saves.spell.effectiveTarget", "npc")).toBe(true);
    expect(isDeferredChangeKey("system.abilities.str.score", "npc")).toBe(false);
  });

  it("creature: only hp.max, thac0.value, and saves.effective.* are derived", () => {
    expect(isDeferredChangeKey("system.attributes.hp.max", "creature")).toBe(true);
    expect(isDeferredChangeKey("system.attributes.thac0.value", "creature")).toBe(true);
    expect(isDeferredChangeKey("system.saves.effective.bw", "creature")).toBe(true);
    // creature has no ability mods, no proficiencies, no multiclass
    expect(isDeferredChangeKey("system.abilities.str.mods.toHit", "creature")).toBe(false);
    expect(isDeferredChangeKey("system.attributes.ac.value", "creature")).toBe(false);
    expect(isDeferredChangeKey("system.saves.explicit.bw", "creature")).toBe(false);
  });
});
