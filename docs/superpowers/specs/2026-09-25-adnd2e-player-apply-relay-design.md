# AD&D 2E for Foundry VTT — Player-applied damage & effects relay

**Status:** Design approved (brainstorming), pending spec review
**Date:** 2026-09-25
**Author:** Joshua Frank + Claude
**Context:** post-Sub-project-9 backlog. Resolves README backlog items "Non-GM players can't apply damage or maneuver effects to GM-owned targets" and "Creature damage auto-apply".

---

## 1. Problem

Three actions mutate a *target* actor, which requires OWNER permission:

- **Apply Damage** on weapon damage cards and **Apply** on spell cast cards (`src/chat/chat-listeners.ts` `onApplyDamage` / `onApplyCastEffect`) — a player targeting a GM-owned monster gets `ADND2E.chat.damage.notOwnerWarning` and nothing happens.
- **Maneuver effects** (Plan 7d, `src/sheets/character/combat-rolls.ts` post-card branch): a called-shot/maneuver condition (`toggleStatusEffect`) or a disarm (`unequipWeapon` on the target's equipped weapon) — same guard, `maneuverNotOwnerWarning`.
- **Creature damage** (SP6, `src/sheets/creature/combat-rolls.ts`) posts a plain roll card with no Apply button at all.

## 2. Decisions (locked in brainstorming)

| Decision | Value |
|---|---|
| Relay mechanism | Foundry v14's built-in **User query**: `CONFIG.queries["adnd2e.applyEffect"]` handler + `game.users.activeGM.query(...)` (v14.364 `client/documents/user.mjs:289-321`, `client/documents/collections/users.mjs:218-240`). Players hold `QUERY_USER` by default (`common/constants.mjs:1405-1410`, `defaultRole: PLAYER`). No custom socket, no `system.json` change. |
| GM involvement | A new **world setting** `playerAppliedEffects`: `"auto"` (default — the GM client applies immediately) or `"approve"` (the GM gets a confirm dialog per request). |
| Audit | Every relayed apply whispers a short log line to the GM(s): "*Player* applied *7 damage* to *Goblin*". |
| Scope | Apply Damage / healing (weapon + spell cards), maneuver effects (conditions stunned/prone/held, disarm), and a new Apply Damage button on creature damage rolls. |
| Owner / GM path | Unchanged: if the acting user is a GM or owns the target, the effect applies locally exactly as today (no query). |

## 3. Global Constraints

- **Foundry v14.364** source (`C:\Program Files\Foundry Virtual Tabletop\resources\app`) is authoritative — never `fvtt-types`.
- **Two-layer contract:** new pure logic (request validation, HP damage/healing math, log-line data) lives in a pure-zone file (`src/combat/**` is pure) with 100% line/statement/function coverage; Foundry glue (the query handler, the client relay, the sheet/chat wiring, settings registration) lives OUTSIDE the pure zones (a new `src/relay/` directory) and is typecheck/lint gated + dev-world verified.
- **The GM handler never trusts the request:** it re-validates the shape (known `kind`; `amount` a positive integer ≤ 999; `conditionId` ∈ {`stunned`,`prone`,`held`}; `targetUuid` a string resolving to an Actor) and throws (→ the player's query rejects) on anything else. It applies only on the active GM's client (`game.user.isActiveGM`).
- **No toast before a user-visible result;** player-side failures (no GM connected, rejected, timeout, GM declined) are warning toasts after the card already exists.
- **Behavior-preserving refactor:** the HP damage/healing arithmetic currently duplicated in `onApplyDamage` / `onApplyCastEffect` moves into one pure helper; local-apply behavior (temp HP absorbs damage first; healing caps at max) must stay identical.
- No `npm run format`/`prettier`/`npm install`/`npm update`; `npm run build` needs Foundry closed (re-confirm); vitest via `tail`/redirect, never `| grep`.
- Mandatory whole-branch review; GATED dev-world check with a **non-GM player seat** as the primary acceptance test.

## 4. Architecture

**Pure** (`src/combat/apply-relay.ts`): `RelayRequest` union (`damage` | `healing` with `amount`; `condition` with `conditionId`; `unequip`), each with `targetUuid`; `validateRelayRequest(raw: unknown): RelayRequest | null`; `hpDamageUpdate(hp, amount)` / `hpHealingUpdate(hp, amount)` returning the `actor.update` payload (the existing arithmetic, moved); `relayLogKey(request)` → i18n key + format data for the GM log.

**Foundry glue** (`src/relay/`):
- `apply-effect.ts` — `applyEffectLocally(actor, request)`: the single place that performs each kind (hp update, `toggleStatusEffect(id,{active:true})`, unequip the target's equipped weapon — the existing `resolveTargetEquippedWeapon`/`unequipWeapon` helpers are reused).
- `relay-client.ts` — `requestApply(targetActor, request)`: GM or owner → `applyEffectLocally`; else no active GM → warn `relay.noGmWarning`; else `await game.users.activeGM.query("adnd2e.applyEffect", request, { timeout })` and warn `relay.failedWarning` / `relay.declinedWarning` on rejection. Timeout 60 s in auto mode, 5 min in approve mode is unnecessary on the client (it can't read the GM's choice cheaply) — use a single generous timeout (120 s).
- `relay-handler.ts` — `registerRelayQuery()` (called in `init`): sets `CONFIG.queries["adnd2e.applyEffect"]` to `(data, { user }) => …`: returns `{ applied: false, reason: "notActiveGm" }` unless `game.user.isActiveGM`; validates; resolves the actor (`fromUuid`); in `"approve"` mode awaits `DialogV2.confirm` (declined → `{ applied: false, reason: "declined" }`); calls `applyEffectLocally`; whispers the GM log; returns `{ applied: true }`.
- The setting is registered alongside the others in `src/settings/index.ts` (a string choice setting; not part of `OptionalRules`).

**Callers:** `onApplyDamage`/`onApplyCastEffect` loop their targets through `requestApply`; the maneuver branch in `rollAttack` calls `requestApply` instead of its owner-only guard; the creature damage roll posts a new `templates/chat/creature-damage.hbs` card (formula, total, and the existing `data-action="applyDamage"` button, so `onApplyDamage` handles it) for both the normal and the crit path, keeping the roll attached and the roll mode applied.

## 5. Error handling

Every failure is a warning toast on the requesting player's client after the card is posted; nothing throws out of a button handler. Unknown/malformed requests are rejected by the GM handler. If the only connected GM is not the active GM, `activeGM` still resolves to the one designated active GM.

## 6. Testing

Pure: validation (every kind, every rejection), HP math (temp HP absorption, zero temp, healing cap, healing when hp has no temp), log key. Dev world: GM seat unchanged; player seat in auto and approve mode for weapon damage, spell damage and healing, a maneuver condition, and a disarm; no-GM case; creature Apply button (normal and crit).

## 7. Out of scope

Undo of relayed applies (the GM edits HP); relaying other writes (item transfers, token movement); damage types/resistances.
