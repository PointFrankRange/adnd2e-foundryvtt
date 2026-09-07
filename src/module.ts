import "../styles/module.scss";
import { MODULE_ID } from "./helpers/constants";
import { registerSettings } from "./helpers/settings";
import { ExampleApplication } from "./apps/example-app";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);
});

// Expose a small public API for macros/other modules, e.g.:
//   game.modules.get("my-module").api.openExample()
Hooks.once("setup", () => {
  // Non-null assertion: guaranteed to exist by the "setup" hook.
  const mod = game.modules!.get(MODULE_ID);
  if (mod) {
    Object.assign(mod, {
      api: {
        openExample: () => new ExampleApplication().render(true),
      },
    });
  }
});
