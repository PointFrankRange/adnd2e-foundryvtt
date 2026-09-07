import "../styles/system.scss";
import { SYSTEM_ID } from "./helpers/constants";
import { registerSettings } from "./helpers/settings";

Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | Initializing`);
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${SYSTEM_ID} | Ready`);
});
