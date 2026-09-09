import "../styles/system.scss";
import { buildAdnd2eConfig } from "./config";
import { SYSTEM_ID } from "./constants";
import { ACTIVE_EFFECT_DATA_MODELS } from "./data/active-effect";
import { ACTOR_DATA_MODELS } from "./data/actor";
import { ITEM_DATA_MODELS } from "./data/item";
import { Adnd2eActiveEffect, Adnd2eActor, Adnd2eItem } from "./documents";
import { registerSettings } from "./settings";

Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | Initializing`);
  CONFIG.ADND2E = buildAdnd2eConfig();
  CONFIG.Item.dataModels = ITEM_DATA_MODELS;
  CONFIG.Actor.documentClass = Adnd2eActor;
  CONFIG.Item.documentClass = Adnd2eItem;
  CONFIG.ActiveEffect.documentClass = Adnd2eActiveEffect;
  CONFIG.ActiveEffect.dataModels = ACTIVE_EFFECT_DATA_MODELS;
  CONFIG.Actor.dataModels = ACTOR_DATA_MODELS;
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${SYSTEM_ID} | Ready`);
});
