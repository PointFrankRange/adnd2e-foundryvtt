import "../styles/system.scss";
import { buildAdnd2eConfig } from "./config";
import { SYSTEM_ID } from "./constants";
import { ITEM_DATA_MODELS } from "./data/item";
import { registerSettings } from "./settings";

Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | Initializing`);
  CONFIG.ADND2E = buildAdnd2eConfig();
  CONFIG.Item.dataModels = ITEM_DATA_MODELS;
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${SYSTEM_ID} | Ready`);
});
