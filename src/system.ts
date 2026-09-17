import "../styles/system.scss";
import { buildAdnd2eConfig } from "./config";
import { buildStatusEffects } from "./conditions";
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
  // CONFIG.statusEffects is a Proxy (real v14.364 source, client/config.mjs)
  // whose dedup-by-id logic only fires on id-keyed writes — the same path
  // core itself uses for its own defaults — NOT on array-index writes like
  // .push() would produce. Four of this system's ids (dead/unconscious/
  // invisible/prone) collide with core defaults; pushing them would create
  // real duplicate array elements and make the Proxy's `ownKeys` trap throw
  // on the very next iteration (e.g. Token HUD render). Id-keyed assignment
  // correctly replaces the colliding core defaults with our adnd2e-typed
  // entries and adds the rest. specialStatusEffects.BLIND is reassigned so
  // core's own vision/detection code (which checks for the literal id
  // "blind") recognizes this system's "blinded" condition instead.
  for (const effect of buildStatusEffects()) {
    (CONFIG.statusEffects as unknown as Record<string, unknown>)[effect.id] = effect;
  }
  CONFIG.specialStatusEffects.BLIND = "blinded";
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
