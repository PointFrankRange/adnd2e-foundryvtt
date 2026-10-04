# Turn Undead Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a cleric or paladin turn undead (PHB Table 61) against targeted Monster NPC tokens, with a general monster-types field that Turn Undead reads.

**Architecture:** A pure rules core (`src/core/turning/`) resolves one d20 against each target's Table 61 row and allocates the 2d6 / 2d4 affected counts. Monster NPCs gain `details.types` (a registry-validated array, `undead` first) and `details.turning.row`. A PC-sheet action rolls, posts one chat card, and applies results through the existing player-apply relay (a new `turned` condition and a new `destroy` relay kind).

**Tech Stack:** TypeScript, Foundry VTT v14 (ApplicationV2 sheets, DataModels), Handlebars, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-adnd2e-sp10-turn-undead-design.md`

## Global Constraints

- Table 61 values are exactly the ones in the spec (read from the PHB page image, not OCR). 13 rows, 12 level columns.
- A paladin turns at class level minus 2. Druids and every other class cannot turn.
- One d20 per attempt, read per target. A numeric cell succeeds when `d20 >= cell`. `T` and `D` and `D*` succeed without a roll. A dash (`null`) means cannot.
- One attempt per character per encounter. A combat's deletion clears the flag; the GM can also reset it.
- `src/core/**`, `src/combat/**` and `src/data/item/choices.ts` stay Foundry-free (`npm run typecheck` proves it).
- Run `npm test` and `npm run typecheck` before every commit that touches code. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work on branch `feat/adnd2e-sp10-turn-undead` (already created, spec committed).
- Out of scope: evil-priest commanding, evil priests turning paladins, shaman talisman, Ghosthunter kit, Character NPC clerics.

---

## File Structure

- Create `src/core/turning/table.ts` — row ids, `TURN_TABLE`, `levelColumn`.
- Create `src/core/turning/resolve.ts` — `turnerLevel`, `turnerLevelFor`, `resolveTurn`, `allocateAffected`, `resolveAttempt`.
- Create `src/core/turning/index.ts`; modify `src/core/index.ts` (re-export).
- Create `tests/core/turning/turning.test.ts`.
- Modify `src/data/item/choices.ts` (`MONSTER_TYPE_IDS`, `TURN_ROW_CHOICES`), `src/config.ts` (label maps), `src/data/actor/creature.ts` (schema), `src/conditions.ts` + `packs/conditions/_source/turned.json` + `_MANIFEST.md` (the `turned` condition), `lang/en.json`.
- Modify `src/sheets/creature/sheet.ts`, `templates/actor/creature/statblock.hbs`, `tests/templates/creature-sheet-bindings.test.ts`.
- Modify `src/combat/apply-relay.ts`, `src/relay/apply-effect.ts`, `tests/combat/apply-relay.test.ts`.
- Create `src/combat/turn-card.ts`, `templates/chat/turn-undead-roll.hbs`, `tests/combat/turn-card.test.ts`; modify `src/combat/card-types.ts`.
- Create `src/sheets/character/turning-actions.ts`, `src/hooks/turning-hooks.ts`; modify `src/sheets/character/sheet.ts`, `templates/actor/pc/partials/pc-feature-panels.hbs`, `src/system.ts`, `tests/templates/pc-sheet-bindings.test.ts` (only if it enumerates actions).
- Modify `README.md` (status row).

---

### Task 1: Turning rules core

**Files:**
- Create: `src/core/turning/table.ts`, `src/core/turning/resolve.ts`, `src/core/turning/index.ts`
- Modify: `src/core/index.ts`
- Test: `tests/core/turning/turning.test.ts`

**Interfaces:**
- Produces (used by Tasks 2-4):
  - `TURN_ROW_IDS: readonly TurnRowId[]`, `type TurnRowId` (`"skeleton"|"zombie"|"ghoul"|"shadow"|"wight"|"ghast"|"wraith"|"mummy"|"spectre"|"vampire"|"ghost"|"lich"|"special"`)
  - `type TurnCell = number | "T" | "D" | "D*" | null`, `TURN_TABLE: Readonly<Record<TurnRowId, readonly TurnCell[]>>`, `levelColumn(level: number): number`
  - `type TurnOutcome = "cannot"|"fail"|"turned"|"destroyed"|"destroyed-bonus"`
  - `turnerLevel(chassisId: string, level: number): number | null`
  - `turnerLevelFor(classes: readonly { chassisId: string; level: number }[]): number | null`
  - `resolveTurn(d20: number, level: number, row: TurnRowId): TurnOutcome`
  - `interface TurnCandidate { id: string; row: TurnRowId; hd: number; outcome: TurnOutcome }`
  - `allocateAffected(candidates: readonly TurnCandidate[], cap: number, bonusCap: number): { affected: string[] }`
  - `interface TurnTarget { id: string; isUndead: boolean; row: TurnRowId | null; hd: number }`
  - `type TurnStatus = "notUndead"|"untagged"|"cannot"|"fail"|"turned"|"destroyed"|"unaffected"`
  - `resolveAttempt(args: { d20: number; level: number; targets: readonly TurnTarget[]; cap: number; bonusCap: number }): { id: string; status: TurnStatus }[]`

- [ ] **Step 1: Write the failing test**

Create `tests/core/turning/turning.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  TURN_ROW_IDS,
  TURN_TABLE,
  allocateAffected,
  levelColumn,
  resolveAttempt,
  resolveTurn,
  turnerLevel,
  turnerLevelFor,
} from "../../../src/core/turning";

describe("TURN_TABLE (PHB Table 61)", () => {
  it("has 13 rows of 12 level columns", () => {
    expect(TURN_ROW_IDS).toHaveLength(13);
    for (const id of TURN_ROW_IDS) expect(TURN_TABLE[id], id).toHaveLength(12);
  });
  it("matches spot-checked cells from the book", () => {
    expect(TURN_TABLE.skeleton[0]).toBe(10);
    expect(TURN_TABLE.skeleton[11]).toBe("D*");
    expect(TURN_TABLE.zombie[8]).toBe("D*");
    expect(TURN_TABLE.wight[11]).toBe("D*");
    expect(TURN_TABLE.ghast[0]).toBeNull();
    expect(TURN_TABLE.ghast[1]).toBe(20);
    expect(TURN_TABLE.lich[7]).toBe(20);
    expect(TURN_TABLE.vampire[11]).toBe(4);
    expect(TURN_TABLE.special[7]).toBeNull();
    expect(TURN_TABLE.special[8]).toBe(20);
    expect(TURN_TABLE.special[11]).toBe(13);
  });
});

describe("levelColumn", () => {
  it("maps levels to columns, clamping at 14+", () => {
    expect(levelColumn(0)).toBe(-1);
    expect(levelColumn(1)).toBe(0);
    expect(levelColumn(9)).toBe(8);
    expect(levelColumn(10)).toBe(9);
    expect(levelColumn(11)).toBe(9);
    expect(levelColumn(12)).toBe(10);
    expect(levelColumn(13)).toBe(10);
    expect(levelColumn(14)).toBe(11);
    expect(levelColumn(30)).toBe(11);
  });
});

describe("turnerLevel / turnerLevelFor", () => {
  it("clerics turn at their level, paladins two lower, nobody else", () => {
    expect(turnerLevel("cleric", 7)).toBe(7);
    expect(turnerLevel("paladin", 5)).toBe(3);
    expect(turnerLevel("paladin", 3)).toBe(1);
    expect(turnerLevel("paladin", 2)).toBeNull();
    expect(turnerLevel("druid", 9)).toBeNull();
    expect(turnerLevel("fighter", 9)).toBeNull();
  });
  it("takes the best level across an actor's classes", () => {
    expect(turnerLevelFor([{ chassisId: "fighter", level: 5 }, { chassisId: "cleric", level: 3 }])).toBe(3);
    expect(turnerLevelFor([{ chassisId: "paladin", level: 5 }, { chassisId: "cleric", level: 2 }])).toBe(3);
    expect(turnerLevelFor([{ chassisId: "mage", level: 5 }])).toBeNull();
    expect(turnerLevelFor([])).toBeNull();
  });
});

describe("resolveTurn", () => {
  it("rolls against a number: equal or higher succeeds", () => {
    expect(resolveTurn(10, 1, "skeleton")).toBe("turned");
    expect(resolveTurn(9, 1, "skeleton")).toBe("fail");
    expect(resolveTurn(4, 5, "ghoul")).toBe("turned");
    expect(resolveTurn(3, 5, "ghoul")).toBe("fail");
  });
  it("T and D need no roll", () => {
    expect(resolveTurn(1, 4, "skeleton")).toBe("turned");
    expect(resolveTurn(1, 6, "skeleton")).toBe("destroyed");
    expect(resolveTurn(1, 8, "skeleton")).toBe("destroyed-bonus");
  });
  it("a dash, or an effective level below 1, cannot turn", () => {
    expect(resolveTurn(20, 1, "ghast")).toBe("cannot");
    expect(resolveTurn(20, 8, "special")).toBe("cannot");
    expect(resolveTurn(20, 0, "skeleton")).toBe("cannot");
  });
  it("levels 14+ use the last column", () => {
    expect(resolveTurn(1, 20, "wight")).toBe("destroyed-bonus");
  });
});

describe("allocateAffected", () => {
  const c = (id: string, hd: number, outcome: "turned" | "destroyed" | "destroyed-bonus" = "turned", row: "skeleton" | "zombie" = "skeleton") =>
    ({ id, row, hd, outcome }) as const;
  it("affects the lowest Hit Dice first, up to the cap", () => {
    expect(allocateAffected([c("a", 3), c("b", 1), c("c", 2)], 2, 0).affected).toEqual(["b", "c"]);
  });
  it("D* adds up to the bonus count of extra creatures of its row", () => {
    const two = [c("a", 1, "destroyed-bonus"), c("b", 1, "destroyed-bonus")];
    expect(allocateAffected(two, 1, 1).affected).toEqual(["a", "b"]);
    expect(allocateAffected(two, 1, 0).affected).toEqual(["a"]);
  });
  it("non-D* creatures past the cap are never affected", () => {
    expect(allocateAffected([c("a", 1), c("b", 1)], 1, 5).affected).toEqual(["a"]);
  });
});

describe("resolveAttempt", () => {
  it("reproduces the PHB example: a 7th-level priest rolls 12 against skeletons, a wight and a spectre", () => {
    const result = resolveAttempt({
      d20: 12,
      level: 7,
      cap: 12,
      bonusCap: 0,
      targets: [
        { id: "s1", isUndead: true, row: "skeleton", hd: 1 },
        { id: "s2", isUndead: true, row: "skeleton", hd: 1 },
        { id: "w", isUndead: true, row: "wight", hd: 5 },
        { id: "sp", isUndead: true, row: "spectre", hd: 8 },
      ],
    });
    expect(result.map((r) => r.status)).toEqual(["destroyed", "destroyed", "turned", "fail"]);
  });
  it("reports non-undead and untagged targets without rolling for them", () => {
    const result = resolveAttempt({
      d20: 20,
      level: 7,
      cap: 12,
      bonusCap: 0,
      targets: [
        { id: "n", isUndead: false, row: null, hd: 2 },
        { id: "u", isUndead: true, row: null, hd: 2 },
      ],
    });
    expect(result.map((r) => r.status)).toEqual(["notUndead", "untagged"]);
  });
  it("marks successful targets past the cap as unaffected", () => {
    const result = resolveAttempt({
      d20: 20,
      level: 7,
      cap: 2,
      bonusCap: 0,
      targets: [
        { id: "a", isUndead: true, row: "skeleton", hd: 3 },
        { id: "b", isUndead: true, row: "skeleton", hd: 1 },
        { id: "c", isUndead: true, row: "skeleton", hd: 2 },
      ],
    });
    expect(result.map((r) => r.status)).toEqual(["unaffected", "destroyed", "destroyed"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/turning/turning.test.ts`
Expected: FAIL — cannot resolve `../../../src/core/turning`.

- [ ] **Step 3: Write the implementation**

Create `src/core/turning/table.ts`:

```ts
/* PHB Table 61: Turning Undead (printed p. 103). Columns are priest level
 * 1, 2, 3, 4, 5, 6, 7, 8, 9, 10-11, 12-13, 14+. A number is a d20 target,
 * "T" turned, "D" destroyed, "D*" destroyed plus an additional 2d4 creatures
 * of the type, null (a dash) cannot turn that type. */

export const TURN_ROW_IDS = [
  "skeleton", "zombie", "ghoul", "shadow", "wight", "ghast", "wraith",
  "mummy", "spectre", "vampire", "ghost", "lich", "special",
] as const;
export type TurnRowId = (typeof TURN_ROW_IDS)[number];

export type TurnCell = number | "T" | "D" | "D*" | null;

export const TURN_TABLE: Readonly<Record<TurnRowId, readonly TurnCell[]>> = {
  skeleton: [10, 7, 4, "T", "T", "D", "D", "D*", "D*", "D*", "D*", "D*"],
  zombie: [13, 10, 7, 4, "T", "T", "D", "D", "D*", "D*", "D*", "D*"],
  ghoul: [16, 13, 10, 7, 4, "T", "T", "D", "D", "D*", "D*", "D*"],
  shadow: [19, 16, 13, 10, 7, 4, "T", "T", "D", "D", "D*", "D*"],
  wight: [20, 19, 16, 13, 10, 7, 4, "T", "T", "D", "D", "D*"],
  ghast: [null, 20, 19, 16, 13, 10, 7, 4, "T", "T", "D", "D"],
  wraith: [null, null, 20, 19, 16, 13, 10, 7, 4, "T", "T", "D"],
  mummy: [null, null, null, 20, 19, 16, 13, 10, 7, 4, "T", "T"],
  spectre: [null, null, null, null, 20, 19, 16, 13, 10, 7, 4, "T"],
  vampire: [null, null, null, null, null, 20, 19, 16, 13, 10, 7, 4],
  ghost: [null, null, null, null, null, null, 20, 19, 16, 13, 10, 7],
  lich: [null, null, null, null, null, null, null, 20, 19, 16, 13, 10],
  special: [null, null, null, null, null, null, null, null, 20, 19, 16, 13],
};

/** The table column for a priest level (0-11), or -1 for a level below 1. Levels 14+ share the last column. */
export function levelColumn(level: number): number {
  if (level < 1) return -1;
  if (level <= 9) return level - 1;
  if (level <= 11) return 9;
  if (level <= 13) return 10;
  return 11;
}
```

Create `src/core/turning/resolve.ts`:

```ts
import { TURN_TABLE, levelColumn, type TurnRowId } from "./table";

export type TurnOutcome = "cannot" | "fail" | "turned" | "destroyed" | "destroyed-bonus";

/** A cleric turns at class level, a paladin two levels lower (PHB p. 103); no other class turns. */
export function turnerLevel(chassisId: string, level: number): number | null {
  const effective = chassisId === "cleric" ? level : chassisId === "paladin" ? level - 2 : null;
  return effective !== null && effective >= 1 ? effective : null;
}

/** The best turning level across an actor's classes, or null when none can turn. */
export function turnerLevelFor(classes: readonly { chassisId: string; level: number }[]): number | null {
  let best: number | null = null;
  for (const c of classes) {
    const level = turnerLevel(c.chassisId, c.level);
    if (level !== null && (best === null || level > best)) best = level;
  }
  return best;
}

export function resolveTurn(d20: number, level: number, row: TurnRowId): TurnOutcome {
  const column = levelColumn(level);
  if (column < 0) return "cannot";
  const cell = TURN_TABLE[row][column];
  if (cell === null || cell === undefined) return "cannot";
  if (cell === "T") return "turned";
  if (cell === "D") return "destroyed";
  if (cell === "D*") return "destroyed-bonus";
  return d20 >= cell ? "turned" : "fail";
}

export interface TurnCandidate {
  id: string;
  row: TurnRowId;
  hd: number;
  outcome: TurnOutcome;
}

/** Of the targets whose roll succeeded, who is actually affected: the lowest Hit Dice first, up to `cap`
 *  (the 2d6 roll). A "destroyed-bonus" target past the cap is still affected while fewer than `bonusCap`
 *  extra creatures of its row (the 2d4 roll) have been added. */
export function allocateAffected(
  candidates: readonly TurnCandidate[],
  cap: number,
  bonusCap: number,
): { affected: string[] } {
  const sorted = [...candidates].sort((a, b) => a.hd - b.hd);
  const affected: string[] = [];
  const bonusUsed = new Map<TurnRowId, number>();
  for (const c of sorted) {
    if (affected.length < cap) {
      affected.push(c.id);
      continue;
    }
    if (c.outcome === "destroyed-bonus") {
      const used = bonusUsed.get(c.row) ?? 0;
      if (used < bonusCap) {
        bonusUsed.set(c.row, used + 1);
        affected.push(c.id);
      }
    }
  }
  return { affected };
}

export interface TurnTarget {
  id: string;
  isUndead: boolean;
  row: TurnRowId | null;
  hd: number;
}

export type TurnStatus = "notUndead" | "untagged" | "cannot" | "fail" | "turned" | "destroyed" | "unaffected";

/** One d20 read separately for every target, then allocated against the 2d6 / 2d4 caps. */
export function resolveAttempt(args: {
  d20: number;
  level: number;
  targets: readonly TurnTarget[];
  cap: number;
  bonusCap: number;
}): { id: string; status: TurnStatus }[] {
  const statuses = new Map<string, TurnStatus>();
  const candidates: TurnCandidate[] = [];
  for (const t of args.targets) {
    if (!t.isUndead) {
      statuses.set(t.id, "notUndead");
      continue;
    }
    if (!t.row) {
      statuses.set(t.id, "untagged");
      continue;
    }
    const outcome = resolveTurn(args.d20, args.level, t.row);
    if (outcome === "cannot" || outcome === "fail") statuses.set(t.id, outcome);
    else candidates.push({ id: t.id, row: t.row, hd: t.hd, outcome });
  }
  const hit = new Set(allocateAffected(candidates, args.cap, args.bonusCap).affected);
  for (const c of candidates) {
    statuses.set(c.id, !hit.has(c.id) ? "unaffected" : c.outcome === "turned" ? "turned" : "destroyed");
  }
  return args.targets.map((t) => ({ id: t.id, status: statuses.get(t.id) as TurnStatus }));
}
```

Create `src/core/turning/index.ts`:

```ts
export * from "./table";
export * from "./resolve";
```

Append to `src/core/index.ts`:

```ts
export * from "./turning";
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/core/turning/turning.test.ts && npm run typecheck`
Expected: all tests PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/turning src/core/index.ts tests/core/turning
git commit -m "feat(turning): Table 61 rules core

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Monster types data, `turned` condition, creature sheet fields

**Files:**
- Modify: `src/data/item/choices.ts`, `src/config.ts`, `src/data/actor/creature.ts`, `src/conditions.ts`, `packs/conditions/_source/_MANIFEST.md`, `lang/en.json`, `src/sheets/creature/sheet.ts`, `templates/actor/creature/statblock.hbs`
- Create: `packs/conditions/_source/turned.json`
- Test: `tests/data/choices.test.ts`, `tests/templates/creature-sheet-bindings.test.ts`

**Interfaces:**
- Consumes: `TURN_ROW_IDS`, `TurnRowId` from `src/core/turning` (Task 1).
- Produces: `MONSTER_TYPE_IDS: readonly ["undead"]`, `type MonsterTypeId`, `TURN_ROW_CHOICES: readonly ("" | TurnRowId)[]` in `choices.ts`; `CONFIG.ADND2E.monsterTypes` and `CONFIG.ADND2E.turnRows` label maps; creature fields `system.details.types: string[]` and `system.details.turning.row: string` (blank = untagged); condition id `"turned"`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/data/choices.test.ts` (extend the import list with `MONSTER_TYPE_IDS, TURN_ROW_CHOICES`, and import `TURN_ROW_IDS` from `../../src/core/turning`):

```ts
describe("monster types and turning rows", () => {
  it("the registry ships with undead only", () => {
    expect([...MONSTER_TYPE_IDS]).toEqual(["undead"]);
  });
  it("TURN_ROW_CHOICES is blank plus every Table 61 row", () => {
    expect(TURN_ROW_CHOICES).toEqual(["", ...TURN_ROW_IDS]);
  });
});
```

Add to `tests/templates/creature-sheet-bindings.test.ts` inside the `describe` block:

```ts
  it("binds the monster types and the Table 61 row", () => {
    expect(TEMPLATES).toContain('data-action="toggleMonsterType"');
    expect(TEMPLATES).toContain('name="system.details.turning.row"');
    expect(registered.has("toggleMonsterType")).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/data/choices.test.ts tests/templates/creature-sheet-bindings.test.ts`
Expected: FAIL (missing exports / missing template binding).

- [ ] **Step 3: Implement**

`src/data/item/choices.ts` — add near the other exports (import `TURN_ROW_IDS` and the `TurnRowId` type from `../../core/turning`):

```ts
/** The creature-type registry (SP10). Types are tags: a creature may carry several. Add new types here as data. */
export const MONSTER_TYPE_IDS = ["undead"] as const;
export type MonsterTypeId = (typeof MONSTER_TYPE_IDS)[number];

/** A Monster NPC's Table 61 row: blank means untagged. */
export const TURN_ROW_CHOICES: readonly ("" | TurnRowId)[] = ["", ...TURN_ROW_IDS];
```

`src/config.ts` — add `import type { MonsterTypeId } from "./data/item/choices";` and `import type { TurnRowId } from "./core/turning";` (match how `Alignment` is imported there). In `interface Adnd2eConfig`, after the `alignments` line:

```ts
  readonly monsterTypes: LabelMap<MonsterTypeId>;
  readonly turnRows: LabelMap<TurnRowId>;
```

In the config object builder, after the `alignments: { ... },` map:

```ts
    monsterTypes: { undead: "ADND2E.monsterTypes.undead" },
    turnRows: {
      skeleton: "ADND2E.turnRows.skeleton",
      zombie: "ADND2E.turnRows.zombie",
      ghoul: "ADND2E.turnRows.ghoul",
      shadow: "ADND2E.turnRows.shadow",
      wight: "ADND2E.turnRows.wight",
      ghast: "ADND2E.turnRows.ghast",
      wraith: "ADND2E.turnRows.wraith",
      mummy: "ADND2E.turnRows.mummy",
      spectre: "ADND2E.turnRows.spectre",
      vampire: "ADND2E.turnRows.vampire",
      ghost: "ADND2E.turnRows.ghost",
      lich: "ADND2E.turnRows.lich",
      special: "ADND2E.turnRows.special",
    },
```

`src/data/actor/creature.ts` — import `MONSTER_TYPE_IDS, TURN_ROW_CHOICES` from `../item/choices`, and inside `details: new SchemaField({ ... })`, after `description: htmlField(),`:

```ts
        types: new ArrayField(new StringField({ required: true, blank: false, choices: MONSTER_TYPE_IDS }), { required: true, initial: [] }),
        turning: new SchemaField({
          row: new StringField({ required: true, blank: true, initial: "", choices: TURN_ROW_CHOICES }),
        }),
```

`src/conditions.ts` — append to `CONDITIONS` after the `mortalFatigue` row, and change the header comment's "Twenty status conditions: 15 base + 5 fatigue (SP14c)" to "Twenty-one status conditions: 15 base + 5 fatigue (SP14c) + turned (SP10)":

```ts
  { id: "turned", name: "Turned", img: "icons/svg/terror.svg" },
```

Create `packs/conditions/_source/turned.json`:

```json
{
  "_id": "tUrN3dCnDxK7mP2q",
  "_key": "!items!tUrN3dCnDxK7mP2q",
  "name": "Turned",
  "type": "condition",
  "img": "icons/svg/terror.svg",
  "system": {
    "conditionId": "turned",
    "description": ""
  }
}
```

`packs/conditions/_source/_MANIFEST.md` — change "Twenty status conditions" to "Twenty-one status conditions" and add the table row `| turned | Turned | \`icons/svg/terror.svg\` |` after `mortalFatigue`.

`lang/en.json` — merge these into the existing `ADND2E` object (top-level siblings of `alignments`):

```json
    "monsterTypes": { "undead": "Undead" },
    "turnRows": {
      "skeleton": "Skeleton or 1 HD",
      "zombie": "Zombie",
      "ghoul": "Ghoul or 2 HD",
      "shadow": "Shadow or 3-4 HD",
      "wight": "Wight or 5 HD",
      "ghast": "Ghast",
      "wraith": "Wraith or 6 HD",
      "mummy": "Mummy or 7 HD",
      "spectre": "Spectre or 8 HD",
      "vampire": "Vampire or 9 HD",
      "ghost": "Ghost or 10 HD",
      "lich": "Lich or 11+ HD",
      "special": "Special"
    },
```

and, inside the existing `ADND2E.sheet.creature` object, add `"monsterTypes": "Types"` and `"turnRow": "Turning row (Table 61)"`.

`src/sheets/creature/sheet.ts`:
1. Import `{ MONSTER_TYPE_IDS, type MonsterTypeId } from "../../data/item/choices"`.
2. In `actions`, add `toggleMonsterType: Adnd2eCreatureSheet.#onToggleMonsterType,`.
3. In `_prepareContext`, after `context.saveModes = cfg.saveModes;`:

```ts
    const types = (this.document.system as unknown as { details: { types: string[] } }).details.types;
    context.monsterTypeRows = MONSTER_TYPE_IDS.map((id) => ({
      id,
      label: cfg.monsterTypes![id],
      checked: types.includes(id),
    }));
    context.isUndead = types.includes("undead");
    context.turnRows = cfg.turnRows;
```

4. Add the handler next to `#onRollSave`:

```ts
  static async #onToggleMonsterType(this: Adnd2eCreatureSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const id = target.dataset.type as MonsterTypeId | undefined;
    if (!id || !(MONSTER_TYPE_IDS as readonly string[]).includes(id)) return;
    const current = [...(this.document.system as unknown as { details: { types: string[] } }).details.types];
    const next = current.includes(id) ? current.filter((t) => t !== id) : [...current, id];
    await this.document.update({ "system.details.types": next } as never);
  }
```

`templates/actor/creature/statblock.hbs` — inside the `creature-authoring` panel's `detail-fields` div, after the `saveClassLevel` label:

```hbs
        <div class="detail-field monster-types"><span class="cap">{{localize 'ADND2E.sheet.creature.monsterTypes'}}</span>
          {{#each monsterTypeRows}}<label><input type="checkbox" data-action="toggleMonsterType" data-type="{{this.id}}" {{#if this.checked}}checked{{/if}}> {{localize this.label}}</label>{{/each}}
        </div>
        {{#if isUndead}}
          <label class="detail-field"><span class="cap">{{localize 'ADND2E.sheet.creature.turnRow'}}</span><select name="system.details.turning.row">{{selectOptions turnRows selected=source.system.details.turning.row localize=true blank=""}}</select></label>
        {{/if}}
```

- [ ] **Step 4: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, including the conditions drift test (21 entries both sides) and the lang coverage test. If any other test hard-codes "20 conditions", update it to 21.

- [ ] **Step 5: Commit**

```bash
git add src packs lang templates tests
git commit -m "feat(turning): monster types registry, Table 61 row field and the turned condition

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Relay gains `turned` and `destroy`; the turn card

**Files:**
- Modify: `src/combat/apply-relay.ts`, `src/relay/apply-effect.ts`, `src/combat/card-types.ts`, `lang/en.json`
- Create: `src/combat/turn-card.ts`, `templates/chat/turn-undead-roll.hbs`
- Test: `tests/combat/apply-relay.test.ts`, `tests/combat/turn-card.test.ts`

**Interfaces:**
- Consumes: `TurnStatus` from `src/core/turning` (Task 1).
- Produces:
  - `RELAY_CONDITIONS` now `["stunned","prone","held","turned"]`; `RelayRequest` gains `{ kind: "destroy"; targetUuid: string }`; `applyEffectLocally` handles `destroy` (sets HP 0 and applies `dead`).
  - `interface TurnCardInput { actorName: string; actorImg: string; naturalD20: number; level: number; cap: number; bonusCap: number; rows: { name: string; img: string; status: TurnStatus }[] }`
  - `interface TurnCardContext { actorName: string; actorImg: string; formula: string; naturalD20: number; level: number; cap: number; bonusCap: number; rows: { name: string; img: string; status: TurnStatus; statusLabel: string }[] }`
  - `buildTurnCardContext(input: TurnCardInput): TurnCardContext`

- [ ] **Step 1: Write the failing tests**

In `tests/combat/apply-relay.test.ts`, change the pinned conditions assertion to `expect([...RELAY_CONDITIONS]).toEqual(["stunned", "prone", "held", "turned"]);` and add:

```ts
describe("destroy requests", () => {
  const t = "Scene.a.Token.b.Actor.c";
  it("validates a destroy request and rejects a missing target", () => {
    expect(validateRelayRequest({ kind: "destroy", targetUuid: t, extra: 1 })).toEqual({ kind: "destroy", targetUuid: t });
    expect(validateRelayRequest({ kind: "destroy", targetUuid: "" })).toBeNull();
  });
  it("accepts the turned condition", () => {
    expect(validateRelayRequest({ kind: "condition", targetUuid: t, conditionId: "turned" })).toEqual({
      kind: "condition", targetUuid: t, conditionId: "turned",
    });
  });
  it("names the destroy effect for the GM log", () => {
    expect(relayEffectText({ kind: "destroy", targetUuid: t })).toEqual({ key: "ADND2E.relay.effect.destroy", data: {} });
  });
});
```

Create `tests/combat/turn-card.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildTurnCardContext } from "../../src/combat/turn-card";

describe("buildTurnCardContext", () => {
  it("labels each row's status and carries the roll", () => {
    const ctx = buildTurnCardContext({
      actorName: "Gorus",
      actorImg: "gorus.png",
      naturalD20: 12,
      level: 7,
      cap: 9,
      bonusCap: 5,
      rows: [
        { name: "Skeleton", img: "s.png", status: "destroyed" },
        { name: "Spectre", img: "p.png", status: "fail" },
      ],
    });
    expect(ctx.formula).toBe("1d20");
    expect(ctx.naturalD20).toBe(12);
    expect(ctx.level).toBe(7);
    expect(ctx.rows.map((r) => r.statusLabel)).toEqual(["ADND2E.chat.turn.status.destroyed", "ADND2E.chat.turn.status.fail"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/combat/apply-relay.test.ts tests/combat/turn-card.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/combat/apply-relay.ts`:
- `export const RELAY_CONDITIONS = ["stunned", "prone", "held", "turned"] as const;` and update its comment: "(Plan 7d's called shots + grapple, and SP10's turned)".
- Add to `RelayRequest`: `| { kind: "destroy"; targetUuid: string }`.
- In `validateRelayRequest`, before `default:` add:

```ts
    case "destroy":
      return { kind: "destroy", targetUuid };
```

- In `relayEffectText`, add:

```ts
    case "destroy":
      return { key: "ADND2E.relay.effect.destroy", data: {} };
```

`src/relay/apply-effect.ts` — in the `switch`, add before `case "unequip"`:

```ts
    case "destroy":
      await actor.update({ "system.attributes.hp.value": 0 });
      await actor.toggleStatusEffect("dead", { active: true });
      return true;
```

`lang/en.json` — add `"destroy": "destruction (turned to dust)"` inside `ADND2E.relay.effect`. Inside `ADND2E.chat` add:

```json
      "turn": {
        "title": "Turn Undead",
        "level": "Turning level",
        "affectedCap": "Undead affected (2d6)",
        "bonusCap": "Bonus creatures per D* type (2d4)",
        "noRows": "No targets.",
        "status": {
          "notUndead": "Not undead — unaffected",
          "untagged": "Undead type not set — skipped",
          "cannot": "Cannot be turned at this level",
          "fail": "Resists the turning",
          "turned": "Turned",
          "destroyed": "Destroyed",
          "unaffected": "Turned, but beyond the number affected"
        }
      },
```

`src/combat/card-types.ts` — add (import `type TurnStatus` from `../core/turning`):

```ts
/* ---------- turn undead ---------- */

export interface TurnCardInput {
  actorName: string;
  actorImg: string;
  naturalD20: number;
  level: number;
  /** the 2d6 roll: how many undead can be affected */
  cap: number;
  /** the 2d4 roll: extra creatures of a D* type */
  bonusCap: number;
  rows: { name: string; img: string; status: TurnStatus }[];
}

export interface TurnCardContext {
  actorName: string;
  actorImg: string;
  formula: string;
  naturalD20: number;
  level: number;
  cap: number;
  bonusCap: number;
  rows: { name: string; img: string; status: TurnStatus; statusLabel: string }[];
}
```

Create `src/combat/turn-card.ts`:

```ts
import type { TurnCardContext, TurnCardInput } from "./card-types";

/** Flatten a resolved turning attempt into the chat card's display data. */
export function buildTurnCardContext(input: TurnCardInput): TurnCardContext {
  return {
    actorName: input.actorName,
    actorImg: input.actorImg,
    formula: "1d20",
    naturalD20: input.naturalD20,
    level: input.level,
    cap: input.cap,
    bonusCap: input.bonusCap,
    rows: input.rows.map((r) => ({ ...r, statusLabel: `ADND2E.chat.turn.status.${r.status}` })),
  };
}
```

Create `templates/chat/turn-undead-roll.hbs`:

```hbs
<div class="adnd2e chat-card turn-undead-roll">
  <header>
    <img src="{{actorImg}}" alt="{{actorName}}">
    <h3>{{actorName}} — {{localize 'ADND2E.chat.turn.title'}}</h3>
  </header>
  <p class="formula">{{formula}} = <strong>{{naturalD20}}</strong> ({{localize 'ADND2E.chat.turn.level'}}: {{level}})</p>
  <p class="hint">{{localize 'ADND2E.chat.turn.affectedCap'}}: {{cap}} · {{localize 'ADND2E.chat.turn.bonusCap'}}: {{bonusCap}}</p>
  <ul class="turn-results">
    {{#each rows}}
      <li class="status-{{this.status}}"><img src="{{this.img}}" alt="" width="24" height="24"> <span class="name">{{this.name}}</span> — {{localize this.statusLabel}}</li>
    {{else}}
      <li>{{localize 'ADND2E.chat.turn.noRows'}}</li>
    {{/each}}
  </ul>
</div>
```

- [ ] **Step 4: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. If a `switch` over `RelayRequest["kind"]` elsewhere is now non-exhaustive, typecheck names it; add the `destroy` case there.

- [ ] **Step 5: Commit**

```bash
git add src lang templates tests
git commit -m "feat(turning): destroy relay kind, turned relay condition, turn chat card

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The Turn Undead action, PC sheet panel, encounter reset, README

**Files:**
- Create: `src/sheets/character/turning-actions.ts`, `src/hooks/turning-hooks.ts`
- Modify: `src/sheets/character/sheet.ts`, `templates/actor/pc/partials/pc-feature-panels.hbs`, `src/system.ts`, `lang/en.json`, `README.md`
- Test: `tests/templates/pc-sheet-bindings.test.ts` (extend only if it enumerates registered actions)

**Interfaces:**
- Consumes: `turnerLevelFor`, `resolveAttempt`, `TurnRowId` (Task 1); `buildTurnCardContext` (Task 3); `requestApply` from `src/relay/relay-client.ts`; creature fields `system.hd.count`, `system.details.types`, `system.details.turning.row` (Task 2).
- Produces: `turningPanel(actor): { canTurn: boolean; level: number | null; attempted: boolean; canReset: boolean }`, `turnUndead(actor): Promise<void>`, `resetTurnAttempt(actor): Promise<void>`, `registerTurningHooks(): void`.

- [ ] **Step 1: Write the actions module**

Create `src/sheets/character/turning-actions.ts`:

```ts
import { buildTurnCardContext } from "../../combat/turn-card";
import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import { resolveAttempt, turnerLevelFor, type TurnRowId, type TurnTarget } from "../../core/turning";
import { requestApply } from "../../relay/relay-client";

/* Turn Undead (SP10, PHB p. 103). Foundry glue: reads the user's targeted
 * tokens, rolls once, posts one card, and applies each result through the
 * player-apply relay. The rules live in src/core/turning. */

const FLAG = "turnAttempt";

interface TurnerActor {
  name: string;
  img: string;
  isOwner: boolean;
  system: { classes: { chassisId: string; level: number }[] };
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
  unsetFlag(scope: string, key: string): Promise<unknown>;
}

interface TargetActor {
  name: string;
  img: string;
  uuid: string;
  isOwner: boolean;
  system: {
    hd?: { count: number };
    details?: { types?: string[]; turning?: { row?: string } };
  };
}

export function turningPanel(actor: TurnerActor): { canTurn: boolean; level: number | null; attempted: boolean; canReset: boolean } {
  const level = turnerLevelFor(actor.system.classes);
  const attempted = Boolean(actor.getFlag(SYSTEM_ID, FLAG));
  const isGm = Boolean((game.user as unknown as { isGM?: boolean } | null)?.isGM);
  return { canTurn: level !== null, level, attempted, canReset: attempted && isGm };
}

function targetedActors(): TargetActor[] {
  const targets = (game.user as unknown as { targets: Iterable<{ actor: TargetActor | null }> }).targets;
  const actors: TargetActor[] = [];
  for (const token of targets) if (token.actor) actors.push(token.actor);
  return actors;
}

export async function turnUndead(actor: TurnerActor): Promise<void> {
  const level = turnerLevelFor(actor.system.classes);
  if (level === null) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.turning.notTurner"));
    return;
  }
  if (actor.getFlag(SYSTEM_ID, FLAG)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.turning.alreadyAttempted"));
    return;
  }
  const targets = targetedActors();
  if (targets.length === 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.turning.noTargets"));
    return;
  }

  const d20 = await new Roll("1d20").evaluate();
  const cap = (await new Roll("2d6").evaluate()).total;
  const bonusCap = (await new Roll("2d4").evaluate()).total;
  const naturalD20 = d20.dice[0]?.total ?? d20.total;

  const turnTargets: TurnTarget[] = targets.map((t, i) => ({
    id: String(i),
    isUndead: Boolean(t.system.details?.types?.includes("undead")),
    row: (t.system.details?.turning?.row || null) as TurnRowId | null,
    hd: t.system.hd?.count ?? 0,
  }));
  const results = resolveAttempt({ d20: naturalD20, level, targets: turnTargets, cap, bonusCap });

  const context = buildTurnCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    naturalD20,
    level,
    cap,
    bonusCap,
    rows: results.map((r, i) => ({ name: targets[i]!.name, img: targets[i]!.img, status: r.status })),
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/turn-undead-roll.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await d20.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
  } as unknown as Roll.MessageData);

  await actor.setFlag(SYSTEM_ID, FLAG, true);

  for (const [i, r] of results.entries()) {
    const target = targets[i]!;
    if (r.status === "turned") {
      await requestApply(target as never, { kind: "condition", targetUuid: target.uuid, conditionId: "turned" });
    } else if (r.status === "destroyed") {
      await requestApply(target as never, { kind: "destroy", targetUuid: target.uuid });
    }
  }
}

export async function resetTurnAttempt(actor: TurnerActor): Promise<void> {
  await actor.unsetFlag(SYSTEM_ID, FLAG);
}
```

Verify `TEMPLATE_PATH` accepts a single `"chat/turn-undead-roll.hbs"` argument by looking at how `proficiency-actions.ts` calls `TEMPLATE_PATH("chat/thief-skill-roll.hbs")` — it does; no change needed.

Create `src/hooks/turning-hooks.ts`:

```ts
import { SYSTEM_ID } from "../constants";

/* Ending a combat ends the encounter: clear every combatant's "has turned" flag.
 * Runs on the active GM's client only, like the casting hooks. */

const isActiveGm = (): boolean => Boolean((game.user as unknown as { isActiveGM?: boolean } | null)?.isActiveGM);

export function registerTurningHooks(): void {
  Hooks.on("deleteCombat", (combat: unknown) => {
    if (!isActiveGm()) return;
    const c = combat as { combatants: Iterable<{ actor: { getFlag(s: string, k: string): unknown; unsetFlag(s: string, k: string): Promise<unknown> } | null }> };
    for (const combatant of c.combatants) {
      const actor = combatant.actor;
      if (actor?.getFlag(SYSTEM_ID, "turnAttempt")) void actor.unsetFlag(SYSTEM_ID, "turnAttempt");
    }
  });
}
```

In `src/system.ts`, add `import { registerTurningHooks } from "./hooks/turning-hooks";` next to the casting-hooks import, and call `registerTurningHooks();` on the line after `registerCastingHooks();` (around line 142).

- [ ] **Step 2: Wire the PC sheet**

`src/sheets/character/sheet.ts`:
1. Import: `import { resetTurnAttempt, turningPanel, turnUndead } from "./turning-actions";`
2. In `actions`, add `turnUndead: Adnd2eCharacterSheet.#onTurnUndead, resetTurnAttempt: Adnd2eCharacterSheet.#onResetTurnAttempt,`.
3. In `_prepareContext`, after `context.pcActions = true;`: `context.turning = turningPanel(this.document as never);`
4. Add handlers next to `#onRollThiefSkill`:

```ts
  static async #onTurnUndead(this: Adnd2eCharacterSheet): Promise<void> {
    await turnUndead(this.document as never);
    await this.render();
  }

  static async #onResetTurnAttempt(this: Adnd2eCharacterSheet): Promise<void> {
    await resetTurnAttempt(this.document as never);
  }
```

`templates/actor/pc/partials/pc-feature-panels.hbs` — inside the existing `{{#if @root.pcActions}}`, before `{{#if adnd2e.traits.enabled}}`:

```hbs
  {{#if @root.turning.canTurn}}
  <section class="kit-panel">
    <div class="kit-bar">{{localize 'ADND2E.sheet.turning.title'}}</div>
    <div class="kit-body">
      <p class="hint">{{localize 'ADND2E.sheet.turning.level'}}: {{@root.turning.level}}</p>
      <button type="button" class="kit-small" data-action="turnUndead"{{#if @root.turning.attempted}} disabled{{/if}}>{{localize 'ADND2E.sheet.turning.button'}}</button>
      {{#if @root.turning.attempted}}<p class="hint">{{localize 'ADND2E.sheet.turning.attempted'}}</p>{{/if}}
      {{#if @root.turning.canReset}}<button type="button" class="kit-small" data-action="resetTurnAttempt">{{localize 'ADND2E.sheet.turning.reset'}}</button>{{/if}}
    </div>
  </section>
  {{/if}}
```

`lang/en.json` — inside `ADND2E.sheet` add:

```json
      "turning": {
        "title": "Turn Undead",
        "level": "Turning level",
        "button": "Turn Undead",
        "attempted": "Already attempted this encounter.",
        "reset": "Reset attempt (GM)",
        "notTurner": "Only clerics and paladins can turn undead.",
        "alreadyAttempted": "You have already attempted to turn undead this encounter.",
        "noTargets": "Target the undead first (select tokens, then press T or use the target tool)."
      },
```

If `tests/templates/pc-sheet-bindings.test.ts` enumerates registered actions or panel strings, extend it with `turnUndead` and `resetTurnAttempt` the same way it treats `recoverChannellerSp`; otherwise leave it.

- [ ] **Step 3: Run the suite, typecheck, lint and build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all PASS. Fix anything the build or lint reports.

- [ ] **Step 4: Update the README and commit**

In `README.md`, change the Sub-project 10 row's status cell to `✅ Complete` and replace its description with: "Table 61 turning for clerics and paladins (paladins two levels lower; druids cannot): one d20 read per targeted Monster NPC by its Table 61 row, with turn/destroy/D* outcomes, the 2d6 affected count (lowest Hit Dice first) and the 2d4 D* bonus, one chat card, a `turned` condition and destruction applied through the player-apply relay, and one attempt per encounter (cleared when combat ends, or reset by the GM). Monster NPCs gain a general multi-select Types field (undead first) and a Table 61 row select. Evil-priest commanding, evil priests turning paladins, the shaman talisman and the Ghosthunter kit are not implemented." Add to Known backlog items: "**Turn Undead limits.** Turned undead are a flavor condition (no automatic fleeing or ten-foot break), Character NPC clerics cannot turn (PC sheet only), and evil-priest commanding and the shaman/Ghosthunter variants are parked."

```bash
git add src templates lang README.md tests
git commit -m "feat(turning): Turn Undead action, PC sheet panel, per-encounter reset

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Dev-world verification (gated, hand-run)**

Not part of CI. In the linked dev world, with a **GM seat and a non-GM player seat**:

1. Open a Monster NPC, unlock it, tick Undead, set the Table 61 row (Skeleton). Repeat for a Wight and a Spectre. Confirm the types survive a reload.
2. As the player, on a level-7 cleric: target all three undead and a non-undead token, press Turn Undead. Confirm one card lists a status per target, the skeleton and wight tokens gain the Turned condition (or the skeleton is dead at 0 HP if destroyed), and the spectre resists on a low roll.
3. Press Turn Undead again: blocked with a warning. As GM, press Reset: the button works again.
4. A level-3 paladin sees the panel with turning level 1; a level-2 paladin, a druid and a fighter see no panel.
5. Start and end a combat after an attempt: the flag clears.
6. Set the Player-Applied Damage & Effects setting to "approve" and repeat step 2: the GM is asked once per affected token.
7. Force a `D*` result (a level-8+ cleric against skeletons) with more than 2d6 skeletons targeted, and check the bonus creatures are affected. (Foundry's dice use a seeded RNG, so the rolls can be steered; see the project's dice gotcha memory.)
