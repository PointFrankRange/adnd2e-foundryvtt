import "../styles/system.scss";
import { buildAdnd2eConfig } from "./config";
import { SYSTEM_ID } from "./constants";
import { registerSettings } from "./settings";

Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | Initializing`);
  CONFIG.ADND2E = buildAdnd2eConfig();
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${SYSTEM_ID} | Ready`);
});
