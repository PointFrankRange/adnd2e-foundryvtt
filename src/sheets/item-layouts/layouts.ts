// Declarative layouts for the five item types that get a designed sheet (#110). Paths are the item sheet's own
// `system.<field>` row paths; anything not listed falls into the automatic "Other" panel (see apply.ts), and the
// layout census (headless proof) checks every path here names a real schema field. Panel titles are
// ADND2E.sheets.layout.* keys.
import type { ItemLayout, LayoutPanel } from "./apply";

const PHYSICAL: LayoutPanel = {
  titleKey: "ADND2E.sheets.layout.physical",
  paths: [
    "system.quantity", "system.weight", "system.cost", "system.location",
    "system.identified", "system.equipped", "system.magicBonus",
  ],
  columns: 2,
};

export const ITEM_LAYOUTS: Readonly<Record<string, ItemLayout>> = {
  weapon: {
    strip: ["system.category", "system.damageVsSM", "system.damageVsL", "system.damageType", "system.speedFactor"],
    panels: [
      {
        titleKey: "ADND2E.sheets.layout.combat",
        paths: ["system.size", "system.handsRequired", "system.rateOfFire", "system.materialToHit"],
        columns: 2,
      },
      { titleKey: "ADND2E.sheets.layout.range", paths: ["system.range"] },
      {
        titleKey: "ADND2E.sheets.layout.proficiency",
        paths: ["system.proficiencyGroup", "system.baseWeaponName", "system.styleGroup", "system.specialistWeaponClass"],
        columns: 2,
      },
      { titleKey: "ADND2E.sheets.layout.ammunition", paths: ["system.ammoType", "system.selectedAmmoId"], columns: 2 },
      PHYSICAL,
    ],
  },
  armor: {
    strip: ["system.baseAc", "system.armorType", "system.isShield"],
    panels: [
      { titleKey: "ADND2E.sheets.layout.protection", paths: ["system.shieldAcBonus"] },
      { titleKey: "ADND2E.sheets.layout.penalties", paths: ["system.movementPenalty", "system.checkPenalty"], columns: 2 },
      PHYSICAL,
    ],
  },
  equipment: {
    panels: [
      { titleKey: "ADND2E.sheets.layout.details", paths: ["system.category", "system.consumable"], columns: 2 },
      { titleKey: "ADND2E.sheets.layout.charges", paths: ["system.charges"] },
      {
        titleKey: "ADND2E.sheets.layout.container",
        paths: ["system.container", "system.capacity", "system.contentsWeightMultiplier"],
        columns: 2,
      },
      PHYSICAL,
    ],
  },
  ammo: {
    strip: ["system.ammoType", "system.damageVsSM", "system.damageVsL", "system.damageType"],
    panels: [PHYSICAL],
  },
  spell: {
    strip: [
      { path: "system.level", display: "badge" },
      "system.casterClass",
      { path: "system.schools", display: "chips" },
      { path: "system.spheres", display: "chips" },
      { path: "system.components.v", display: "pill" },
      { path: "system.components.s", display: "pill" },
      { path: "system.components.m", display: "pill" },
    ],
    descriptionAfterPanel: 0,
    panels: [
      {
        titleKey: "ADND2E.sheets.layout.casting",
        paths: ["system.range", "system.duration", "system.castingTime", "system.areaOfEffect", "system.savingThrow"],
        columns: 2,
      },
      { titleKey: "ADND2E.sheets.layout.components", paths: ["system.materialComponent"] },
      { titleKey: "ADND2E.sheets.layout.reversible", paths: ["system.reversible", "system.isReversedForm"], columns: 2 },
      { titleKey: "ADND2E.sheets.layout.automation", paths: ["system.automation"] },
    ],
  },
};
