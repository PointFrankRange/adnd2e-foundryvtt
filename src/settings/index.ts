// Thin Foundry glue over the pure registry. Not unit-tested (spec §9 — exercised
// in a linked dev world); all logic lives in ./registry.
import { SYSTEM_ID } from "../constants";
import type { OptionalRules } from "../core/options";
import { readOptionalRules, SETTING_DESCRIPTORS } from "./registry";

// SETTING_DESCRIPTORS[n].key is typed `string` in the pure registry, but every
// value is one of the 22 suffixes augmented into `SettingConfig` by
// src/types/global.d.ts. fvtt-types' register()/get() want the narrowed
// `KeyFor<"adnd2e">`; this alias is the single cast point.
type SettingKey = foundry.helpers.ClientSettings.KeyFor<typeof SYSTEM_ID>;

/** Register every optional-rules toggle as a world setting. Call once, on `init`. */
export function registerSettings(): void {
  for (const d of SETTING_DESCRIPTORS) {
    game.settings!.register(SYSTEM_ID, d.key as SettingKey, {
      name: `ADND2E.settings.${d.key}.name`,
      hint: `ADND2E.settings.${d.key}.hint`,
      scope: "world",
      config: d.config,
      type: Boolean,
      default: d.default,
    });
  }
}

/** The current optional-rules bag, read from `game.settings`. Pass into `core/`. */
export function getOptionalRules(): OptionalRules {
  return readOptionalRules((key) => game.settings!.get(SYSTEM_ID, key as SettingKey));
}
