import "../styles/system.scss";
import { buildAdnd2eConfig } from "./config";
import { SYSTEM_ID } from "./constants";
import { ACTIVE_EFFECT_DATA_MODELS } from "./data/active-effect";
import { ACTOR_DATA_MODELS } from "./data/actor";
import { ITEM_DATA_MODELS } from "./data/item";
import { Adnd2eActiveEffect, Adnd2eActor, Adnd2eCombat, Adnd2eCombatant, Adnd2eItem } from "./documents";
import { registerSettings } from "./settings";
import { registerSheets } from "./sheets";
import { registerSheetPartials } from "./sheets/handlebars";
import { buildApi } from "./api";
import { registerMigrationSettings, runMigrations } from "./migrations/run";
import { registerChatListeners } from "./chat/chat-listeners";

Hooks.once("init", () => {
  console.log(`${SYSTEM_ID} | Initializing`);
  CONFIG.ADND2E = buildAdnd2eConfig();
  CONFIG.Item.dataModels = ITEM_DATA_MODELS;
  CONFIG.Actor.documentClass = Adnd2eActor;
  CONFIG.Item.documentClass = Adnd2eItem;
  CONFIG.ActiveEffect.documentClass = Adnd2eActiveEffect;
  CONFIG.Combatant.documentClass = Adnd2eCombatant;
  CONFIG.Combat.documentClass = Adnd2eCombat;
  // Merge — do NOT replace: unlike CONFIG.Actor/Item.dataModels (which default to
  // `{}`), CONFIG.ActiveEffect.dataModels is pre-populated with Foundry's
  // mandatory `base` entry, and dropping it breaks every core/base-typed effect.
  Object.assign(CONFIG.ActiveEffect.dataModels, ACTIVE_EFFECT_DATA_MODELS);
  CONFIG.Actor.dataModels = ACTOR_DATA_MODELS;
  registerSettings();
  registerMigrationSettings();
  registerSheets();
});

Hooks.once("setup", () => {
  void registerSheetPartials();
});

Hooks.once("ready", async () => {
  console.log(`${SYSTEM_ID} | Ready`);
  (game.system as unknown as { api: ReturnType<typeof buildApi> }).api = buildApi();
  await runMigrations();
  registerChatListeners();
});
