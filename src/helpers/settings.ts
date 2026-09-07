import { MODULE_ID } from "./constants";

export function registerSettings(): void {
  // Non-null assertion: `registerSettings()` is only ever called from the "init" hook,
  // by which point `game.settings` is guaranteed to exist.
  game.settings!.register(MODULE_ID, "exampleSetting", {
    name: "MY-MODULE.settings.exampleSetting.name",
    hint: "MY-MODULE.settings.exampleSetting.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
}
