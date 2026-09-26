# Player-Applied Damage & Effects Relay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let non-GM players apply damage, healing and maneuver effects to targets they don't own (relayed through the active GM via Foundry v14's built-in user query, optionally GM-approved), and give creature damage rolls an Apply Damage button.

**Architecture:** A pure `src/combat/apply-relay.ts` owns the request type, the strict request validator, the HP damage/healing arithmetic (moved out of `chat-listeners.ts`) and the log-line data. A new Foundry-layer `src/relay/` holds one `applyEffectLocally` performer, the client-side `requestApply` router (GM/owner → local; else `game.users.activeGM.query`), and the GM-side `CONFIG.queries["adnd2e.applyEffect"]` handler. Existing callers (Apply Damage, spell Apply, maneuver effects) go through `requestApply`; creature damage posts a small card carrying the existing `applyDamage` button.

**Tech Stack:** TypeScript, Vitest, Handlebars/ApplicationV2 (Foundry v14.364).

**Spec:** `docs/superpowers/specs/2026-09-25-adnd2e-player-apply-relay-design.md`

## Global Constraints

- **Foundry v14.364** source (`C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}`) is authoritative — never `fvtt-types` (v13-beta, wrong). Verified during planning: `User#query(name, data, {timeout})` requires the name in `CONFIG.queries` and the caller's `QUERY_USER` permission (`client/documents/user.mjs:289-321`); players have it by default (`common/constants.mjs:1405-1410`); the receiving client runs `CONFIG.queries[name](data, { user, timeout })` and a thrown error rejects the caller's promise with `reason = e.message` (`client/documents/collections/users.mjs:218-240`).
- **Two-layer contract:** `src/combat/**` is a pure zone (no Foundry imports, 100% line/statement/function coverage, branches ≥ 90). The new `src/relay/` directory is deliberately OUTSIDE every pure zone (`vitest.config.ts` coverage `include`, `tsconfig.core.json` `include`, ESLint pure-zone `files`) — Foundry glue, typecheck/lint gated, dev-world verified. Task 2 confirms this.
- **The GM handler never trusts the request:** it re-validates with `validateRelayRequest` (known `kind`; `amount` an integer 1–999 for damage/healing; `conditionId` ∈ {`stunned`, `prone`, `held`}; `targetUuid` a non-empty string), resolves the target with `fromUuid` and requires an Actor, and runs only when `game.user.isActiveGM`. Invalid → throws (the player's query rejects).
- **Owner / GM path is behavior-identical to today:** if the acting user is a GM or owns the target, the effect applies locally with exactly today's arithmetic (temp HP absorbs damage first and is only written when the hp object has a `temp` key; healing caps at `max`; conditions via `toggleStatusEffect(id, { active: true })`; disarm unequips the target's FIRST equipped weapon).
- **No toast before a user-visible result:** relay warnings fire only after the chat card already exists (the buttons live on posted cards; the maneuver branch already runs after `roll.toMessage`). Nothing throws out of a button handler.
- **No `npm run format`/`prettier`/`npm install`/`npm update`**; don't touch package files. Implementers never run `npm run build`/`build:packs`; the controller builds at Task 6 after re-confirming Foundry is closed.
- **Read vitest output with `tail`/redirect, never `| grep`**; rerun 2-3× on a first-run flake.
- **Mandatory whole-branch review (Task 5); GATED dev-world check (Task 6) with a non-GM player seat as the primary acceptance test.**

## Locked design decisions

1. **Query name** `adnd2e.applyEffect` (system-prefixed, per `client/config.mjs` "System and modules must prefix the names of the queries they register"). One timeout, 120 000 ms, for both modes.
2. **Setting** `adnd2e.playerAppliedEffects`: world scope, `config: true`, `type: String`, `choices: { auto, approve }` (labels from lang), default `"auto"`, no reload. It is NOT an `OptionalRules` toggle; its value set and default live in the pure module (`PLAYER_APPLY_MODES`, `DEFAULT_PLAYER_APPLY_MODE`) so they are unit-tested; the string-typed `SettingConfig` key is invisible to the boolean-only settings-augmentation test (same as `systemMigrationVersion`).
3. **Results:** the handler returns `{ applied: true }`, `{ applied: false, reason: "declined" }` (approve mode, GM said no/closed), or `{ applied: false, reason: "notActiveGm" }` (defensive); it THROWS for an invalid request or a missing target. The client maps: rejected promise / `notActiveGm` → `relay.failedWarning`; `declined` → `relay.declinedWarning`; no active GM → `relay.noGmWarning`.
4. **Audit log:** after a relayed apply the GM client creates a ChatMessage whispered to `ChatMessage.getWhisperRecipients("GM")`, content `game.i18n.format("ADND2E.relay.log", { user, effect, target })`, where `effect` is the localized `relayEffectText(request)`.
5. **Approve dialog:** `DialogV2.confirm` on the GM client, title `ADND2E.relay.approveTitle`, content `ADND2E.relay.approvePrompt` `{ user, effect, target }` (names HTML-escaped). Only a literal `true` applies.
6. **Creature damage card:** both the normal and the crit path render `templates/chat/creature-damage.hbs` (`formula`, `total`, optional `crit` flag) with the existing `data-action="applyDamage" data-amount="{{total}}"` button, keep the evaluated roll attached (`rolls: [damageRoll]`), keep `flavor`, and keep the world's message mode (`toMessage` for the normal path, the existing `applyMessageMode` + `ChatMessage.create` for crits).
7. **`resolveTargetEquippedWeapon`** in `combat-rolls.ts` becomes unused and is deleted; `unequipWeapon` stays (the fumble path unequips the attacker's own weapon).

---

### Task 1: Pure apply-relay module

**Files:**
- Create: `src/combat/apply-relay.ts`
- Test: `tests/combat/apply-relay.test.ts`

**Interfaces:**
- Produces: `RelayRequest`, `RelayResult`, `RELAY_QUERY = "adnd2e.applyEffect"`, `RELAY_CONDITIONS`, `PLAYER_APPLY_MODES`, `PlayerApplyMode`, `DEFAULT_PLAYER_APPLY_MODE`, `validateRelayRequest(raw: unknown): RelayRequest | null`, `hpDamageUpdate(hp, amount)`, `hpHealingUpdate(hp, amount)`, `relayEffectText(request): { key: string; data: Record<string, string | number> }`.

- [ ] **Step 1: Failing tests** — create `tests/combat/apply-relay.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYER_APPLY_MODE,
  PLAYER_APPLY_MODES,
  RELAY_CONDITIONS,
  RELAY_QUERY,
  hpDamageUpdate,
  hpHealingUpdate,
  relayEffectText,
  validateRelayRequest,
} from "../../src/combat/apply-relay";

describe("constants", () => {
  it("pins the query name, conditions and apply modes", () => {
    expect(RELAY_QUERY).toBe("adnd2e.applyEffect");
    expect([...RELAY_CONDITIONS]).toEqual(["stunned", "prone", "held"]);
    expect([...PLAYER_APPLY_MODES]).toEqual(["auto", "approve"]);
    expect(DEFAULT_PLAYER_APPLY_MODE).toBe("auto");
  });
});

describe("validateRelayRequest", () => {
  const t = "Scene.a.Token.b.Actor.c";
  it("accepts every well-formed kind and returns a clean copy", () => {
    expect(validateRelayRequest({ kind: "damage", targetUuid: t, amount: 7, extra: 1 })).toEqual({ kind: "damage", targetUuid: t, amount: 7 });
    expect(validateRelayRequest({ kind: "healing", targetUuid: t, amount: 999 })).toEqual({ kind: "healing", targetUuid: t, amount: 999 });
    expect(validateRelayRequest({ kind: "condition", targetUuid: t, conditionId: "prone" })).toEqual({ kind: "condition", targetUuid: t, conditionId: "prone" });
    expect(validateRelayRequest({ kind: "unequip", targetUuid: t })).toEqual({ kind: "unequip", targetUuid: t });
  });
  it.each([
    null, undefined, 42, "damage", [],
    { kind: "damage", targetUuid: t },
    { kind: "damage", targetUuid: t, amount: 0 },
    { kind: "damage", targetUuid: t, amount: -3 },
    { kind: "damage", targetUuid: t, amount: 1.5 },
    { kind: "healing", targetUuid: t, amount: 1000 },
    { kind: "healing", targetUuid: t, amount: "5" },
    { kind: "condition", targetUuid: t, conditionId: "dead" },
    { kind: "condition", targetUuid: t },
    { kind: "unequip", targetUuid: "" },
    { kind: "unequip" },
    { kind: "teleport", targetUuid: t },
  ])("rejects %j", (raw) => {
    expect(validateRelayRequest(raw)).toBeNull();
  });
});

describe("hpDamageUpdate (moved from chat-listeners, behavior-identical)", () => {
  it("temp HP absorbs damage first and is written when the hp object has a temp key", () => {
    expect(hpDamageUpdate({ value: 20, temp: 5 }, 8)).toEqual({ "system.attributes.hp.value": 17, "system.attributes.hp.temp": 0 });
    expect(hpDamageUpdate({ value: 20, temp: 5 }, 3)).toEqual({ "system.attributes.hp.value": 20, "system.attributes.hp.temp": 2 });
    expect(hpDamageUpdate({ value: 20, temp: 0 }, 4)).toEqual({ "system.attributes.hp.value": 16, "system.attributes.hp.temp": 0 });
  });
  it("writes only value when the hp object has no temp key", () => {
    expect(hpDamageUpdate({ value: 20 }, 4)).toEqual({ "system.attributes.hp.value": 16 });
  });
  it("can drop hit points below zero", () => {
    expect(hpDamageUpdate({ value: 3 }, 10)).toEqual({ "system.attributes.hp.value": -7 });
  });
});

describe("hpHealingUpdate", () => {
  it("adds and caps at max", () => {
    expect(hpHealingUpdate({ value: 5, max: 20 }, 4)).toEqual({ "system.attributes.hp.value": 9 });
    expect(hpHealingUpdate({ value: 18, max: 20 }, 9)).toEqual({ "system.attributes.hp.value": 20 });
  });
});

describe("relayEffectText", () => {
  it("names the effect for the GM log / approval prompt", () => {
    const t = "x";
    expect(relayEffectText({ kind: "damage", targetUuid: t, amount: 7 })).toEqual({ key: "ADND2E.relay.effect.damage", data: { amount: 7 } });
    expect(relayEffectText({ kind: "healing", targetUuid: t, amount: 3 })).toEqual({ key: "ADND2E.relay.effect.healing", data: { amount: 3 } });
    expect(relayEffectText({ kind: "condition", targetUuid: t, conditionId: "held" })).toEqual({ key: "ADND2E.relay.effect.condition", data: { condition: "held" } });
    expect(relayEffectText({ kind: "unequip", targetUuid: t })).toEqual({ key: "ADND2E.relay.effect.unequip", data: {} });
  });
});
```
Run `npx vitest run tests/combat/apply-relay.test.ts > "$TEMP/ar.log" 2>&1; tail -8 "$TEMP/ar.log"` → FAIL (module missing).

- [ ] **Step 2: Implement** — create `src/combat/apply-relay.ts`:
```typescript
// Player-applied damage & effects relay (post-SP9). The request a player's
// client sends to the active GM when it can't modify a target itself, the
// strict validator the GM handler runs on it, and the HP arithmetic shared by
// the local and relayed paths (moved verbatim from chat/chat-listeners.ts so
// the two can't drift). Pure — no Foundry imports.

export const RELAY_QUERY = "adnd2e.applyEffect";

/** The conditions a maneuver may relay (Plan 7d's called shots + grapple). */
export const RELAY_CONDITIONS = ["stunned", "prone", "held"] as const;
export type RelayConditionId = (typeof RELAY_CONDITIONS)[number];

export const PLAYER_APPLY_MODES = ["auto", "approve"] as const;
export type PlayerApplyMode = (typeof PLAYER_APPLY_MODES)[number];
export const DEFAULT_PLAYER_APPLY_MODE: PlayerApplyMode = "auto";

const MAX_AMOUNT = 999;

export type RelayRequest =
  | { kind: "damage"; targetUuid: string; amount: number }
  | { kind: "healing"; targetUuid: string; amount: number }
  | { kind: "condition"; targetUuid: string; conditionId: RelayConditionId }
  | { kind: "unequip"; targetUuid: string };

export type RelayResult = { applied: true } | { applied: false; reason: "declined" | "notActiveGm" };

function isAmount(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_AMOUNT;
}

/** A clean, well-formed request, or null for anything malformed. The GM handler trusts nothing else. */
export function validateRelayRequest(raw: unknown): RelayRequest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const targetUuid = r.targetUuid;
  if (typeof targetUuid !== "string" || targetUuid === "") return null;
  switch (r.kind) {
    case "damage":
    case "healing":
      return isAmount(r.amount) ? { kind: r.kind, targetUuid, amount: r.amount } : null;
    case "condition":
      return (RELAY_CONDITIONS as readonly unknown[]).includes(r.conditionId)
        ? { kind: "condition", targetUuid, conditionId: r.conditionId as RelayConditionId }
        : null;
    case "unequip":
      return { kind: "unequip", targetUuid };
    default:
      return null;
  }
}

/** Damage: temp HP absorbs first; `temp` is written only when the hp object has that key. */
export function hpDamageUpdate(hp: { value: number; temp?: number }, amount: number): Record<string, number> {
  const temp = hp.temp ?? 0;
  const fromTemp = Math.min(temp, amount);
  const update: Record<string, number> = { "system.attributes.hp.value": hp.value - (amount - fromTemp) };
  if ("temp" in hp) update["system.attributes.hp.temp"] = temp - fromTemp;
  return update;
}

/** Healing: adds, capped at max. */
export function hpHealingUpdate(hp: { value: number; max: number }, amount: number): Record<string, number> {
  return { "system.attributes.hp.value": Math.min(hp.max, hp.value + amount) };
}

/** The i18n key + format data naming a request's effect (GM log line / approval prompt). */
export function relayEffectText(request: RelayRequest): { key: string; data: Record<string, string | number> } {
  switch (request.kind) {
    case "damage":
    case "healing":
      return { key: `ADND2E.relay.effect.${request.kind}`, data: { amount: request.amount } };
    case "condition":
      return { key: "ADND2E.relay.effect.condition", data: { condition: request.conditionId } };
    case "unequip":
      return { key: "ADND2E.relay.effect.unequip", data: {} };
  }
}
```
- [ ] **Step 3: Verify** — focused test passes; `npm run typecheck`, `npm run lint`, `npm run test:coverage` (each redirected to a `$TEMP` file, read with `tail`) exit 0; `apply-relay.ts` at 100%.
- [ ] **Step 4: Commit**
```bash
git add src/combat/apply-relay.ts tests/combat/apply-relay.test.ts
git commit -m "feat(relay): pure request validation and HP math for player-applied effects

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Relay glue — setting, local performer, client router, GM query handler, lang

**Files:**
- Create: `src/relay/apply-effect.ts`, `src/relay/relay-client.ts`, `src/relay/relay-handler.ts`
- Modify: `src/settings/index.ts`, `src/types/global.d.ts`, `src/system.ts`, `lang/en.json`, `tests/lang/en-coverage.test.ts`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces (Task 3): `applyEffectLocally(actor: EffectTarget, request: RelayRequest): Promise<void>`, `EffectTarget`; `requestApply(target: EffectTarget & { uuid: string; isOwner: boolean }, request: RelayRequest): Promise<void>`; `registerRelayQuery(): void`; `getPlayerApplyMode(): PlayerApplyMode`.

- [ ] **Step 1: Lang (failing test first)** — append to `tests/lang/en-coverage.test.ts`:
```typescript
describe("lang/en.json — player-applied effects relay", () => {
  it("resolves every relay key and the setting's choice labels", () => {
    for (const key of [
      "ADND2E.settings.playerAppliedEffects.name",
      "ADND2E.settings.playerAppliedEffects.hint",
      "ADND2E.settings.playerAppliedEffects.auto",
      "ADND2E.settings.playerAppliedEffects.approve",
      "ADND2E.relay.noGmWarning",
      "ADND2E.relay.failedWarning",
      "ADND2E.relay.declinedWarning",
      "ADND2E.relay.approveTitle",
      "ADND2E.relay.approvePrompt",
      "ADND2E.relay.log",
      "ADND2E.relay.effect.damage",
      "ADND2E.relay.effect.healing",
      "ADND2E.relay.effect.condition",
      "ADND2E.relay.effect.unequip",
    ]) {
      expect(typeof resolve(key), key).toBe("string");
      expect((resolve(key) as string).length, key).toBeGreaterThan(0);
    }
  });
});
```
Run the lang test (FAIL). Add to `lang/en.json` — inside `ADND2E.settings` (after the `channelers` entry, mind commas):
```json
      "playerAppliedEffects": {
        "name": "Player-Applied Damage & Effects",
        "hint": "When a player applies damage, healing or a maneuver effect to a token they don't own, the active GM's client applies it. Choose whether that happens automatically or waits for the GM to approve each one. Requires a GM to be connected.",
        "auto": "Apply automatically",
        "approve": "GM must approve"
      }
```
and a new top-level object inside `ADND2E` (sibling of `sheet`, `chat`, `settings`):
```json
    "relay": {
      "noGmWarning": "No GM is connected — the GM must apply this to a token you don't own.",
      "failedWarning": "Couldn't apply that to a token you don't own — ask the GM to apply it.",
      "declinedWarning": "The GM declined to apply that.",
      "approveTitle": "Player-Applied Effect",
      "approvePrompt": "{user} wants to apply {effect} to {target}. Allow it?",
      "log": "{user} applied {effect} to {target}.",
      "effect": {
        "damage": "{amount} damage",
        "healing": "{amount} healing",
        "condition": "the {condition} condition",
        "unequip": "a disarm (unequip weapon)"
      }
    },
```
Re-run — pass. The existing "resolves name + hint for every registered setting" test only walks `SETTING_DESCRIPTORS`, so it is unaffected.

- [ ] **Step 2: Setting**

`src/types/global.d.ts` — inside `SettingConfig`, after `"adnd2e.systemMigrationVersion": string;`:
```typescript
    // player-applied effects relay (post-SP9) — a string choice setting, not an
    // OptionalRules toggle, so (like systemMigrationVersion) it is invisible to the
    // boolean-only key-contract test.
    "adnd2e.playerAppliedEffects": string;
```
`src/settings/index.ts` — import `{ DEFAULT_PLAYER_APPLY_MODE, PLAYER_APPLY_MODES, type PlayerApplyMode } from "../combat/apply-relay";`, and append inside `registerSettings()` after the loop:
```typescript
  game.settings!.register(SYSTEM_ID, "playerAppliedEffects" as SettingKey, {
    name: "ADND2E.settings.playerAppliedEffects.name",
    hint: "ADND2E.settings.playerAppliedEffects.hint",
    scope: "world",
    config: true,
    type: String,
    choices: Object.fromEntries(PLAYER_APPLY_MODES.map((m) => [m, `ADND2E.settings.playerAppliedEffects.${m}`])),
    default: DEFAULT_PLAYER_APPLY_MODE,
  } as never);
```
and add:
```typescript
/** The world's player-applied-effects mode; anything unexpected falls back to the default. */
export function getPlayerApplyMode(): PlayerApplyMode {
  const v = game.settings!.get(SYSTEM_ID, "playerAppliedEffects" as SettingKey) as unknown;
  return (PLAYER_APPLY_MODES as readonly unknown[]).includes(v) ? (v as PlayerApplyMode) : DEFAULT_PLAYER_APPLY_MODE;
}
```

- [ ] **Step 3: `src/relay/apply-effect.ts`**
```typescript
import { hpDamageUpdate, hpHealingUpdate, type RelayRequest } from "../combat/apply-relay";

/* The single place each player-applicable effect is performed on a target actor —
 * used locally (GM / owner) and by the GM query handler. Foundry glue. */

export interface EffectTarget {
  system: { attributes: { hp: { value: number; max: number; temp?: number } } };
  items: Iterable<{ type: string; system: { equipped?: boolean }; update(d: Record<string, unknown>): Promise<unknown> }>;
  update(d: Record<string, unknown>): Promise<unknown>;
  toggleStatusEffect(id: string, opts: { active: boolean }): Promise<unknown>;
}

export async function applyEffectLocally(actor: EffectTarget, request: RelayRequest): Promise<void> {
  switch (request.kind) {
    case "damage":
      await actor.update(hpDamageUpdate(actor.system.attributes.hp, request.amount));
      return;
    case "healing":
      await actor.update(hpHealingUpdate(actor.system.attributes.hp, request.amount));
      return;
    case "condition":
      await actor.toggleStatusEffect(request.conditionId, { active: true });
      return;
    case "unequip":
      // the target's FIRST equipped weapon (Plan 7d's first-member-wins rule); unarmed = no-op
      for (const item of actor.items) {
        if (item.type === "weapon" && item.system.equipped) {
          await item.update({ "system.equipped": false });
          return;
        }
      }
      return;
  }
}
```

- [ ] **Step 4: `src/relay/relay-client.ts`**
```typescript
import { RELAY_QUERY, type RelayRequest, type RelayResult } from "../combat/apply-relay";
import { applyEffectLocally, type EffectTarget } from "./apply-effect";

/* Routes a player-applied effect: GM or owner → applied here, exactly as before;
 * otherwise relayed to the active GM through v14's User#query
 * (client/documents/user.mjs:289-321). Never throws; failures are warnings (the
 * chat card the button lives on already exists). */

const TIMEOUT_MS = 120_000;

export async function requestApply(
  target: EffectTarget & { uuid: string; isOwner: boolean },
  request: RelayRequest,
): Promise<void> {
  const g = game as unknown as {
    user: { isGM: boolean };
    users: { activeGM: { query(name: string, data: unknown, opts: { timeout: number }): Promise<unknown> } | null };
  };
  if (g.user.isGM || target.isOwner) {
    await applyEffectLocally(target, request);
    return;
  }
  const gm = g.users.activeGM;
  if (!gm) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.relay.noGmWarning"));
    return;
  }
  try {
    const result = (await gm.query(RELAY_QUERY, request, { timeout: TIMEOUT_MS })) as RelayResult | undefined;
    if (result?.applied) return;
    const key = result && !result.applied && result.reason === "declined" ? "ADND2E.relay.declinedWarning" : "ADND2E.relay.failedWarning";
    ui.notifications?.warn(game.i18n!.localize(key));
  } catch {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.relay.failedWarning"));
  }
}
```

- [ ] **Step 5: `src/relay/relay-handler.ts`**
```typescript
import { RELAY_QUERY, relayEffectText, validateRelayRequest, type RelayResult } from "../combat/apply-relay";
import { getPlayerApplyMode } from "../settings";
import { applyEffectLocally, type EffectTarget } from "./apply-effect";

/* The GM side of the relay: CONFIG.queries["adnd2e.applyEffect"]. v14 runs the
 * handler on the queried user's client with (data, { user, timeout })
 * (client/documents/collections/users.mjs:218-240); a thrown error rejects the
 * player's query. Trusts nothing: re-validates, re-resolves the target, and only
 * acts on the active GM's client. */

async function handleApplyQuery(data: unknown, context: { user: { name: string } }): Promise<RelayResult> {
  const self = game.user as unknown as { isActiveGM?: boolean };
  if (!self.isActiveGM) return { applied: false, reason: "notActiveGm" };
  const request = validateRelayRequest(data);
  if (!request) throw new Error("Invalid adnd2e.applyEffect request");
  const target = (await fromUuid(request.targetUuid)) as unknown as (EffectTarget & { documentName?: string; name: string }) | null;
  if (!target || target.documentName !== "Actor") throw new Error("adnd2e.applyEffect target not found");

  const text = relayEffectText(request);
  const esc = foundry.utils.escapeHTML;
  const names = {
    user: esc(context.user.name),
    effect: game.i18n!.format(text.key, text.data as Record<string, string>),
    target: esc(target.name),
  };
  if (getPlayerApplyMode() === "approve") {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n!.localize("ADND2E.relay.approveTitle") },
      content: `<p>${game.i18n!.format("ADND2E.relay.approvePrompt", names)}</p>`,
    } as never);
    if (ok !== true) return { applied: false, reason: "declined" };
  }

  await applyEffectLocally(target, request);
  const recipients = (ChatMessage as unknown as { getWhisperRecipients(name: string): { id: string }[] })
    .getWhisperRecipients("GM")
    .map((u) => u.id);
  await ChatMessage.create({
    content: `<p>${game.i18n!.format("ADND2E.relay.log", names)}</p>`,
    whisper: recipients,
  } as unknown as ChatMessage.CreateData);
  return { applied: true };
}

/** Registers the relay query. Call once, on `init`. */
export function registerRelayQuery(): void {
  (CONFIG as unknown as { queries: Record<string, unknown> }).queries[RELAY_QUERY] = handleApplyQuery;
}
```
Verify from v14 source and record in the report: `fromUuid` is a global in v14 (else `foundry.utils.fromUuid`); `ChatMessage.getWhisperRecipients` exists (`client/documents/chat-message.mjs`); a synthetic token actor's `documentName` is `"Actor"`.

- [ ] **Step 6: Register** — in `src/system.ts` import `registerRelayQuery` from `"./relay/relay-handler"` and call it inside the `init` hook right after `registerSettings();`.

- [ ] **Step 7: Verify** — typecheck, lint, `npm run test:coverage` exit 0; confirm in the report that `src/relay/` is matched by none of `vitest.config.ts` coverage `include`, `tsconfig.core.json` `include`, or the ESLint pure-zone `files`.

- [ ] **Step 8: Commit**
```bash
git add src/relay src/settings/index.ts src/types/global.d.ts src/system.ts lang/en.json tests/lang/en-coverage.test.ts
git commit -m "feat(relay): GM query handler, client router and player-applied-effects setting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Route the callers through the relay; creature damage Apply button

**Files:**
- Modify: `src/chat/chat-listeners.ts`, `src/sheets/character/combat-rolls.ts`, `src/sheets/creature/combat-rolls.ts`
- Create: `templates/chat/creature-damage.hbs`

**Interfaces:**
- Consumes: Task 2 `requestApply`, `EffectTarget`; Task 1 `RelayRequest`.

- [ ] **Step 1: Apply Damage / Apply cast effect** — in `src/chat/chat-listeners.ts` import `{ requestApply }` from `"../relay/relay-client"` and `type { EffectTarget }` from `"../relay/apply-effect"`. Replace the per-target body of BOTH `onApplyDamage` and `onApplyCastEffect` (keep the no-targets warning and the `if (!actor) continue;` exactly as they are) with:
```typescript
    const actor = t.actor as (EffectTarget & { uuid: string; isOwner: boolean }) | null;
    if (!actor) continue;
    await requestApply(actor, { kind: "damage", targetUuid: actor.uuid, amount });
```
(for `onApplyCastEffect`: `{ kind: kind === "healing" ? "healing" : "damage", targetUuid: actor.uuid, amount: signedAmount }`). Remove the now-unused `isGM` locals and the inline HP arithmetic (it lives in `hpDamageUpdate`/`hpHealingUpdate`, used by `applyEffectLocally`). `ADND2E.chat.damage.notOwnerWarning` becomes unused in code — leave the lang key (existing lang tests may list it).

NOTE (behavior-identical owner path): with the relay, an owner/GM applying an amount of 0 or a non-integer still takes the local path via `applyEffectLocally` with the same arithmetic as before. Only the relayed path validates.

- [ ] **Step 2: Maneuver effects** — in `src/sheets/character/combat-rolls.ts` replace the maneuver-target block (the `maneuverTarget` typing, the `isGM`/`isOwner` guard with `maneuverNotOwnerWarning`, and the `try { toggleStatusEffect / resolveTargetEquippedWeapon+unequipWeapon } catch` block) with:
```typescript
    const maneuverTarget = (targets.length === 1 ? targets[0]!.actor : null) as
      | (EffectTarget & { uuid: string; isOwner: boolean })
      | null;
    if (maneuverTarget) {
      try {
        await requestApply(
          maneuverTarget,
          maneuverEffect.kind === "condition"
            ? { kind: "condition", targetUuid: maneuverTarget.uuid, conditionId: maneuverEffect.conditionId as RelayConditionId }
            : { kind: "unequip", targetUuid: maneuverTarget.uuid },
        );
      } catch (err) {
        console.error(`${SYSTEM_ID} | failed to apply maneuver effect to the target`, err);
        ui.notifications?.warn(game.i18n!.localize("ADND2E.chat.attack.maneuverEffectFailedWarning"));
      }
    }
```
keeping the surrounding `if (maneuverEffect && maneuverEffect.kind !== "push")` and the explanatory comment (update it: the effect now relays through the active GM when the attacker doesn't own the target). Imports: `requestApply` (`../../relay/relay-client`), `type EffectTarget` (`../../relay/apply-effect`), `type RelayConditionId` (`../../combat/apply-relay`). Delete the now-unused `resolveTargetEquippedWeapon` function; keep `unequipWeapon` (the fumble path uses it). Check that every Plan 7d maneuver `conditionId` is one of stunned/prone/held (`src/core/combat/maneuvers.ts`); if any other appears, STOP and report.

- [ ] **Step 3: Creature damage card** — create `templates/chat/creature-damage.hbs`:
```hbs
<div class="adnd2e chat-card damage-roll creature-damage">
  <p class="formula">{{formula}} = <strong>{{total}}</strong></p>
  {{#if crit}}<p class="crit">{{localize 'ADND2E.chat.creature.critDamage'}}</p>{{/if}}
  <button type="button" data-action="applyDamage" data-amount="{{total}}">
    {{localize 'ADND2E.chat.damage.applyToTargets'}}
  </button>
</div>
```
add `"critDamage": "Critical hit damage"` to the existing `ADND2E.chat.creature` lang object, and append this test to `tests/lang/en-coverage.test.ts` (write it first; it fails until the key exists):
```typescript
describe("lang/en.json — creature damage card", () => {
  it("resolves the creature crit-damage label", () => {
    expect(typeof resolve("ADND2E.chat.creature.critDamage")).toBe("string");
  });
});
``` In `src/sheets/creature/combat-rolls.ts` `rollAttack`, render it for both paths:
```typescript
    const renderDamage = (total: number, crit: boolean) =>
      foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH("chat/creature-damage.hbs"), {
        formula: damageRoll.formula,
        total,
        crit,
      });
```
normal path: `await damageRoll.toMessage({ speaker, flavor, content: await renderDamage(damageRoll.total ?? 0, false) } as unknown as Roll.MessageData);`; crit path: keep `applyMessageMode({...})` + `ChatMessage.create`, replacing only `content` with `await renderDamage(finalDamageTotal, true)` (keep `rolls: [damageRoll]`, `speaker`, `flavor`). Update the function's doc comment (the card now carries an Apply button).

- [ ] **Step 4: Verify** — typecheck, lint, `npm run test:coverage` exit 0; `npx vitest run tests/lang 2>&1 | tail -8`. In the report, walk the owner/GM path of `onApplyDamage` before vs after and confirm identical writes.

- [ ] **Step 5: Commit**
```bash
git add src/chat/chat-listeners.ts src/sheets/character/combat-rolls.ts src/sheets/creature/combat-rolls.ts templates/chat/creature-damage.hbs lang/en.json tests/lang/en-coverage.test.ts
git commit -m "feat(relay): route Apply Damage, spell apply and maneuver effects through the relay; creature damage Apply button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: README

- [ ] Remove the two resolved README "Known backlog items" entries ("Creature damage auto-apply" and "Non-GM players can't apply damage or maneuver effects to GM-owned targets"), and add one line under the Sub-project table's prose or backlog noting the new world setting *Player-Applied Damage & Effects* (auto / GM must approve; needs a GM connected). Commit `docs: note the player-applied effects relay; drop resolved backlog items`. (Controller may do this step directly — documentation only.)

---

### Task 5: Whole-branch review

**MANDATORY.** Dispatch on the most capable model over base..HEAD with this plan, the spec and this risk list:
- **Owner/GM path byte-identical:** `onApplyDamage`, `onApplyCastEffect` and the maneuver branch produce exactly the pre-branch writes for a GM or an owner (temp HP handling, healing cap, condition toggle, first-equipped-weapon unequip); walk each against the base.
- **Handler trust boundary:** every relayed request passes `validateRelayRequest`; the target is re-resolved from its UUID and must be an Actor; only the active GM acts (`isActiveGM`); a malformed request or missing target throws (→ player rejection) and never partially applies; the handler cannot be used to write anything but the four effects.
- **Query semantics (v14 source):** `User#query` name registration, `QUERY_USER`, `activeGM` null handling, timeout, rejection mapping to the three warnings; what happens if the active GM is AFK in approve mode (timeout → failedWarning, no apply).
- **Approve dialog:** only a literal `true` applies; HTML-escaped names; dialog appears only on the active GM.
- **Whisper log recipients:** GM-only (`getWhisperRecipients("GM")`), created by the GM client; no public leak; one log per relayed apply.
- **No toast before the card; nothing throws out of a button handler.**
- **Creature card:** roll attached, message mode honored for both paths, crit total shown, the Apply button handled by the existing `applyDamage` listener (which reads `data-amount`).
- **Non-GM permissions:** a player can only ever change the target through the GM handler; no player-client write to an unowned document remains anywhere in the diff.
- **Pure-zone placement:** `src/combat/apply-relay.ts` pure + 100%; `src/relay/` outside every pure zone.
- **Setting:** registered in `init` before `ready`, choices labels resolve, `getPlayerApplyMode` falls back safely.
- Re-run typecheck/lint/test:coverage.
Fix every Critical/Important via one fix wave + one scoped re-review.

---

### Task 6: GATED dev-world smoke check

**REQUIRED, with a non-GM player seat.** Confirm Foundry is fully closed, `npm run build`, `npm run link`, user restarts Foundry. Setup: a GM-owned monster token (creature or NPC) with HP and an equipped weapon; a player-owned PC with a weapon and a damage spell; the Player account in a private window, GM logged in.

- [ ] **GM seat unchanged:** the GM applies weapon damage to the monster (temp HP behavior unchanged), spell healing to the PC, a maneuver condition — all apply locally, no log message, no dialog.
- [ ] **Player, auto mode:** the player targets the monster and clicks Apply Damage → HP drops; a whispered GM log "Player applied N damage to Monster" appears for the GM only. Same for spell damage; spell healing on a GM-owned ally; a called-shot condition (stunned/prone/held) and a disarm (weapon unequipped).
- [ ] **Player, own PC:** applying to their own PC works locally with no log.
- [ ] **Approve mode:** switch the setting; the player's apply pops a confirm on the GM's screen naming the player/effect/target; Yes applies (+ log), No shows the player "The GM declined".
- [ ] **No GM connected:** GM logs out; the player's apply shows the no-GM warning and nothing changes.
- [ ] **Creature damage:** a creature hit posts the new damage card with total + Apply button (normal and a crit); Apply works for GM, and for a player (relayed).
- [ ] Report each PASS/FAIL via `AskUserQuestion`; distinguish setup gaps from defects; fix defects through the fix-round process.

## After this plan lands

Push and open a PR (standing default). Update memory. Ask the user what's next from the remaining README backlog.
