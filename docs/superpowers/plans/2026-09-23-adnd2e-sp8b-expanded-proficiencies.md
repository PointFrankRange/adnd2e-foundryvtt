# Sub-project 8 Plan 8b: Expanded Proficiencies (Related-Weapon Penalty + Specific-Weapon Pack) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the Skills & Powers "expanded proficiencies" rule is on, an attacker who is not proficient with a weapon but holds a specific-weapon proficiency in the same weapon group takes half the non-proficiency attack penalty (the "related" case core already supports but nothing resolves); and ship a compendium of specific-weapon proficiency items so those proficiencies can be dragged onto a sheet.

**Architecture:** One new pure module `src/core/proficiencies/weapon-relation.ts` owns the single gate helper (`expandedProficienciesEnabled`), the related-group test (`isRelatedGroup`) and the mode resolver (`weaponProficiencyMode`); `resolveProficiencyModifier` in `combat-rolls.ts` computes three match booleans from the actor's items and feeds the resolved mode into the EXISTING `weaponAttackPenalty(penalty, mode)`. `weaponProficiency` gains one additive `proficiencyGroup` string. A new Item-typed pack `packs/weapon-proficiencies` supplies the specific-weapon items. No sheet UI changes.

**Tech Stack:** TypeScript, Vite, Vitest, Foundry VTT v14.364 (`foundryvtt-cli` pack compilation).

**Spec:** `docs/superpowers/specs/2026-09-23-adnd2e-sp8-skills-and-powers-design.md` — §2 Decisions table, §3 Global Constraints, §4.2, §5, §6, §7.

## Global Constraints

- **Foundry target:** v14.364. Foundry-layer API questions are answered from `C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}\*.mjs`, never `fvtt-types`.
- **Two-layer contract:** `src/core/**` (directory-level wildcard in `tsconfig.core.json`, `vitest.config.ts` coverage `include`, `eslint.config.js` pure-zone — verify, don't assume) is the PURE zone: no Foundry imports, 100% line/statement/function coverage, branches ≥ 90. `src/data/item/weapon-proficiency.ts`, `src/sheets/character/combat-rolls.ts`, `system.json`, `lang/en.json` and the pack JSON are Foundry-layer/data — typecheck/lint gated (plus the pack source/drift tests), dev-world verified.
- **Content policy:** the pack contains weapon NAMES and this project's own group assignment ONLY — no weapon statistics, no rules prose (`system.description` is `""`). The PHB weapon names are game vocabulary; the 8-group assignment is this project's own design.
- **Gating (locked, spec §2):** `skillsAndPowersEnabled` is a master AND-gate; the expression `rules.skillsAndPowersEnabled && rules.expandedProficiencies` is written **exactly once**, as `expandedProficienciesEnabled` in Task 1, and `combat-rolls.ts` calls that helper. Do not restate it anywhere (the 7c and 7d whole-branch reviews each caught a gate two files stated differently).
- **Additive schema only — no migration, no version bump.** `proficiencyGroup` has `initial: ""` (Plan 8a confirmed against real v14.364 `common/data/fields.mjs` — `DataField#clean` fills an `undefined` required field from `getInitialValue` — that a missing required field is initialised at construction for existing documents; Task 2 must re-confirm by reading the source, not assume). The existing `migrateData` shim in `WeaponProficiencyItemModel` (SP7c) must be left untouched.
- **ROLL-time rule — NO `requiresReload` on `expandedProficiencies`** (contrast Plan 8a's prepare-time toggles): `resolveProficiencyModifier` runs on every attack and reads `getOptionalRules()` fresh, so flipping `expandedProficiencies` takes effect on the next roll. Do NOT add `requiresReload` to the `expandedProficiencies` descriptor. (The MASTER `skillsAndPowersEnabled` descriptor already carries `requiresReload: true` from Plan 8a because it also gates prepare-time sub-ability derivation — leave it; toggling the master still prompts a reload, and that is expected.)
- **Rule off = today's behavior, byte-for-byte:** with the rule off (or the master off) the returned modifier for every attacker/weapon combination must equal what the current code returns.
- **Pack authoring gotchas (foundryvtt-cli):** every source doc needs `_id` (exactly 16 chars `[A-Za-z0-9]`, unique within the pack) and `_key: "!items!<_id>"` or it is silently dropped and the pack compiles EMPTY; `scripts/build-packs.mjs` read-back-verifies counts and `tests/packs/source.test.ts` asserts `_id`/`_key` shape. Only Item-typed packs are installable on v14.364 (ActiveEffect-typed compendiums are rejected by the installer).
- **No `npm run format`/`prettier`/`npm install`/`npm update`**, and do not touch `package.json`/`package-lock.json`/`node_modules`.
- **`npm run build` / `npm run build:packs` write into `dist/` (junctioned into Foundry's data dir) and require Foundry fully closed** — implementer tasks do NOT run them; the compile is verified in Task 5's gated check (the source/drift tests cover pack structure until then).
- **Read vitest output with `tail`/`head`/redirect, never `| grep`** — SIGPIPE false "no tests"; a cache-clear's first run can genuinely flake, rerun 2-3×.
- **The whole-branch review (Task 4) is MANDATORY and the dev-world check (Task 5) is GATED and MUST include a non-GM player seat.**

## Locked design decisions (this plan's own, resolving what spec §4.2 left to the plan)

1. **Precedence: exact > group > related > non-proficient.** A weapon whose name exactly matches a specific-weapon proficiency, or whose `proficiencyGroup` matches a group proficiency, is `"proficient"` (penalty 0, mastery applies) — exactly as today. Only when neither matches, and the rule is on, does a held specific-weapon proficiency in the weapon's group make it `"related"`. A related match never suppresses a real match, and with no match at all the attacker keeps the full non-proficient penalty.
2. **`relatedGroupMatch` definition:** true iff the rule is on AND the weapon's `system.proficiencyGroup` is non-empty AND some held weaponProficiency item with `isGroup !== true` has a non-empty `system.proficiencyGroup` equal to it. Group-name comparison is exact string equality (the 8 pack group names: `Blades`, `Bludgeoning`, `Bows`, `Crossbows`, `Hafted`, `Hurled`, `Pole Arms`, `Slings`). The non-empty test lives in the pure `isRelatedGroup`, so an unset group on either side never matches.
3. **No mastery leakage:** mastery/specialization applies only in the `"proficient"` mode — a `"related"` weapon returns exactly the half penalty (`weaponAttackPenalty(p, "related") = -ceil(|p|/2)`), never plus the other weapon's tier bonus.
4. **One settings read:** `resolveProficiencyModifier` reads `getOptionalRules()` ONCE at the top and reuses that `rules` for both `expandedProficienciesEnabled(rules)` and the existing `weaponMastery` gate (today's later `const rules = getOptionalRules();` inside the mastery branch is replaced by the top-level read).
5. **Existing first-match control flow is preserved:** the exact-name match still `break`s and clears any remembered group match; the first group match still wins among groups.
6. **Pack docs ship `slotsInvested: 0`** like the group pack; the existing PC `_onDropItem` (`src/sheets/character/sheet.ts:450-508`) and the NPC sheet's `_onDropItem` (`src/sheets/npc/sheet.ts`) already write `system.slotsInvested = 1` (via `validateItemDrop`'s default `dropSlotCost` of 1) onto any newly dropped `weaponProficiency` — verified while planning; **no drop-path or sheet change is needed**, and a pack proficiency whose `weaponOrGroup` equals an owned weapon's name resolves its specialization/mastery category exactly like any hand-made one (`resolveCategory` in `proficiency-actions.ts`).
7. **No sheet UI change** (spec §4.2 lists none): weapon proficiency rows render unchanged; `WeaponProfView`/`toWeaponProfView` are untouched.
8. **The pack's 51 weapon→group assignments are fixed in Task 2's table** (names + group only). A weapon belongs to exactly one group; weapons that fit none of the 8 groups (e.g. whip, net, blowgun, lasso, garrot) are intentionally omitted.

---

### Task 1: Pure related-weapon module

**Files:**
- Create: `src/core/proficiencies/weapon-relation.ts`
- Modify: `src/core/proficiencies/index.ts` (one re-export line)
- Create: `tests/core/proficiencies/weapon-relation.test.ts`

**Interfaces:**
- Consumes: `OptionalRules` (`skillsAndPowersEnabled`, `expandedProficiencies` — wired in Plan 8a) from `src/core/options.ts`; `WeaponProficiencyMode` from `src/core/types.ts` (`"proficient" | "related" | "non-proficient"`).
- Produces (consumed by Task 3): `expandedProficienciesEnabled(rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "expandedProficiencies">): boolean`; `isRelatedGroup(weaponGroup: string, heldSpecificGroups: readonly string[]): boolean`; `interface WeaponProficiencyMatch { exactMatch: boolean; groupMatch: boolean; relatedGroupMatch: boolean }`; `weaponProficiencyMode(match: WeaponProficiencyMatch): WeaponProficiencyMode`.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/core/proficiencies/weapon-relation.test.ts
import { describe, expect, it } from "vitest";
import {
  expandedProficienciesEnabled,
  isRelatedGroup,
  weaponProficiencyMode,
} from "../../../src/core/proficiencies/weapon-relation";
import { weaponAttackPenalty } from "../../../src/core/proficiencies/weapon";

describe("expandedProficienciesEnabled", () => {
  it("requires BOTH the master switch and the expanded-proficiencies toggle", () => {
    expect(expandedProficienciesEnabled({ skillsAndPowersEnabled: true, expandedProficiencies: true })).toBe(true);
    expect(expandedProficienciesEnabled({ skillsAndPowersEnabled: true, expandedProficiencies: false })).toBe(false);
    expect(expandedProficienciesEnabled({ skillsAndPowersEnabled: false, expandedProficiencies: true })).toBe(false);
    expect(expandedProficienciesEnabled({ skillsAndPowersEnabled: false, expandedProficiencies: false })).toBe(false);
  });
});

describe("isRelatedGroup", () => {
  it("is true when a held specific proficiency is in the weapon's group", () => {
    expect(isRelatedGroup("Blades", ["Bows", "Blades"])).toBe(true);
  });
  it("is false when no held proficiency is in the weapon's group", () => {
    expect(isRelatedGroup("Blades", ["Bows", "Hafted"])).toBe(false);
  });
  it("is false when nothing is held", () => {
    expect(isRelatedGroup("Blades", [])).toBe(false);
  });
  it("is false for a weapon with no group, even if an empty string is 'held'", () => {
    expect(isRelatedGroup("", [""])).toBe(false);
    expect(isRelatedGroup("", ["Blades"])).toBe(false);
  });
});

describe("weaponProficiencyMode — precedence exact > group > related > non-proficient", () => {
  const cases: [boolean, boolean, boolean, string][] = [
    [true, true, true, "proficient"],
    [true, true, false, "proficient"],
    [true, false, true, "proficient"], // an exact match is never demoted to related
    [true, false, false, "proficient"],
    [false, true, true, "proficient"], // a group match is never demoted to related
    [false, true, false, "proficient"],
    [false, false, true, "related"],
    [false, false, false, "non-proficient"],
  ];
  for (const [exactMatch, groupMatch, relatedGroupMatch, expected] of cases) {
    it(`exact=${exactMatch} group=${groupMatch} related=${relatedGroupMatch} -> ${expected}`, () => {
      expect(weaponProficiencyMode({ exactMatch, groupMatch, relatedGroupMatch })).toBe(expected);
    });
  }
});

describe("mode feeds the existing weaponAttackPenalty", () => {
  it("a related weapon takes half the non-proficiency penalty, rounded up", () => {
    expect(weaponAttackPenalty(-2, "related")).toBe(-1); // warrior
    expect(weaponAttackPenalty(-3, "related")).toBe(-2); // priest / rogue
    expect(weaponAttackPenalty(-5, "related")).toBe(-3); // wizard (5/2 = 2.5 -> 3)
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/core/proficiencies/weapon-relation.test.ts > /tmp/8b1.log 2>&1; tail -n 30 /tmp/8b1.log`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/core/proficiencies/weapon-relation.ts
// Player's Option: Skills & Powers expanded weapon proficiencies (SP8 Plan 8b).
// Core has long defined a "related" WeaponProficiencyMode (half the
// non-proficiency penalty — see weaponAttackPenalty in ./weapon) that nothing
// ever resolved. This module supplies the missing resolution: an attacker who
// is not proficient with a weapon but holds a specific-weapon proficiency in the
// same weapon group attacks at the half penalty. Pure — the caller (the
// Foundry-layer roll flow) computes the three booleans from the actor's items.
import type { OptionalRules } from "../options";
import type { WeaponProficiencyMode } from "../types";

/**
 * THE one place the expanded-proficiencies gate is written (master AND-gate,
 * spec §2). The roll flow calls this — never restate the expression.
 */
export function expandedProficienciesEnabled(
  rules: Pick<OptionalRules, "skillsAndPowersEnabled" | "expandedProficiencies">,
): boolean {
  return rules.skillsAndPowersEnabled && rules.expandedProficiencies;
}

/**
 * True when the attacked weapon's group is non-empty and equals the group of
 * at least one held SPECIFIC-weapon proficiency. An unset group (empty string)
 * on either side never matches.
 */
export function isRelatedGroup(weaponGroup: string, heldSpecificGroups: readonly string[]): boolean {
  return weaponGroup !== "" && heldSpecificGroups.includes(weaponGroup);
}

export interface WeaponProficiencyMatch {
  /** a specific-weapon proficiency names this exact weapon */
  exactMatch: boolean;
  /** a group proficiency covers this weapon's group */
  groupMatch: boolean;
  /** the rule is on AND a held specific proficiency shares this weapon's group */
  relatedGroupMatch: boolean;
}

/**
 * Precedence: exact or group match -> "proficient" (a real match is never
 * demoted to "related"); else a related-group match -> "related"; else
 * "non-proficient".
 */
export function weaponProficiencyMode(match: WeaponProficiencyMatch): WeaponProficiencyMode {
  if (match.exactMatch || match.groupMatch) return "proficient";
  if (match.relatedGroupMatch) return "related";
  return "non-proficient";
}
```
Add to `src/core/proficiencies/index.ts` (after `export * from "./weapon";`): `export * from "./weapon-relation";`

- [ ] **Step 4: Run tests, typecheck, coverage**

Run: `npx vitest run tests/core/proficiencies/weapon-relation.test.ts > /tmp/8b1b.log 2>&1; tail -n 30 /tmp/8b1b.log`
Run: `npm run typecheck > /tmp/8b1-tc.log 2>&1; tail -n 30 /tmp/8b1-tc.log`
Run: `npm run test:coverage > /tmp/8b1-cov.log 2>&1; tail -n 60 /tmp/8b1-cov.log`
Expected: PASS; `weapon-relation.ts` 100% statements/lines/functions, ≥ 90% branches; no triad-config edit is needed (`src/core/**` is a directory-level wildcard) — this step only confirms that. If the barrel re-export produces a name collision, report it (the plan expects none: the new names are unique).

- [ ] **Step 5: Commit**

```bash
git add src/core/proficiencies/weapon-relation.ts src/core/proficiencies/index.ts tests/core/proficiencies/weapon-relation.test.ts
git commit -m "feat(sp8b): add pure related-weapon proficiency module

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `proficiencyGroup` field + specific-weapon proficiency pack

**Files:**
- Modify: `src/data/item/weapon-proficiency.ts`
- Modify: `system.json` (`packs` + the "Proficiencies" `packFolders` entry)
- Create: `packs/weapon-proficiencies/_source/*.json` (51 files, generated — Step 5)
- Create: `packs/weapon-proficiencies/_source/_MANIFEST.md`
- Modify: `tests/packs/content.test.ts`

Foundry-layer/data — the pack is verified by the source/drift tests here and by a real compile in Task 5. **Do not run `npm run build` or `npm run build:packs` in this task** (Foundry may be open and `dist/` is junctioned into its data directory).

**Interfaces:**
- Consumes: the 8 group names in `packs/weapon-proficiency-groups/_source/*.json` (`Blades`, `Bludgeoning`, `Bows`, `Crossbows`, `Hafted`, `Hurled`, `Pole Arms`, `Slings`).
- Produces: `WeaponProficiencyItemModel` field `proficiencyGroup: string` (read by Task 3 as `system.proficiencyGroup` on held weaponProficiency items); the `weapon-proficiencies` pack of 51 `weaponProficiency` items.

**Current real state** (confirmed during planning): `WeaponProficiencyItemModel.defineSchema()` returns `...super.defineSchema()`, `weaponOrGroup`, `isGroup`, `slotsInvested` (initial 1), `styleSpecialization`, `masteryTier` (0-3), and the class carries the SP7c `migrateData` shim (leave it exactly as is). `system.json` declares five packs (`classes`, `races`, `nonweapon-proficiencies`, `weapon-proficiency-groups`, `conditions`), each `{ "name", "label", "path": "packs/<name>", "type": "Item", "system": "adnd2e", "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" } }`; the "Proficiencies" folder is `{ "name": "Proficiencies", "sorting": "a", "packs": ["weapon-proficiency-groups", "nonweapon-proficiencies"] }`. A group pack doc looks like: `{ "_id": "uCrULGOxNfpSsh1Z", "_key": "!items!uCrULGOxNfpSsh1Z", "name": "Bows", "type": "weaponProficiency", "img": "icons/svg/sword.svg", "system": { "description": "", "weaponOrGroup": "Bows", "isGroup": true, "slotsInvested": 0, "styleSpecialization": null, "masteryTier": 0 } }`. `tests/packs/source.test.ts` (generic — iterates every pack in `system.json`) asserts each doc's `_id` is 16 chars `[A-Za-z0-9]` and unique, `_key === "!items!<_id>"`, `name`/`type` present, `type` in `ITEM_SUBTYPES`, and every `packFolders` pack reference resolves; `tests/packs/content.test.ts` has a `docs(pack)` helper and a `sys(d)` helper plus per-pack content describes.

- [ ] **Step 1: Re-confirm the no-migration premise**

Read `C:\Program Files\Foundry Virtual Tabletop\resources\app\common\data\fields.mjs`: `DataField#clean` (~line 227-260; the `value === undefined` → `getInitialValue` branch at ~237) and `SchemaField#_cleanType` (~1069-1093), and confirm a REQUIRED `StringField` with `initial: ""` missing from an existing Item's stored source is filled at construction (so every existing weaponProficiency item, world or compendium, gains `proficiencyGroup: ""` with no migration). Record the file:line evidence in your report. If NOT true, STOP and report BLOCKED.

- [ ] **Step 2: Write the failing content tests**

In `tests/packs/content.test.ts`, append after the last `describe`:
```typescript
describe("weapon-proficiencies pack content", () => {
  const items = docs("weapon-proficiencies");
  const groupNames = docs("weapon-proficiency-groups").map((d) => d.name as string);
  const EXPECTED_PER_GROUP: Record<string, number> = {
    Blades: 8,
    Bludgeoning: 6,
    Hafted: 6,
    "Pole Arms": 19,
    Hurled: 4,
    Bows: 4,
    Crossbows: 3,
    Slings: 1,
  };

  it("has exactly 51 documents (names + group assignment only)", () => {
    expect(items).toHaveLength(51);
  });

  it("every entry is a specific (non-group) weaponProficiency named after its weapon, with no slots or mastery yet", () => {
    for (const d of items) {
      expect(d.type, String(d.name)).toBe("weaponProficiency");
      expect(sys(d).isGroup, String(d.name)).toBe(false);
      expect(sys(d).weaponOrGroup, String(d.name)).toBe(d.name);
      expect(sys(d).slotsInvested, String(d.name)).toBe(0);
      expect(sys(d).masteryTier, String(d.name)).toBe(0);
      expect(sys(d).description, String(d.name)).toBe("");
    }
  });

  it("every proficiencyGroup names a real group in the weapon-proficiency-groups pack", () => {
    for (const d of items) expect(groupNames, String(d.name)).toContain(sys(d).proficiencyGroup);
  });

  it("names are unique", () => {
    expect(new Set(items.map((d) => d.name)).size).toBe(items.length);
  });

  it("per-group counts match the enumerated list, and the 8 real groups are all represented", () => {
    const counts: Record<string, number> = {};
    for (const d of items) counts[sys(d).proficiencyGroup as string] = (counts[sys(d).proficiencyGroup as string] ?? 0) + 1;
    expect(counts).toEqual(EXPECTED_PER_GROUP);
    expect(new Set(Object.keys(counts))).toEqual(new Set(groupNames));
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/packs/content.test.ts > /tmp/8b2.log 2>&1; tail -n 30 /tmp/8b2.log`
Expected: FAIL — `packs/weapon-proficiencies/_source` does not exist (ENOENT from `docs(...)`).

- [ ] **Step 4: Add the schema field**

In `src/data/item/weapon-proficiency.ts`, add to `defineSchema()` after the `masteryTier` line:
```typescript
      /** Sub-project 8 Plan 8b: the weapon group a SPECIFIC-weapon proficiency
       *  belongs to (e.g. "Blades") — read only when the expandedProficiencies
       *  rule is on, to resolve the "related weapon" penalty. Empty on group
       *  proficiencies and hand-made items (they never count as related). */
      proficiencyGroup: new StringField({ required: true, blank: true, initial: "" }),
```
Do not touch `migrateData`.

- [ ] **Step 5: Register the pack and generate the 51 documents**

`system.json`: add to the `packs` array (after the `weapon-proficiency-groups` entry, before `conditions`):
```json
    { "name": "weapon-proficiencies", "label": "Weapon Proficiencies", "path": "packs/weapon-proficiencies", "type": "Item", "system": "adnd2e", "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" } },
```
and change the "Proficiencies" folder's `packs` to `["weapon-proficiency-groups", "weapon-proficiencies", "nonweapon-proficiencies"]`.

The 51 weapons and their groups (this is the COMPLETE list — names are PHB weapon vocabulary, the group assignment is this project's own design; nothing else may be added or dropped):

| Group | Weapons |
|---|---|
| Blades (8) | Dagger, Knife, Scimitar, Short Sword, Long Sword, Broad Sword, Bastard Sword, Two-Handed Sword |
| Bludgeoning (6) | Club, Footman's Mace, Horseman's Mace, Morning Star, Quarterstaff, Hammer |
| Hafted (6) | Battle Axe, Hand Axe, Footman's Flail, Horseman's Flail, Footman's Pick, Horseman's Pick |
| Pole Arms (19) | Bardiche, Bec de Corbin, Bill-Guisarme, Fauchard, Fauchard-Fork, Glaive, Glaive-Guisarme, Guisarme, Guisarme-Voulge, Halberd, Lucern Hammer, Military Fork, Partisan, Pike, Ranseur, Spetum, Voulge, Spear, Trident |
| Hurled (4) | Dart, Javelin, Harpoon, Bolas |
| Bows (4) | Short Bow, Long Bow, Composite Short Bow, Composite Long Bow |
| Crossbows (3) | Hand Crossbow, Light Crossbow, Heavy Crossbow |
| Slings (1) | Sling |

Generate the documents with this SCRATCH script (save it OUTSIDE the repo — e.g. `os.tmpdir()`/the scratchpad — run it once from the repo root with `node`, and do NOT commit it; the generated JSON files are the source of truth). Ids are deterministic (first 16 hex chars of SHA-1 of a namespaced name), so a re-run reproduces identical files:
```javascript
// gen-weapon-proficiencies.mjs — scratch, not committed. Run from the repo root.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const LIST = {
  "Blades": ["Dagger", "Knife", "Scimitar", "Short Sword", "Long Sword", "Broad Sword", "Bastard Sword", "Two-Handed Sword"],
  "Bludgeoning": ["Club", "Footman's Mace", "Horseman's Mace", "Morning Star", "Quarterstaff", "Hammer"],
  "Hafted": ["Battle Axe", "Hand Axe", "Footman's Flail", "Horseman's Flail", "Footman's Pick", "Horseman's Pick"],
  "Pole Arms": ["Bardiche", "Bec de Corbin", "Bill-Guisarme", "Fauchard", "Fauchard-Fork", "Glaive", "Glaive-Guisarme", "Guisarme", "Guisarme-Voulge", "Halberd", "Lucern Hammer", "Military Fork", "Partisan", "Pike", "Ranseur", "Spetum", "Voulge", "Spear", "Trident"],
  "Hurled": ["Dart", "Javelin", "Harpoon", "Bolas"],
  "Bows": ["Short Bow", "Long Bow", "Composite Short Bow", "Composite Long Bow"],
  "Crossbows": ["Hand Crossbow", "Light Crossbow", "Heavy Crossbow"],
  "Slings": ["Sling"],
};

const dir = path.resolve("packs", "weapon-proficiencies", "_source");
mkdirSync(dir, { recursive: true });
let count = 0;
for (const [group, names] of Object.entries(LIST)) {
  for (const name of names) {
    const _id = createHash("sha1").update(`adnd2e-weapon-proficiency:${name}`).digest("hex").slice(0, 16);
    const doc = {
      _id,
      _key: `!items!${_id}`,
      name,
      type: "weaponProficiency",
      img: "icons/svg/sword.svg",
      system: {
        description: "",
        weaponOrGroup: name,
        isGroup: false,
        slotsInvested: 0,
        styleSpecialization: null,
        masteryTier: 0,
        proficiencyGroup: group,
      },
    };
    const slug = name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    writeFileSync(path.join(dir, `${slug}.json`), `${JSON.stringify(doc, null, 2)}\n`);
    count++;
  }
}
console.log(`wrote ${count} documents to ${dir}`); // must print 51
```

Then create `packs/weapon-proficiencies/_source/_MANIFEST.md` (build-packs only counts `.json` files):
```markdown
# `weapon-proficiencies` pack — source manifest

51 specific-weapon proficiency items (`weaponProficiency`, `isGroup: false`), one per weapon name, each
carrying its weapon group in `system.proficiencyGroup` (one of the 8 groups in `weapon-proficiency-groups`).
Used by the Skills & Powers expanded-proficiencies rule (Sub-project 8 Plan 8b): holding one of these
makes every OTHER weapon in the same group "related" (half the non-proficiency attack penalty).

Names are PHB weapon vocabulary; the weapon -> group assignment is this project's own design.
Names and group assignment ONLY — no weapon statistics, no rules prose (`system.description` is `""`).
Weapons that fit none of the 8 groups (whip, net, blowgun, lasso, garrot, ...) are intentionally omitted.
`_id` = first 16 hex chars of SHA-1("adnd2e-weapon-proficiency:" + name); files are named by kebab-case slug.
```

- [ ] **Step 6: Run the tests, typecheck, lint, coverage**

Run: `npx vitest run tests/packs > /tmp/8b2b.log 2>&1; tail -n 40 /tmp/8b2b.log`
Run: `npm run typecheck > /tmp/8b2-tc.log 2>&1; tail -n 30 /tmp/8b2-tc.log`
Run: `npm run lint > /tmp/8b2-lint.log 2>&1; tail -n 30 /tmp/8b2-lint.log`
Run: `npm run test:coverage > /tmp/8b2-cov.log 2>&1; tail -n 60 /tmp/8b2-cov.log`
Expected: all PASS — 51 documents, every `_id` 16 alphanumeric chars and unique, `_key` correct, the new pack resolved in `packFolders`, coverage thresholds held. Confirm `node -e "JSON.parse(require('fs').readFileSync('system.json','utf8'))"` parses.

- [ ] **Step 7: Commit**

```bash
git add src/data/item/weapon-proficiency.ts system.json packs/weapon-proficiencies tests/packs/content.test.ts
git commit -m "feat(sp8b): add proficiencyGroup field and the specific-weapon proficiency pack

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Wire the related-weapon penalty into the attack roll

**Files:**
- Modify: `src/sheets/character/combat-rolls.ts` (`resolveProficiencyModifier` + its imports + doc comment)
- Modify: `src/core/combat/attack.ts` (doc comment on `proficiencyModifier` only)
- Modify: `lang/en.json` (the `expandedProficiencies` setting hint)

Foundry-layer — not unit-tested (the pure logic is Task 1's); typecheck/lint gated, dev-world verified in Task 5.

**Interfaces:**
- Consumes: `expandedProficienciesEnabled`, `isRelatedGroup`, `weaponProficiencyMode` (Task 1, from `../../core/proficiencies/weapon-relation`); `system.proficiencyGroup` on weaponProficiency items (Task 2); existing `weaponAttackPenalty`, `weaponMasteryEffect`, `getChassis`, `getOptionalRules`.
- Produces: nothing new consumed later — `resolveProficiencyModifier` keeps its signature `(actor: AttackerActor, weapon: WeaponItemHandle) => number`.

**Current real state** (confirmed during planning — `src/sheets/character/combat-rolls.ts:87-150`):
```typescript
function resolveProficiencyModifier(actor: AttackerActor, weapon: WeaponItemHandle): number {
  let isProficient = false;
  let masteryTier: 0 | 1 | 2 | 3 = 0;
  let groupMatch: { masteryTier?: 0 | 1 | 2 | 3 } | null = null;
  for (const item of actor.items) {
    if (item.type !== "weaponProficiency") continue;
    const s = item.system as { weaponOrGroup?: string; isGroup?: boolean; masteryTier?: 0 | 1 | 2 | 3 };
    if (s.isGroup !== true && s.weaponOrGroup === weapon.name) {
      isProficient = true;
      masteryTier = s.masteryTier ?? 0;
      groupMatch = null;
      break;
    }
    if (s.isGroup === true && s.weaponOrGroup === weapon.system.proficiencyGroup && !groupMatch) {
      groupMatch = s;
    }
  }
  if (!isProficient && groupMatch) {
    isProficient = true;
    masteryTier = groupMatch.masteryTier ?? 0;
  }

  let nonProficiencyPenalty = 0;
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const chassisId = (item.system as { chassisId?: string }).chassisId;
    if (chassisId) {
      nonProficiencyPenalty = getChassis(chassisId as ClassId).nonProficiencyPenalty;
      break;
    }
  }

  const base = weaponAttackPenalty(nonProficiencyPenalty, isProficient ? "proficient" : "non-proficient");
  if (!isProficient || masteryTier === 0) return base;

  // Tier 1 (Specialized) is the pre-existing, always-on mechanic — ... (long comment)
  const rules = getOptionalRules();
  const masteryEnabled = rules.combatAndTacticsEnabled && rules.weaponMastery;
  const effectiveTier = masteryEnabled ? masteryTier : (Math.min(masteryTier, 1) as 0 | 1);

  const category = weapon.system.category === "bow" ? "bow" : weapon.system.category === "crossbow" ? "crossbow" : "melee";
  return base + weaponMasteryEffect(effectiveTier, category).toHit;
}
```
Line 7 imports `weaponAttackPenalty` from `"../../core/proficiencies/weapon"`; `getOptionalRules` is already imported (`"../../settings"`); `WeaponItemHandle.system.proficiencyGroup` is typed `string`.

- [ ] **Step 1: Read the CURRENT file first**

Read `src/sheets/character/combat-rolls.ts` lines 1-150 and confirm the function still matches the excerpt above (Plans 7c/7d touched this file). Anything different → report it before editing.

- [ ] **Step 2: Add the import**

Next to the existing `weaponAttackPenalty` import add:
```typescript
import { expandedProficienciesEnabled, isRelatedGroup, weaponProficiencyMode } from "../../core/proficiencies/weapon-relation";
```

- [ ] **Step 3: Replace `resolveProficiencyModifier` and its doc comment**

Replace the doc comment (currently ending "…Only "proficient"/"non-proficient" are ever resolved; "related" weapon proficiency isn't modeled anywhere in this codebase. Tier 1 …") and the function with:
```typescript
/** Resolves the attack-roll `proficiencyModifier` (per core/combat/attack.ts's
 *  AttackModifierInput doc comment) by matching `weapon` against the actor's
 *  weaponProficiency items — by exact name for a specific-weapon proficiency,
 *  or by `weaponOrGroup === weapon.system.proficiencyGroup` for a group
 *  proficiency (both -> "proficient", penalty 0). Only when neither matches AND
 *  the Skills & Powers expanded-proficiencies rule is on
 *  (`expandedProficienciesEnabled`), a held SPECIFIC-weapon proficiency in the
 *  same weapon group makes the weapon "related": half the non-proficiency
 *  penalty (`weaponAttackPenalty(p, "related")`), and no mastery bonus — mastery
 *  applies only in "proficient" mode. Uses the FIRST class item's chassis for
 *  the non-proficiency penalty and the mastery category-to-bonus lookup (a
 *  documented v1 simplification for multi-classed actors). Precedence:
 *  exact > group > related > non-proficient. Rule off -> exactly the pre-8b
 *  behavior. Tier 1 (Specialized) is the pre-existing, always-on mechanic;
 *  tiers 2-3 (Mastery/Grand Mastery) are gated behind the `weaponMastery`
 *  optional rule and capped back down to tier 1 when it's off. ROLL-time rule:
 *  `getOptionalRules()` is read fresh on every attack, so toggling a setting
 *  needs no reload. */
function resolveProficiencyModifier(actor: AttackerActor, weapon: WeaponItemHandle): number {
  const rules = getOptionalRules();
  let exactMatch = false;
  let exactTier: 0 | 1 | 2 | 3 = 0;
  let groupMatch: { masteryTier?: 0 | 1 | 2 | 3 } | null = null;
  const heldSpecificGroups: string[] = [];
  for (const item of actor.items) {
    if (item.type !== "weaponProficiency") continue;
    const s = item.system as {
      weaponOrGroup?: string;
      isGroup?: boolean;
      masteryTier?: 0 | 1 | 2 | 3;
      proficiencyGroup?: string;
    };
    if (s.isGroup !== true && s.weaponOrGroup === weapon.name) {
      exactMatch = true;
      exactTier = s.masteryTier ?? 0;
      groupMatch = null;
      break;
    }
    if (s.isGroup === true && s.weaponOrGroup === weapon.system.proficiencyGroup && !groupMatch) {
      groupMatch = s;
    }
    if (s.isGroup !== true && s.proficiencyGroup) heldSpecificGroups.push(s.proficiencyGroup);
  }

  const relatedGroupMatch =
    expandedProficienciesEnabled(rules) && isRelatedGroup(weapon.system.proficiencyGroup, heldSpecificGroups);
  const mode = weaponProficiencyMode({ exactMatch, groupMatch: groupMatch !== null, relatedGroupMatch });
  const isProficient = mode === "proficient";
  const masteryTier = exactMatch ? exactTier : (groupMatch?.masteryTier ?? 0);

  let nonProficiencyPenalty = 0;
  for (const item of actor.items) {
    if (item.type !== "class") continue;
    const chassisId = (item.system as { chassisId?: string }).chassisId;
    if (chassisId) {
      nonProficiencyPenalty = getChassis(chassisId as ClassId).nonProficiencyPenalty;
      break;
    }
  }

  const base = weaponAttackPenalty(nonProficiencyPenalty, mode);
  // "related" and "non-proficient" never carry a mastery bonus.
  if (!isProficient || masteryTier === 0) return base;

  // Tier 1 (Specialized) is the pre-existing, always-on mechanic — it applies
  // regardless of the weaponMastery toggle. Tiers 2-3 are capped back down to
  // tier 1 whenever the optional rule is off, re-checked here at roll time (see
  // the doc comment above; `rules` is the single read at the top).
  const masteryEnabled = rules.combatAndTacticsEnabled && rules.weaponMastery;
  const effectiveTier = masteryEnabled ? masteryTier : (Math.min(masteryTier, 1) as 0 | 1);

  const category = weapon.system.category === "bow" ? "bow" : weapon.system.category === "crossbow" ? "crossbow" : "melee";
  return base + weaponMasteryEffect(effectiveTier, category).toHit;
}
```
(Keep the surrounding file byte-for-byte; the only edits in this file are the import line and this function + comment.)

- [ ] **Step 4: Update the two documentation touches**

`src/core/combat/attack.ts`: in the doc comment on `AttackModifierInput.proficiencyModifier` (lines ~11-18), change the first sentence so it reads: `0 if proficient; the class non-proficiency penalty if not (half of it, rounded up, for a "related" weapon when the Skills & Powers expanded-proficiencies rule is on); tiered mastery bonus if specialized/mastered.` — comment only, no code change.

`lang/en.json`: replace the `expandedProficiencies` hint with:
```json
        "hint": "A weapon in the same group as a specific-weapon proficiency you hold counts as \"related\": half the non-proficiency attack penalty (Skills & Powers)."
```
(keep the `name` and valid JSON — mind the escaped quotes).

- [ ] **Step 5: Typecheck, lint, full suite**

Run: `npm run typecheck > /tmp/8b3-tc.log 2>&1; tail -n 30 /tmp/8b3-tc.log`
Run: `npm run lint > /tmp/8b3-lint.log 2>&1; tail -n 30 /tmp/8b3-lint.log`
Run: `npm run test:coverage > /tmp/8b3-cov.log 2>&1; tail -n 60 /tmp/8b3-cov.log`
Expected: all PASS, thresholds met (no test changes in this task — `combat-rolls.ts` is outside the coverage `include`). Also confirm `node -e "require('./lang/en.json')"` parses.

- [ ] **Step 6: Self-check the rule-off equivalence (write it in your report)**

Walk each of these cases through the NEW function with the rule off and state the returned value, confirming each equals what the OLD function returned: (a) exact-name proficiency tier 0; (b) exact-name proficiency tier 1 (mastery off); (c) group proficiency only; (d) no proficiency at all; (e) a held same-group specific proficiency but rule OFF (must still be the full non-proficient penalty). Then state the rule-ON result for (e) (half penalty) and for an exact-name tier-1 proficiency (unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/sheets/character/combat-rolls.ts src/core/combat/attack.ts lang/en.json
git commit -m "feat(sp8b): resolve the related-weapon proficiency penalty in the attack roll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Whole-branch review

**MANDATORY regardless of how clean every per-task review was.** Every plan in Sub-project 7 (7a-7d) had a real Critical/Important bug caught ONLY here; Plan 8a's found one Important (a setting that needed `requiresReload`). Treat it as the primary safety net.

- [ ] Dispatch a whole-branch review on the most capable available model over the full range from this branch's base to HEAD. Point it at this plan's Global Constraints, "Locked design decisions", and spec §2/§4.2/§5/§7. Ask it to check, specifically:
  - **Gate stated once.** `grep` the diff and `src/` for `expandedProficiencies` / `skillsAndPowersEnabled`: outside `options.ts`, `registry.ts`, `sub-abilities.ts` (8a), `weapon-relation.ts` (`expandedProficienciesEnabled`) and tests, nothing restates the `&&`; `combat-rolls.ts` calls the helper.
  - **Rule-off byte-for-byte.** Trace `resolveProficiencyModifier` for every attacker/weapon combination with the rule off (and with only the master or only the toggle on) and confirm the returned number equals the pre-8b function's. In particular: the exact-name `break` and `groupMatch = null` reset are preserved; the first-group-wins behavior is preserved; `heldSpecificGroups` only affects the result when `expandedProficienciesEnabled(rules)`.
  - **Precedence vs exact/group/related.** An exact or group match is never demoted to "related"; a related match never applies when an exact/group match exists; with no match the full non-proficient penalty stands; an empty weapon `proficiencyGroup` or an empty held `proficiencyGroup` never matches (including a group-proficiency item, which must not contribute to `heldSpecificGroups`).
  - **No mastery leakage.** A "related" weapon returns exactly `weaponAttackPenalty(p, "related")` and never `+ weaponMasteryEffect(...)`; the mastery gate (`combatAndTacticsEnabled && weaponMastery`) and the tier-1-always-on rule are unchanged and now use the single top-level `rules`.
  - **One settings read.** No leftover second `getOptionalRules()` in the function; no shadowed `rules`.
  - **Pack integrity.** All 51 docs have 16-char `[A-Za-z0-9]` unique `_id`s and `_key: "!items!<_id>"` (the foundryvtt-cli silent-drop gotcha); the pack is in `system.json` `packs` AND the "Proficiencies" `packFolders` entry; every `proficiencyGroup` is one of the 8 real group names (spelling, e.g. `Pole Arms`); `weaponOrGroup === name`; no weapon statistics/rules prose (content policy); `_MANIFEST.md` present; the drift tests actually assert these (not vacuous).
  - **Additive schema, no migration.** Only `proficiencyGroup` added; the SP7c `migrateData` shim is untouched; `package.json`/`system.json` `version` unchanged; Task 2's report cites real v14.364 evidence for the missing-field initialisation.
  - **Drop path.** A pack item dropped on a PC or NPC sheet ends with `slotsInvested = 1` via the existing `_onDropItem` (no change needed); confirm nothing in the diff altered `_onDropItem`/`validateItemDrop`.
  - **Roll-time, no reload.** Confirm no `requiresReload` was added for `expandedProficiencies`.
  - **A mutation the acting non-GM user may not be permitted to make.** This plan adds no writes (roll-time read + pack data); confirm, and confirm a non-GM player can drag from the new pack (`ownership: PLAYER OBSERVER`) onto an actor they own.
  - **Template context binding:** no template is touched — confirm; if one was, any root reference inside `{{#each}}` needs `@root.`.
  - Coverage/typecheck/lint green (re-run independently).
- [ ] Fix every Critical/Important finding via the standard fix-round process (the controller never fixes findings directly); one scoped re-review of the fix wave.
- [ ] Once clean, run `npm run typecheck && npm run lint && npm run test:coverage` and confirm green before Task 5.

---

### Task 5: GATED dev-world smoke check

**REQUIRED — never deferred, never skipped, and it MUST include a non-GM player seat.** Confirm with the user that Foundry is fully closed before `npm run build` (this is where the new pack is first really compiled — the build's read-back guard fails loudly on a count mismatch), then `npm run link`, then have the user restart Foundry. Toggling `expandedProficiencies` needs NO world reload — the rule is roll-time (contrast Plan 8a); toggling the MASTER switch still prompts one (from Plan 8a), so accept that prompt whenever the master changes.

Setup (a test world with the Skills & Powers master and `expandedProficiencies` toggles ready): a single-class **fighter** PC (non-proficiency penalty −2, so "related" = −1; a wizard would be −5 → −3 if you want a second data point), a second **Player-role** user account (private/incognito window) that owns that PC, and — because no weapon compendium exists and owned items can't be edited from the PC sheet — create these **world Items** in the Items directory (weapon type, category melee, `damageType` slashing, and set the `proficiencyGroup` field): **Long Sword** and **Short Sword** with `proficiencyGroup: Blades`, and **Battle Axe** with `proficiencyGroup: Hafted`; drag them onto the PC.

- [ ] **Pack present:** the compendium sidebar shows "Weapon Proficiencies" (in the Proficiencies folder) with 51 items; the build log said `weapon-proficiencies  51/51 documents OK`.
- [ ] **Rule off = today:** give the PC the "Long Sword" proficiency dragged from the new pack (it should land with 1 slot invested). Attack with **Short Sword** (same Blades group, no proficiency of its own): the attack card's proficiency modifier shows the FULL non-proficient penalty (−2). Attack with **Long Sword**: 0 (exact match). Attack with **Battle Axe**: −2.
- [ ] **Gates:** turn ON only `expandedProficiencies` (master OFF) → Short Sword still −2. Turn ON only the master → still −2. Turn ON both (accept the master's reload prompt; the `expandedProficiencies` toggle itself needs none) → Short Sword now shows **−1** (half of −2, rounded up); Long Sword still 0; Battle Axe (a different group, Hafted) still −2.
- [ ] **No mastery leakage:** Specialize the "Long Sword" proficiency (Advance Mastery → Specialized, +1 to-hit on the sword — the SP5a/7c path, unchanged; needs a single-classed fighter with enough weapon slots and the owned weapon named exactly "Long Sword"). Attack with Long Sword → 0 + 1 = **+1**; attack with Short Sword (related) → still **−1**, NOT 0.
- [ ] **Group proficiency still wins:** drag the "Blades" GROUP proficiency (from the groups pack) onto the PC → Short Sword becomes **0** (group match beats related); remove it and Short Sword returns to −1.
- [ ] **Drop path:** a pack proficiency dropped on the PC lands with `slotsInvested` 1; the same on the NPC sheet also lands with 1; dropping when no weapon slots remain shows the existing "insufficient slots" toast on the PC sheet (unchanged behavior).
- [ ] **NON-GM PLAYER SEAT:** as the Player user (private window) owning the PC: open the compendium sidebar and drag "Long Sword" (or another) from the Weapon Proficiencies pack onto their own sheet (allowed, lands with slotsInvested 1, no permission error); with both rules ON attack with Short Sword and see the −1 related penalty on the card; confirm the player cannot change the world settings.
- [ ] Report each item PASS/FAIL to the user via `AskUserQuestion`, following this project's established pattern; distinguish a genuine code defect from a test-design mistake or test-setup gap (e.g. a weapon whose `proficiencyGroup` is empty or misspelled, an owned weapon's name not matching the proficiency's `weaponOrGroup`, the attack modifier line not being the one checked) before concluding a FAIL. Fix real defects via the standard fix-round process, never directly.

---

## After this plan lands

Update `README.md`: Sub-project table row 8 → `🚧 In progress (Plans 8a-8b/3 done)` with the expanded-proficiencies scope added; and refresh the "Compendium content" section, which still says the system ships four Item packs (it now ships classes, races, nonweapon-proficiencies, weapon-proficiency-groups, weapon-proficiencies, conditions). Follow this project's established finishing default: push and create a pull request without asking. Plan 8c (character-point build) is next — write it against the same spec (§4.3); remember the reserved untyped field is `system.options.skillsAndPowers`, and that 8c's `characterPointBuild` setting needs `requiresReload: true` (it changes prepare-time derived data), unlike this plan's roll-time rule.
