# SP18 Plan C — Damage Resistance by Enchantment, and Ch'i Attacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Monster NPC can be "hit only by magical / +1 ... +5 or better weapons"; PC weapon attacks and martial arts attacks that fail that requirement hit for no effect (the card says so); and the Ch'i Attacks maneuver gives unarmed hits a magical enchantment rank by level (PHBR15 Table 20).

**Architecture:** A pure `src/core/enchantment/` module (requirement ranks, weapon rank, ch'i rank, attack rank, `canHarm`). One new creature field `details.hitRequirement` with a sheet select. `resolveTargetCombatInfo` also returns the target's requirement. The weapon attack card and both martial arts card builders gain an `ineffective` path that suppresses damage, effects and stun prompts. The registry's Ch'i row becomes a known constant in the view with a current-level result in the "Always in effect" summary.

**Tech Stack:** TypeScript, Foundry VTT v14, Handlebars, vitest, the headless-Foundry harness.

**Spec:** `docs/superpowers/specs/2026-10-14-adnd2e-sp18c-chi-damage-resistance-design.md`

## Global Constraints

- Ranks: none 0, magical 1, +1 2, +2 3, +3 4, +4 5, +5 6. Requirement ids: `""`, `magical`, `plus1`..`plus5` (`HIT_REQUIREMENTS`). `requirementRank` maps them to 0..6 (unknown -> 0). `weaponRank(magicBonus) = magicBonus >= 1 ? magicBonus + 1 : 0`. `chiRank(level)`: <1 -> 0; 1-4 -> 1; 5-9 -> 2; 10-14 -> 3; 15-19 -> 4; >=20 -> 5. `attackRank` = max(weaponRank(weapon), weaponRank(ammo) when ammunition is used, chiRank(chiLevel) when chiLevel is non-null). `canHarm(rank, requirement) = rank >= requirementRank(requirement)`.
- Behaviour: the attack rolls to hit normally; only a HIT that fails the requirement is ineffective. Ineffective weapon hit: no Roll Damage button, no called-shot/maneuver effect applied, no maneuver label. Ineffective martial arts hit: damage 0, no Apply Damage, no blow/formula line, no outcome text, no condition effects, no stun prompt. A miss is unchanged. No targeted token (typed-in AC) = no requirement.
- Only `creature` actors carry a requirement (`details.hitRequirement`, default `""`); player characters and Character NPCs never do. Spells, breath weapons, psionics, silver/cold iron, creatures as attackers are out of scope.
- Ch'i: known when `mental:4` is in `knownManeuvers` on ANY owned style; applies to unarmed martial arts attack and maneuver cards only, using the character's highest class level; a wielded weapon attack uses the weapon rank only. The "Always in effect" summary order becomes mental:2, 3, 4, 5, 6 and the Ch'i row shows the current result (`ADND2E.martialChi.rank0..rank5`).
- Copy: chat line = `ADND2E.chat.attack.noEffect` / `ADND2E.chat.martialArts.noEffect` ("No effect. This creature can only be harmed by:") followed by the localized requirement label; labels `ADND2E.hitRequirements.{none,magical,plus1..plus5}` = "None", "Magical weapons", "+1 or better weapons", "+2 or better weapons", "+3 or better weapons", "+4 or better weapons", "+5 or better weapons".
- No new setting. The creature field has defaults only (no migration, no version bump). Labels must not end in an ellipsis; reuse existing CSS classes only.
- Foundry may be running: check builds with `npx vite build --outDir "C:\Users\Apera\AppData\Local\Temp\claude\c--Users-Apera-OneDrive-Dev-foundry\4f2b5a89-bbac-4b6c-bf25-1896969d1275\scratchpad\dist-check" --emptyOutDir`; never build into dist/ and never `npm run build` unless Foundry is closed. If vitest under Git Bash fails EVERY file with "Cannot read properties of undefined (reading 'config')", run it through the PowerShell tool with the Windows path.
- Before opening a PR: `npm run lint`, `npm run typecheck`, `npm run test:coverage` (100% statements), a build check. Plain ASCII in comments (an invalid UTF-8 byte breaks only the build). Files may be CRLF: prefer the Edit tool; with core.autocrlf=true check `git diff --stat` for whole-file churn before committing. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Branch: `feat/sp18c-chi-damage-resistance` (holds the spec).

---

### Task 1: Pure enchantment rules

**Files:**
- Create: `src/core/enchantment/rank.ts`, `src/core/enchantment/index.ts`
- Modify: `src/core/index.ts` (add `export * from "./enchantment";` after the `./martial-arts` line)
- Create: `tests/core/enchantment/rank.test.ts`

**Interfaces — produces:**
```ts
export const HIT_REQUIREMENTS: readonly ["", "magical", "plus1", "plus2", "plus3", "plus4", "plus5"];
export type HitRequirement = (typeof HIT_REQUIREMENTS)[number];
export function requirementRank(requirement: string): number;
export function weaponRank(magicBonus: number): number;
export function chiRank(level: number): number;
export function attackRank(input: { weaponMagicBonus?: number; ammoMagicBonus?: number; chiLevel?: number | null }): number;
export function canHarm(attackRank: number, requirement: string): boolean;
export function requirementLabelKey(requirement: string): string;   // ADND2E.hitRequirements.<none|magical|plusN>
export function chiRankLabelKey(rank: number): string;              // ADND2E.martialChi.rank<0..5>
```

- [ ] **Step 1: Write the failing tests**

`tests/core/enchantment/rank.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  HIT_REQUIREMENTS, attackRank, canHarm, chiRank, chiRankLabelKey, requirementLabelKey, requirementRank, weaponRank,
} from "../../../src/core/enchantment";

describe("requirementRank", () => {
  it.each([["", 0], ["magical", 1], ["plus1", 2], ["plus2", 3], ["plus3", 4], ["plus4", 5], ["plus5", 6], ["bogus", 0]])(
    "%s -> %i", (req, rank) => expect(requirementRank(req)).toBe(rank),
  );
  it("lists the seven requirement ids in order", () => {
    expect([...HIT_REQUIREMENTS]).toEqual(["", "magical", "plus1", "plus2", "plus3", "plus4", "plus5"]);
  });
});

describe("weaponRank", () => {
  it.each([[-1, 0], [0, 0], [1, 2], [2, 3], [3, 4], [5, 6]])("+%i weapon -> rank %i", (bonus, rank) => {
    expect(weaponRank(bonus)).toBe(rank);
  });
});

describe("chiRank - PHBR15 Table 20", () => {
  it.each([
    [0, 0], [-3, 0], [1, 1], [4, 1], [5, 2], [9, 2], [10, 3], [14, 3], [15, 4], [19, 4], [20, 5], [27, 5],
  ])("level %i -> rank %i", (level, rank) => expect(chiRank(level)).toBe(rank));
});

describe("attackRank", () => {
  it("is the best of weapon, ammunition and ch'i", () => {
    expect(attackRank({})).toBe(0);
    expect(attackRank({ weaponMagicBonus: 1 })).toBe(2);
    expect(attackRank({ weaponMagicBonus: 1, ammoMagicBonus: 3 })).toBe(4);
    expect(attackRank({ weaponMagicBonus: 3, ammoMagicBonus: 0 })).toBe(4);
    expect(attackRank({ weaponMagicBonus: 0, chiLevel: 10 })).toBe(3);
    expect(attackRank({ weaponMagicBonus: 4, chiLevel: 5 })).toBe(5);
  });
  it("ignores ch'i when no ch'i level is given", () => {
    expect(attackRank({ weaponMagicBonus: 0, chiLevel: null })).toBe(0);
  });
});

describe("canHarm", () => {
  const reqs = ["", "magical", "plus1", "plus2", "plus3", "plus4", "plus5"];
  it("an attack harms exactly the requirements at or below its rank", () => {
    for (let rank = 0; rank <= 6; rank++) {
      reqs.forEach((req, i) => expect(canHarm(rank, req), `rank ${rank} vs ${req || "none"}`).toBe(rank >= i));
    }
  });
  it("a plain sword cannot harm a magical-only creature; a +1 sword can; a level 3 ch'i fist can too", () => {
    expect(canHarm(attackRank({ weaponMagicBonus: 0 }), "magical")).toBe(false);
    expect(canHarm(attackRank({ weaponMagicBonus: 1 }), "magical")).toBe(true);
    expect(canHarm(attackRank({ chiLevel: 3 }), "magical")).toBe(true);
    expect(canHarm(attackRank({ chiLevel: 3 }), "plus1")).toBe(false);
    expect(canHarm(attackRank({ chiLevel: 9 }), "plus2")).toBe(false);
    expect(canHarm(attackRank({ chiLevel: 10 }), "plus2")).toBe(true);
  });
});

describe("label keys", () => {
  it("maps requirements and ch'i ranks to lang keys", () => {
    expect(requirementLabelKey("")).toBe("ADND2E.hitRequirements.none");
    expect(requirementLabelKey("magical")).toBe("ADND2E.hitRequirements.magical");
    expect(requirementLabelKey("plus3")).toBe("ADND2E.hitRequirements.plus3");
    expect(chiRankLabelKey(0)).toBe("ADND2E.martialChi.rank0");
    expect(chiRankLabelKey(5)).toBe("ADND2E.martialChi.rank5");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/core/enchantment`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/core/enchantment/rank.ts`:
```ts
// Weapon enchantment ranks: what a physical attack can harm. Pure.
//   rank 0 = nonmagical / bare fists, 1 = "magical" (ch'i at levels 1-4), 2 = +1, ... 6 = +5.

export const HIT_REQUIREMENTS = ["", "magical", "plus1", "plus2", "plus3", "plus4", "plus5"] as const;
export type HitRequirement = (typeof HIT_REQUIREMENTS)[number];

/** The rank a creature's "hit only by" requirement needs; unknown ids need nothing. */
export function requirementRank(requirement: string): number {
  const i = (HIT_REQUIREMENTS as readonly string[]).indexOf(requirement);
  return i === -1 ? 0 : i;
}

/** A +N weapon (N >= 1) has rank N + 1; +0 and nonmagical weapons have rank 0. */
export function weaponRank(magicBonus: number): number {
  return magicBonus >= 1 ? magicBonus + 1 : 0;
}

/** PHBR15 Table 20: unarmed martial arts hits by character level (magical, +1, +2, +3, +4). */
export function chiRank(level: number): number {
  if (level < 1) return 0;
  if (level <= 4) return 1;
  if (level <= 9) return 2;
  if (level <= 14) return 3;
  if (level <= 19) return 4;
  return 5;
}

/** The best of the wielded weapon, the ammunition (missile attacks) and ch'i (unarmed attacks, when a level is given). */
export function attackRank(input: { weaponMagicBonus?: number; ammoMagicBonus?: number; chiLevel?: number | null }): number {
  const ranks = [weaponRank(input.weaponMagicBonus ?? 0)];
  if (input.ammoMagicBonus !== undefined) ranks.push(weaponRank(input.ammoMagicBonus));
  if (input.chiLevel !== undefined && input.chiLevel !== null) ranks.push(chiRank(input.chiLevel));
  return Math.max(...ranks);
}

export function canHarm(attackRankValue: number, requirement: string): boolean {
  return attackRankValue >= requirementRank(requirement);
}

export function requirementLabelKey(requirement: string): string {
  return `ADND2E.hitRequirements.${requirement === "" ? "none" : requirement}`;
}

export function chiRankLabelKey(rank: number): string {
  return `ADND2E.martialChi.rank${rank}`;
}
```
`src/core/enchantment/index.ts`: `export * from "./rank";`. `src/core/index.ts`: add `export * from "./enchantment";`.

- [ ] **Step 4: Run to verify it passes, then typecheck and build check**

Run: `npx vitest run tests/core/enchantment tests/core/index.test.ts && npm run typecheck` then the build check.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core tests/core/enchantment
git commit -m "feat(enchantment): requirement ranks, weapon rank, ch'i rank and canHarm (SP18 Plan C)"
```

---

### Task 2: Creature `hitRequirement` field, sheet select and target resolution

**Files:**
- Modify: `src/data/actor/creature.ts` (field in `details`)
- Modify: `src/data/item/choices.ts` (re-export `HIT_REQUIREMENTS`)
- Modify: `src/config.ts` (label map `hitRequirements`; interface entry + frozen config) and `tests/config/build-config.test.ts`
- Modify: `src/sheets/creature/context-types.ts`, `src/sheets/creature/context.ts` (carry the value) and the creature sheet class (expose the label map for the select, following how `details.size`/alignment selects are built)
- Modify: `templates/actor/creature/left.hbs` (select beside Magic Resistance)
- Modify: `src/sheets/character/combat-rolls.ts` (`resolveTargetCombatInfo` returns `hitRequirement`)
- Modify: `lang/en.json` (`ADND2E.hitRequirements.*`, `ADND2E.sheet.creature.hitRequirement`)
- Modify tests: `tests/sheets/creature/context.test.ts`, `tests/templates/creature-sheet-bindings.test.ts`, `tests/lang/en-coverage.test.ts`; create `tests/data/hit-requirement.test.ts`

**Interfaces — consumes:** `HIT_REQUIREMENTS` (Task 1). **Produces:** `system.details.hitRequirement`; `resolveTargetCombatInfo(...)` returning `{ ac, size, hitRequirement }`; `CONFIG.ADND2E.hitRequirements` label map.

- [ ] **Step 1: Write the failing tests**

`tests/data/hit-requirement.test.ts` (source-pinned, like `martial-style-model.test.ts`):
```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HIT_REQUIREMENTS } from "../../src/core/enchantment";
import { HIT_REQUIREMENTS as CHOICES } from "../../src/data/item/choices";

const SRC = readFileSync(path.resolve(__dirname, "..", "..", "src", "data", "actor", "creature.ts"), "utf8");
const COMBAT = readFileSync(path.resolve(__dirname, "..", "..", "src", "sheets", "character", "combat-rolls.ts"), "utf8");

describe("creature hitRequirement (SP18 Plan C)", () => {
  it("is a blank-able choice of the pure requirement ids, default none", () => {
    const line = SRC.split("\n").find((l) => /^\s*hitRequirement:\s*new /.test(l)) ?? "";
    expect(line).toContain("blank: true");
    expect(line).toContain('initial: ""');
    expect(line).toContain("choices: HIT_REQUIREMENTS");
  });
  it("re-exports the pure vocabulary", () => {
    expect([...CHOICES]).toEqual([...HIT_REQUIREMENTS]);
  });
  it("target resolution returns the requirement (creature only)", () => {
    expect(COMBAT).toContain("hitRequirement");
  });
});
```
Add to `tests/sheets/creature/context.test.ts` (copy the shape of its existing `magicResistance` assertion): the built context's `details.hitRequirement` equals the input value (`"plus2"`) and defaults through. In `tests/templates/creature-sheet-bindings.test.ts` add: left.hbs contains `name="system.details.hitRequirement"` inside the unlocked branch and a read-only display in the locked branch. In `tests/config/build-config.test.ts` add `hitRequirements` to the key list and an `assertLabelMap("hitRequirements", [...HIT_REQUIREMENTS])`-style check following how `trackingTerrains` is asserted there. In `tests/lang/en-coverage.test.ts` require `ADND2E.sheet.creature.hitRequirement` and `ADND2E.hitRequirements.{none,magical,plus1,plus2,plus3,plus4,plus5}`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/data tests/sheets tests/templates tests/config tests/lang`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/data/item/choices.ts`: `export { HIT_REQUIREMENTS } from "../../core/enchantment";` (typed as `readonly string[]` consumer-side if the file's convention does that).
`src/data/actor/creature.ts`: import `HIT_REQUIREMENTS` from `"../item/choices"` and add inside `details` next to `magicResistance`:
```ts
        /** SP18 Plan C: the minimum weapon enchantment that can harm this creature ("" = any weapon). Defaults only, no migration. */
        hitRequirement: new StringField({ required: true, blank: true, initial: "", choices: HIT_REQUIREMENTS }),
```
`src/config.ts`: add the `hitRequirements` label map (ids `""`->`ADND2E.hitRequirements.none`, `magical`, `plus1`..`plus5`) following the `trackingTerrains` entries (interface `LabelMap<HitRequirement>` entry + frozen config). Creature context types/context: add `hitRequirement: string` to both `details` shapes (input and output) and pass it through (`hitRequirement: input.details.hitRequirement`). Creature sheet: add the select options the same way the size/alignment selects are provided (find them with `grep -rn "alignment\|sizes" src/sheets/creature/sheet.ts templates/actor/creature/left.hbs`) and wire the data in `_prepareContext`. `templates/actor/creature/left.hbs` — after the Magic Resistance block add:
```hbs
      <div class="detail-field">
        <span class="cap">{{localize 'ADND2E.sheet.creature.hitRequirement'}}</span>
        {{#if adnd2e.lock.unlocked}}
          <select name="system.details.hitRequirement">{{selectOptions <the same options source the other selects use for hitRequirements> selected=source.system.details.hitRequirement localize=true}}</select>
        {{else}}
          <span class="val">{{#if source.system.details.hitRequirement}}{{adnd2eLabel 'hitRequirements' source.system.details.hitRequirement}}{{else}}{{localize 'ADND2E.hitRequirements.none'}}{{/if}}</span>
        {{/if}}
      </div>
```
(Fill the `selectOptions` source from the context you added: the select must list all seven requirements including "None" for `""`; `adnd2eLabel` takes a CONFIG.ADND2E map name.)
`src/sheets/character/combat-rolls.ts` — `resolveTargetCombatInfo`: widen the return type to `{ ac: number; size: string | null; hitRequirement: string }` and return `hitRequirement: sys.details?.hitRequirement ?? ""` for `creature` (widen the `sys` cast's `details` to include `hitRequirement?: string`) and `hitRequirement: ""` for every other actor type. (Callers that destructure only ac/size are unaffected.)
`lang/en.json`: `ADND2E.hitRequirements` = `{ "none": "None", "magical": "Magical weapons", "plus1": "+1 or better weapons", "plus2": "+2 or better weapons", "plus3": "+3 or better weapons", "plus4": "+4 or better weapons", "plus5": "+5 or better weapons" }` as a sibling of `trackingTerrains`; `ADND2E.sheet.creature.hitRequirement` = "Hit only by" next to `magicResistance`. Note: `config.ts` label map key for the blank id is `""` — if CONFIG label maps cannot use an empty key, key the "none" entry as `none` in the map and have the template/context map `""` -> `"none"` for display; keep the stored value `""`. Add the same `martialChi` rank labels in Task 4, not here.

- [ ] **Step 4: Run to verify they pass, then typecheck, lint and build check**

Run: `npx vitest run tests/data tests/sheets tests/templates tests/config tests/lang tests/core && npm run typecheck` then `npx eslint` on the changed files and the build check.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src templates lang tests
git commit -m "feat(creature): hit-only-by enchantment requirement on Monster NPCs and target resolution (SP18 Plan C)"
```

---

### Task 3: Weapon attacks — ineffective hits

**Files:**
- Modify: `src/combat/card-types.ts` (`ineffective`), `src/combat/attack-card.ts` (pass it through)
- Modify: `src/sheets/character/combat-rolls.ts` (`rollAttack`)
- Modify: `templates/chat/attack-roll.hbs`
- Modify: `lang/en.json` (`ADND2E.chat.attack.noEffect`)
- Modify tests: `tests/combat/attack-card.test.ts`, `tests/lang/en-coverage.test.ts`, `tests/templates/` (a new `attack-no-effect-bindings.test.ts`)

**Interfaces — consumes:** `attackRank`, `canHarm`, `requirementLabelKey` (Task 1); `resolveTargetCombatInfo(...).hitRequirement` (Task 2). **Produces:** `AttackCardInput.ineffective?: { requirementKey: string } | null` and `AttackCardContext.ineffective: { requirementKey: string } | null`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/combat/attack-card.test.ts` (use that file's existing base input helper; the snippet shows the intent):
```ts
describe("ineffective hits (SP18 Plan C)", () => {
  it("defaults to null and passes a requirement through", () => {
    expect(buildAttackCardContext({ ...baseInput }).ineffective).toBeNull();
    const ctx = buildAttackCardContext({ ...baseInput, ineffective: { requirementKey: "ADND2E.hitRequirements.plus1" } });
    expect(ctx.ineffective).toEqual({ requirementKey: "ADND2E.hitRequirements.plus1" });
  });
});
```
(`baseInput` = whichever const that file already builds for a valid input; add `ineffective` only in the second case.) New `tests/templates/attack-no-effect-bindings.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const TPL = read("templates", "chat", "attack-roll.hbs");
const ROLLS = read("src", "sheets", "character", "combat-rolls.ts");
const LANG = JSON.parse(read("lang", "en.json")) as { ADND2E: { chat: { attack: Record<string, string> } } };

describe("weapon attack no-effect bindings (SP18 Plan C)", () => {
  it("the card shows the requirement line and hides Roll Damage for an ineffective hit", () => {
    expect(TPL).toContain("ineffective");
    expect(TPL).toContain("ADND2E.chat.attack.noEffect");
    expect(TPL).toContain("ineffective.requirementKey");
  });
  it("rollAttack checks the requirement with attackRank/canHarm and drops the damage context and maneuver effect", () => {
    expect(ROLLS).toContain("canHarm(");
    expect(ROLLS).toContain("attackRank(");
    expect(ROLLS).toContain("requirementLabelKey(");
  });
  it("the copy exists", () => {
    expect(LANG.ADND2E.chat.attack.noEffect).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/combat tests/templates tests/lang`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/combat/card-types.ts`: add to `AttackCardInput` `ineffective?: { requirementKey: string } | null;` (doc: "a hit that cannot harm the target: damage is not offered") and to `AttackCardContext` `ineffective: { requirementKey: string } | null;`.
`src/combat/attack-card.ts`: return `ineffective: input.ineffective ?? null,` in the context.
`templates/chat/attack-roll.hbs`: replace the `{{#if (and hit damageContext)}}` Roll Damage block's guard with the same condition (it already requires `damageContext`, which Task 3 sets to null when ineffective) and add before it, after the modifier list:
```hbs
  {{#if (and hit ineffective)}}
    <p class="result miss">{{localize 'ADND2E.chat.attack.noEffect'}} {{localize ineffective.requirementKey}}</p>
  {{/if}}
```
`lang/en.json`: `ADND2E.chat.attack.noEffect` = "No effect. This creature can only be harmed by:" (beside the other `chat.attack` keys).
`src/sheets/character/combat-rolls.ts` (`rollAttack`):
- import `attackRank, canHarm, requirementLabelKey` from `"../../core/enchantment"`.
- Where the single target is resolved (the `targets.length === 1` branch that calls `resolveTargetCombatInfo`), also keep `targetHitRequirement = info.hitRequirement` (declare `let targetHitRequirement = "";` next to `targetSize`).
- After `hit` is known and BEFORE `maneuverEffect` is computed, add:
```ts
  const ammoItem = ammoToConsume ? actor.items.get(ammoToConsume.id) : undefined;
  const rank = attackRank({
    weaponMagicBonus: weapon.system.magicBonus,
    ...(ammoItem ? { ammoMagicBonus: Number((ammoItem.system as { magicBonus?: number }).magicBonus ?? 0) } : {}),
  });
  const ineffective = hit.hit && !canHarm(rank, targetHitRequirement);
```
- Make the maneuver effect conditional: `const maneuverEffect = ineffective ? null : resolveManeuverOutcome(effectiveManeuverId, baseHit.hit || helpless);`
- In `buildAttackCardContext({...})` pass `ineffective: ineffective ? { requirementKey: requirementLabelKey(targetHitRequirement) } : null`, set `maneuverLabel: ... && !ineffective ? ... : null` (the existing expression already keys off `maneuverEffect`, so it follows), and make `damageContext: hit.hit && !ineffective ? { ... } : null`.
(A crit/fumble label may still show; the damage is what is suppressed.)

- [ ] **Step 4: Run to verify they pass, then typecheck, lint and build check**

Run: `npx vitest run tests/combat tests/templates tests/lang tests/sheets && npm run typecheck`; `npx eslint src/combat src/sheets/character/combat-rolls.ts`; the build check.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src templates lang tests
git commit -m "feat(combat): weapon hits below a creature's enchantment requirement have no effect (SP18 Plan C)"
```

---

### Task 4: Martial arts — ineffective hits and Ch'i Attacks

**Files:**
- Modify: `src/core/martial-arts/card.ts` (ineffective on `buildMartialCardContext` and `buildManeuverCardContext`)
- Modify: `src/core/martial-arts/view.ts` (`constants.chi`; Ch'i summary row with the current result)
- Modify: `src/sheets/character/martial-arts-actions.ts` (target requirement, ch'i level, `ineffective`)
- Modify: `templates/chat/martial-arts-attack.hbs`, `templates/actor/pc/partials/pc-main-panels.hbs` (summary result)
- Modify: `lang/en.json` (`ADND2E.chat.martialArts.noEffect`, `ADND2E.martialChi.rank0..rank5`, reworded `martialManeuverEffects.chiAttacks`)
- Modify tests: `tests/core/martial-arts/card.test.ts`, `maneuver-view.test.ts`, `tests/templates/martial-maneuvers-bindings.test.ts`, `tests/lang/martial-maneuver-labels.test.ts`

**Interfaces — consumes:** Tasks 1-2. **Produces:**
```ts
// MartialCardInput and ManeuverCardInput gain: ineffective?: { requirementKey: string } | null
// MartialCardContext and ManeuverCardContext gain: ineffective: { requirementKey: string } | null
// MartialConstants gains: chiKnown: boolean; chiRank: number
// MartialConstants.summary items gain: detailKey?: string    (the Ch'i row: ADND2E.martialChi.rank<n>)
// buildMartialArtsView input already has level; the summary uses it
```

- [ ] **Step 1: Write the failing tests**

Append to `tests/core/martial-arts/card.test.ts` (reuse its `attackInput` and `maneuverInput` helpers; add imports as needed):
```ts
describe("ineffective martial arts hits (SP18 Plan C)", () => {
  const req = { requirementKey: "ADND2E.hitRequirements.plus1" };
  it("the plain card: damage 0, no blow line, no stun prompt, requirement passed through", () => {
    const hit = resolveMartialAttack({ ...attackInput, naturalD20: 20 }); // natural 20 hits and would stun
    const ctx = buildMartialCardContext({ actorName: "A", actorImg: "", styleName: "S", targetName: "Wraith", result: hit, ineffective: req });
    expect(ctx.ineffective).toEqual(req);
    expect(ctx.damage).toBe(0);
    expect(ctx.blowKey).toBe("");
    expect(ctx.stunTrigger).toBe(false);
  });
  it("the plain card without a requirement is unchanged", () => {
    const hit = resolveMartialAttack({ ...attackInput, naturalD20: 14 });
    const ctx = buildMartialCardContext({ actorName: "A", actorImg: "", styleName: "S", targetName: null, result: hit });
    expect(ctx.ineffective).toBeNull();
    expect(ctx.blowKey).not.toBe("");
  });
  it("a maneuver card: no damage, formula, effects, stun or outcome text", () => {
    const result = resolveManeuverAttack({
      maneuverId: "vitalArea:3", naturalD20: 20, thac0: 20, targetAc: 10, attackerArmorType: "none", opponentWeaponSize: null,
      situationalModifier: 0, targetArmorGroup: "none", styleDie: "1d4", level: 5, strengthAdj: 1,
    });
    const ctx = buildManeuverCardContext({
      actorName: "A", actorImg: "", styleName: "S", targetName: "Wraith", result, damageTotal: 4, ineffective: req,
    });
    expect(ctx.ineffective).toEqual(req);
    expect(ctx.effects).toEqual([]);
    expect(ctx.damage).toBe(0);
    expect(ctx.formula).toBe("");
    expect(ctx.stunTrigger).toBe(false);
    expect(ctx.outcomeKey).toBe("");
  });
});
```
Append to `tests/core/martial-arts/maneuver-view.test.ts` (reuse its `style`/`view` helpers from the constants describe):
```ts
describe("ch'i constants (SP18 Plan C)", () => {
  it("known ch'i reports its rank at the character's level and lists the summary row between mental 3 and 5", () => {
    const v = buildMartialArtsView({
      enabled: true, knowsBasics: true, storedActiveId: "", canAct: true, level: 10, freeSlots: 2,
      items: [style(["mental:3", "mental:4", "mental:5"])],
    });
    expect(v.constants).toMatchObject({ chiKnown: true, chiRank: 3 });
    expect(v.constants.summary.map((s) => s.nameKey)).toEqual([
      "ADND2E.martialManeuvers.mentalResistance", "ADND2E.martialManeuvers.chiAttacks", "ADND2E.martialManeuvers.blindFighting",
    ]);
    expect(v.constants.summary[1]).toMatchObject({ effectKey: "ADND2E.martialManeuverEffects.chiAttacks", detailKey: "ADND2E.martialChi.rank3" });
  });
  it("unknown ch'i has rank 0 flag false and no row", () => {
    const v = buildMartialArtsView({ enabled: true, knowsBasics: true, storedActiveId: "", canAct: true, level: 10, freeSlots: 2, items: [style(["mental:2"])] });
    expect(v.constants).toMatchObject({ chiKnown: false, chiRank: 0 });
    expect(v.constants.summary.some((s) => s.nameKey.endsWith("chiAttacks"))).toBe(false);
  });
});
```
(`style(known)` is the helper from that file's "constants" describe; if it is scoped inside it, hoist it to module scope in this edit.) In `tests/templates/martial-maneuvers-bindings.test.ts` add: the chat template contains `ineffective` and `ADND2E.chat.martialArts.noEffect`; the actions file references `canHarm(`, `attackRank(` and `chiLevel`; the Main panel summary renders `c.detailKey`. In `tests/lang/martial-maneuver-labels.test.ts` require `chat.martialArts.noEffect` and `martialChi.rank0..rank5`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/core/martial-arts tests/templates tests/lang`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/core/martial-arts/card.ts`:
- add `ineffective?: { requirementKey: string } | null;` to `MartialCardInput` and `ManeuverCardInput`; `ineffective: { requirementKey: string } | null;` to `MartialCardContext` and `ManeuverCardContext` (and the `SkillCardContext` base object gets `ineffective: null`);
- `buildMartialCardContext`: `const ineffective = r.hit ? (input.ineffective ?? null) : null;` then `ineffective,` in the result with `damage: ineffective ? 0 : r.damage`, `blowKey: ineffective || !r.blow ? "" : \`ADND2E.martialBlows.${r.blow}\``, `stunTrigger: !ineffective && r.hit && r.stunTrigger`;
- `buildManeuverCardContext`: `const ineffective = r.hit ? (input.ineffective ?? null) : null;` then `effects: ineffective ? [] : effects`, `damage: ineffective ? 0 : <existing>`, `formula: ineffective ? "" : <existing>`, `stunTrigger: !ineffective && <existing>`, `outcomeKey: ineffective ? "" : <existing>`, `blowKey` as is but blank when ineffective, plus `ineffective,`.
`src/core/martial-arts/view.ts`:
- import `chiRank, chiRankLabelKey` from `"../enchantment"`;
- add `chiKnown: boolean; chiRank: number;` to `MartialConstants` and `detailKey?: string` to the summary item type;
- extend `SUMMARY` to `[["mental:2","allAroundSight"],["mental:3","mentalResistance"],["mental:4","chiAttacks"],["mental:5","blindFighting"],["mental:6","ironskin"]]` and set `detailKey: chiRankLabelKey(chiRank(input.level ?? 0))` on the `chiAttacks` item only; set `chiKnown: knownIds.has("mental:4")` and `chiRank: chiKnown ? chiRank(input.level ?? 0) : 0`.
`templates/actor/pc/partials/pc-main-panels.hbs`: in the constants summary line render the detail: `<p class="hint"><strong>{{localize c.nameKey}}</strong> - {{localize c.effectKey}}{{#if c.detailKey}} ({{localize c.detailKey}}){{/if}}</p>`.
`templates/chat/martial-arts-attack.hbs`: inside the `{{#if hit}}` block, before the blow/formula lines, add:
```hbs
    {{#if ineffective}}<p class="result miss">{{localize 'ADND2E.chat.martialArts.noEffect'}} {{localize ineffective.requirementKey}}</p>{{/if}}
```
`src/sheets/character/martial-arts-actions.ts`:
- imports: `attackRank, canHarm, requirementLabelKey` from `"../../core/enchantment"`;
- add `hitRequirement: string` to `TargetInfo` (`resolveTarget`: `hitRequirement: info.hitRequirement` in the single-target branch, `""` for the typed-AC branch);
- a helper `ineffectiveFor(target: TargetInfo, chiLevel: number | null, hit: boolean)` returning `{ requirementKey } | null`: `hit && !canHarm(attackRank({ chiLevel }), target.hitRequirement) ? { requirementKey: requirementLabelKey(target.hitRequirement) } : null` (unarmed rank is ch'i only);
- in `rollMartialArtsAttack` and `useManeuver` compute `const chiLevel = view.constants.chiKnown ? characterLevel(actor) : null;` and pass `ineffective: ineffectiveFor(target, chiLevel, result.hit)` into `buildMartialCardContext` / `buildManeuverCardContext`.
`lang/en.json`: `ADND2E.chat.martialArts.noEffect` = "No effect. This creature can only be harmed by:"; new top-level map `ADND2E.martialChi`: `rank0` "not yet magical", `rank1` "a magical weapon", `rank2` "a +1 magical weapon", `rank3` "a +2 magical weapon", `rank4` "a +3 magical weapon", `rank5` "a +4 magical weapon"; and `martialManeuverEffects.chiAttacks` = "Always in effect: your unarmed hits count as a magical weapon by level (magical, then +1 at level 5, +2 at 10, +3 at 15, +4 at 20), so they can harm creatures that need magic to hit."

- [ ] **Step 4: Run to verify they pass, then typecheck, lint and build check**

Run: `npx vitest run tests/core tests/templates tests/styles tests/lang tests/combat tests/sheets tests/data && npm run typecheck`; `npx eslint src/core/martial-arts src/sheets/character/martial-arts-actions.ts`; the build check.
Expected: PASS (B1-B3 card tests unchanged: `ineffective` defaults to null).

- [ ] **Step 5: Commit**

```bash
git add -A src templates lang tests
git commit -m "feat(martial-arts): Ch'i Attacks gives unarmed hits an enchantment rank; ineffective hits have no effect (SP18 Plan C)"
```

---

### Task 5: Gates, headless proof, README and the manual checklist

**Files:**
- Create: `.superpowers/proof/martial-c.proof.ts` (git-ignored)
- Modify: `README.md` (SP18 row only)

- [ ] **Step 1: Write the headless proof**

Create `.superpowers/proof/martial-c.proof.ts` from `.superpowers/proof/martial-b3.proof.ts` boilerplate. Assertions:
1. The real Foundry creature schema (`CreatureModel`): a blank creature cleans `details.hitRequirement` to `""`; `"plus2"` validates; `"plus6"` and `"silver"` are rejected (`DataModelValidationFailure`); an old creature source without the key cleans to `""`.
2. Rules: `attackRank({ weaponMagicBonus: 0 })` vs `"magical"` cannot harm; a +1 weapon can; ch'i level 5 vs `"plus1"` can, level 4 vs `"plus1"` cannot; ranged `attackRank({ weaponMagicBonus: 0, ammoMagicBonus: 1 })` vs `"plus1"` can.
3. Cards: render `templates/chat/attack-roll.hbs` (register `localize`, `and`, `adnd2eSigned`) with an ineffective hit context (no Roll Damage button, the no-effect line and the requirement label) and with a normal hit (the button); render `templates/chat/martial-arts-attack.hbs` for an ineffective Stunning Touch (no apply button, no stun hint, the no-effect line) and a normal one.
4. The view: Ch'i known across styles at level 10 lists the summary row with `ADND2E.martialChi.rank3`.

Run: `npx vitest run --config .superpowers/proof/vitest.proof.config.ts .superpowers/proof/martial-c.proof.ts`
Expected: PASS. A failing assertion that exposes a real defect is reported, not papered over.

- [ ] **Step 2: Run the full CI sequence**

Run, in order: `npm run lint`, `npm run typecheck`, `npm run test:coverage`, then the build check.
Expected: green; coverage statements 100%. Add a missing test rather than lowering anything.

- [ ] **Step 3: README and commit**

Update the SP18 row only: Plans A, B1-B3 and **C complete** (damage resistance by enchantment on Monster NPCs; Ch'i Attacks per Table 20); remaining: style weapons (the tight-group slot purchase) and the Mental Resistance saves / All-Around Sight rear-AC numbers. Check `git diff --stat` shows only that row (the README is CRLF; preserve it).
```bash
git add README.md
git commit -m "docs: SP18 Plan C ch'i attacks and damage resistance complete (#86)"
```

- [ ] **Step 4: Rebuild the installed system and hand the user the checklist**

If Foundry is closed: `npm run build` from THIS branch (say the branch name in the hand-off). Checklist (prerequisites stated):
1. **Setup:** rule ON (reload). A Monster NPC "Wraith" (AC 5) with a token, and a PC Fighter with a plain Long Sword (magic bonus 0) and a second +1 Long Sword; a second PC (or the same) with a style (Kung Fu) that has Ch'i Attacks learnable (offers Mental 4).
2. **Authoring:** unlock the Wraith's sheet: **Hit only by** is beside Magic Resistance; set it to **+1 or better weapons**; locked it reads that value; other creatures show "None".
3. **Plain sword:** target the Wraith and attack with the plain Long Sword. On a hit the card says "Hit" then **"No effect. This creature can only be harmed by: +1 or better weapons"** and there is NO Roll Damage button; a miss is an ordinary miss; a called-shot maneuver does not apply a condition.
4. **+1 sword:** the same attack with the +1 Long Sword offers Roll Damage normally.
5. **Typed AC:** with nothing targeted the manual-AC prompt works and no restriction applies.
6. **Ch'i:** learn Ch'i Attacks (Kung Fu, Mental 4; level up the PC to 10 via XP if needed). The "Always in effect" summary shows "Ch'i Attacks - ... (a +2 magical weapon)" matching the level (1-4 magical, 5-9 +1, 10-14 +2, 15-19 +3, 20+ +4).
7. **Ch'i vs the Wraith:** at level 5+ a plain Martial arts attack hits the +1-only Wraith for damage; at levels 1-4 it shows "No effect" (set the Wraith to "Magical weapons" and a level 1-4 monk can harm it, a character without ch'i cannot). Set the Wraith to **+2** and check level 9 fails and level 10 works.
8. **Maneuver cards:** an ineffective Stunning Touch hit shows the no-effect line with no Apply Stunned button and no stun hint.
9. **Non-GM seat:** a player sees the same cards; Apply Damage on an effective hit still goes through the relay.
10. **Unchanged:** Monster NPCs without a requirement behave exactly as before; spells are unaffected.
Reset settings between checks if a step changed them.

- [ ] **Step 5: Open the PR (always push + PR, never ask)**

```bash
git push -u origin feat/sp18c-chi-damage-resistance
gh pr create --title "feat(martial-arts): SP18 Plan C - damage resistance by enchantment and Ch'i Attacks (#86)" --body "..."
```
Body: scope (the hook, Monster NPC field, weapon and martial arts ineffective hits, Ch'i per Table 20), "Part of #86 (style weapons and the Mental Resistance / All-Around Sight numbers remain)", the rulings (a +0 magical weapon is rank 0; missile = better of launcher and ammo; ineffective hit suppresses effects too), the test plan and the checklist, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge; ask the user to hand-merge.

---

## Self-Review

**Spec coverage:** the rank table and rules (Task 1); the creature field, sheet select, label map and target requirement (Task 2); the weapon attack card ineffective path including the maneuver effect (Task 3); martial arts cards, ch'i known/level/summary and registry text (Task 4); proof, CI, README, checklist, PR (Task 5). Out-of-scope items (spells/breath/psionics, materials, Mental Resistance/All-Around Sight numbers, defenders other than creatures) are not built.

**Placeholder scan:** none; Task 2's `selectOptions` source is deliberately specified by precedent ("the same options source the other selects use") because the creature sheet's existing select wiring is read at implementation time; the PR body is the only elided string.

**Type consistency:** `HIT_REQUIREMENTS`/`requirementLabelKey`/`attackRank`/`canHarm` (Task 1) are consumed by `resolveTargetCombatInfo` (Task 2), `rollAttack` (Task 3) and the martial arts glue (Task 4); `ineffective: { requirementKey }` has the same shape on the weapon card context and both martial arts card contexts and in the templates; `MartialConstants.chiKnown/chiRank` and `summary[].detailKey` (Task 4) match the Main panel and the glue.
