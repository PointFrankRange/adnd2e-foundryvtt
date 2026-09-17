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
import { promptInitiativeModifier } from "./combat/initiative-modifier-dialog";

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
  // Nine core defaults are near-synonyms of this system's own conditions
  // (same or near-identical icon art, different id) and would otherwise sit
  // beside our entries in the Token HUD as silent no-ops: toggling core's
  // "stun"/"blind"/etc. puts that literal id into actor.statuses, which
  // this system's condition-effects.ts never checks for. The Proxy's
  // deleteProperty trap (client/config.mjs:1718-1729, verified against real
  // v14.364 source) correctly removes both the array slot (via
  // statuses.findSplice) and the id-keyed property for a string-key delete,
  // so this is a clean removal, not a leftover array hole. Core's other ~21
  // defaults (fly/burrow/hover/target/bless/etc.) have no equivalent among
  // this system's 15 conditions and are left untouched — deleting them would
  // regress real core vision/movement behaviour this system doesn't model.
  const REDUNDANT_CORE_STATUS_IDS = [
    "blind",
    "deaf",
    "stun",
    "paralysis",
    "poison",
    "restrain",
    "sleep",
    "fear",
    "downgrade",
  ] as const;
  for (const id of REDUNDANT_CORE_STATUS_IDS) {
    delete (CONFIG.statusEffects as unknown as Record<string, unknown>)[id];
  }
  CONFIG.specialStatusEffects.BLIND = "blinded";
  registerSettings();
  registerMigrationSettings();
  registerSheets();
  // Real hook name mechanically confirmed by reading v14.364 source (NOT the
  // stale "getCombatantContextOptions" the JSDoc above the call site claims):
  // CombatTracker's own _getEntryContextOptions() context menu is created via
  // _createContextMenu(this._getEntryContextOptions, ".combatant", {fixed: true})
  // (client/applications/sidebar/tabs/combat-tracker.mjs) with no hookName
  // override, so _createContextMenu's default "get{}ContextOptions" applies
  // (client/applications/api/application.mjs #_createContextMenu). #callHooks
  // does `Hooks.callAll(hookName.replace("{}", cls.name), ...)` for each class
  // in inheritanceChain(), which yields `this.constructor` (CombatTracker)
  // first — so "getCombatTrackerContextOptions" is the first (and for this
  // unsubclassed core app, only relevant) hook actually fired.
  //
  // Entry shape also confirmed against combat-tracker.mjs's own
  // _getEntryContextOptions() (the real "Reroll" entry etc.) and
  // ContextMenuEntry's JSDoc typedef in client/applications/ux/context-menu.mjs:
  // {label, icon, visible, onClick} — NOT {name, icon, condition, callback}.
  // Combatant rows (the `li` passed to visible/onClick) carry the combatant id
  // directly on `li.dataset.combatantId`, matching core's own
  // `li => this.viewed.combatants.get(li.dataset.combatantId)` helper — no
  // `.closest()` needed since `li` IS the `.combatant` row element.
  //
  // fvtt-types (pinned to a v13-beta snapshot — see memory:
  // foundry-v14-vs-fvtt-types) still types ContextMenu.Entry with the OLD
  // pre-v14 shape ({name, callback, condition}), so the real-shape object
  // literal below is cast past it rather than rewritten to match a shape
  // core no longer reads at runtime.
  //
  // This registration is placed here in `init`, not in `ready`, because the
  // sidebar Combat Tracker builds its context menu EAGERLY during its own
  // _onFirstRender (client/applications/sidebar/tabs/combat-tracker.mjs),
  // which happens during Game#setupGame's initializeUI() — well before
  // `ready` fires (ready is gated behind DocumentSheetConfig.initializeSheets,
  // documentIndex.index, and a full canvas draw; client/game.mjs). Hooks.on
  // only registers a listener — the callback body itself (game.user?.isGM,
  // app.viewed.combatants, etc.) is only evaluated later, at actual
  // menu-build/right-click time, so there is no init-time dependency on
  // anything not yet ready.
  Hooks.on("getCombatTrackerContextOptions", (app: unknown, options: unknown[]) => {
    const getCombatant = (li: HTMLElement) => {
      const tracker = app as { viewed?: { combatants: { get(id: string): unknown } } };
      const id = li.dataset.combatantId;
      return id ? tracker.viewed?.combatants.get(id) : undefined;
    };
    options.push({
      label: "ADND2E.combat.initiativeModifier.title",
      icon: "fa-solid fa-dice-d10",
      visible: () => Boolean(game.user?.isGM),
      onClick: (_event: PointerEvent, li: HTMLElement) => {
        const combatant = getCombatant(li);
        if (combatant) void promptInitiativeModifier(combatant as never);
      },
    } as never);
  });
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
