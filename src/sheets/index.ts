import { SYSTEM_ID } from "../constants";
import { Adnd2eActiveEffectConfig } from "./active-effect-sheet";
import { Adnd2eActorSheet } from "./actor-sheet";
import { Adnd2eCharacterSheet } from "./character/sheet";
import { Adnd2eCreatureSheet } from "./creature/sheet";
import { Adnd2eItemSheet } from "./item-sheet";
import { Adnd2eNpcSheet } from "./npc/sheet";

/** Register the SP1 raw-field editor as the default sheet for document types that
 *  don't yet have a real one. Call on `init`. */
export function registerSheets(): void {
  const DSC = foundry.applications.apps.DocumentSheetConfig as unknown as {
    registerSheet(
      documentClass: unknown,
      scope: string,
      sheetClass: unknown,
      options: { label?: string; types?: string[]; makeDefault?: boolean },
    ): void;
  };
  // The real PC sheet (SP2) — default for character only (SP6 Task 4 moved npc
  // to its own streamlined sheet below). Register it before the raw fallback so
  // it wins the default slot for character.
  DSC.registerSheet(Actor, SYSTEM_ID, Adnd2eCharacterSheet, {
    makeDefault: true,
    types: ["character"],
    label: "ADND2E.sheet.title",
  });
  // The real NPC sheet (SP6 Task 4) — default for npc.
  DSC.registerSheet(Actor, SYSTEM_ID, Adnd2eNpcSheet, {
    makeDefault: true,
    types: ["npc"],
    label: "ADND2E.sheet.npcTitle",
  });
  // The real creature sheet (SP6) — default for creature.
  DSC.registerSheet(Actor, SYSTEM_ID, Adnd2eCreatureSheet, {
    makeDefault: true,
    types: ["creature"],
    label: "ADND2E.sheet.creatureTitle",
  });
  DSC.registerSheet(Actor, SYSTEM_ID, Adnd2eActorSheet, {
    makeDefault: false,
    label: "ADND2E.sheets.rawActor",
  });
  DSC.registerSheet(Item, SYSTEM_ID, Adnd2eItemSheet, {
    makeDefault: true,
    label: "ADND2E.sheets.rawItem",
  });
  DSC.registerSheet(ActiveEffect, SYSTEM_ID, Adnd2eActiveEffectConfig, {
    makeDefault: true,
    types: ["adnd2e"],
    label: "ADND2E.sheets.rawEffect",
  });
}
