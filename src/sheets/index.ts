import { SYSTEM_ID } from "../constants";
import { Adnd2eActiveEffectConfig } from "./active-effect-sheet";
import { Adnd2eActorSheet } from "./actor-sheet";
import { Adnd2eItemSheet } from "./item-sheet";

/** Register the SP1 raw-field editor as the default sheet for every document type. Call on `init`. */
export function registerSheets(): void {
  const DSC = foundry.applications.apps.DocumentSheetConfig as unknown as {
    registerSheet(
      documentClass: unknown,
      scope: string,
      sheetClass: unknown,
      options: { label?: string; types?: string[]; makeDefault?: boolean },
    ): void;
  };
  DSC.registerSheet(Actor, SYSTEM_ID, Adnd2eActorSheet, {
    makeDefault: true,
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
