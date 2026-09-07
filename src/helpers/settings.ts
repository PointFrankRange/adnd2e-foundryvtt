import { SYSTEM_ID } from "./constants";

export function registerSettings(): void {
  // Non-null assertion: `registerSettings()` is only ever called from the "init" hook,
  // by which point `game.settings` is guaranteed to exist.
  game.settings!.register(SYSTEM_ID, "exampleSetting", {
    name: "ADND2E.settings.exampleSetting.name",
    hint: "ADND2E.settings.exampleSetting.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
}
