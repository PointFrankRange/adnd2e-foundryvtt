// Thin Foundry glue over the pure registry. Not unit-tested (spec §9 — exercised
// in a linked dev world); all logic lives in ./registry.
import { SYSTEM_ID } from "../constants";
import { DEFAULT_PLAYER_APPLY_MODE, PLAYER_APPLY_MODES, type PlayerApplyMode } from "../combat/apply-relay";
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
      requiresReload: d.requiresReload ?? false,
    });
  }

  game.settings!.register(SYSTEM_ID, "playerAppliedEffects" as SettingKey, {
    name: "ADND2E.settings.playerAppliedEffects.name",
    hint: "ADND2E.settings.playerAppliedEffects.hint",
    scope: "world",
    config: true,
    type: String,
    choices: Object.fromEntries(PLAYER_APPLY_MODES.map((m) => [m, `ADND2E.settings.playerAppliedEffects.${m}`])),
    default: DEFAULT_PLAYER_APPLY_MODE,
  } as never);
}

/** The current optional-rules bag, read from `game.settings`. Pass into `core/`. */
export function getOptionalRules(): OptionalRules {
  return readOptionalRules((key) => game.settings!.get(SYSTEM_ID, key as SettingKey));
}

/** The world's player-applied-effects mode; anything unexpected falls back to the default. */
export function getPlayerApplyMode(): PlayerApplyMode {
  const v = game.settings!.get(SYSTEM_ID, "playerAppliedEffects" as SettingKey) as unknown;
  return (PLAYER_APPLY_MODES as readonly unknown[]).includes(v) ? (v as PlayerApplyMode) : DEFAULT_PLAYER_APPLY_MODE;
}
