# AD&D 2E — Plan 1b.2b: Remaining Class Chassis (Paladin, Ranger, Druid, Bard)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the `src/core/` class layer — add the four remaining PHB player classes (Paladin, Ranger, Druid, Bard) as `ClassChassis` constants, their limited spell progressions and the Druid sphere-access table, the Ranger stealth table, and the `minAbility` on the wizard specialist profiles. Change `primeRequisiteXpBonus` to the multi-ability rule these classes need. Specialist wizards are NOT new `ClassId`s — they are the Mage chassis plus a `specialistSchool` selector, wired in Plan 1c.

**Architecture:** Continues Plans 1b/1b.2–1b.7's pure `src/core/` engine (pure functions + literal lookup tables, no Foundry imports, enforced by `tsconfig.core.json` + ESLint, 100% Vitest coverage gate). New chassis go in the existing `classes/chassis.ts`; new spell tables + `DRUID_SPHERE_ACCESS` in `magic/tables.ts`; new slot functions in `magic/class-slots.ts`; the Ranger stealth table in `classes/ranger.ts`. `progression.ts` gains `maxLevel` / variable-length-`xpThresholds` handling for the Druid's level-14 cap.

**Tech Stack:** TypeScript 5 strict; Vitest 5 (`test:coverage` gate at 100% lines/statements/functions, ≥90% branches on `src/core/**`); ESLint 10.

**Spec:** `docs/superpowers/specs/2026-09-07-adnd2e-foundation-design.md` — §1 (the 9 sub-projects; 1b.2b completes the class engine), §5.4 (`class` item schema — the `classes` compendium pack in Plan 1c is built from these chassis), §6.1 (`CONFIG.ADND2E.classGroups`), §9, §11.

**Research source:** `references/research-notes.md` (git-ignored) — section "PLAN 1b.2b: REMAINING CLASS CHASSIS" — Tables 13/14/17/18/23/25/32/33 and the class blocks from the user's PHB Ch.3 (pp.25–43), verified visually. The XP tables (Table 14 Paladin/Ranger column, Table 23 Druid column, Table 25 Thief/Bard column) are already transcribed higher in that file.

## Global Constraints

- **`src/core/` imports nothing** from `foundry`, `game`, `CONFIG`, `ui`, `canvas`, `Hooks`, the DOM, `fvtt-types`, or any relative path outside `src/core/`. Enforced by `tsconfig.core.json` (`types: []`, `lib: ["ESNext"]`) in the `typecheck` gate and the `no-restricted-globals` / `no-restricted-imports` ESLint block on `src/core/**` + `tests/core/**`.
- `src/core/magic/` and `src/core/classes/` take no runtime dependency on another core domain (Plan 1b.5–1b.7 rule). `classes/ranger.ts` and `magic/class-slots.ts` may `import type` from `../types` and value-import guards from `../errors` and (within the same domain) `magic/tables.ts`.
- Core functions return **plain data** (numbers, records, readonly arrays) — never a Foundry `Roll`.
- TypeScript `strict: true`. Prettier printWidth 100, 2-space, double quotes, semi, trailing-comma all. **Do not run `npm run format`.** Precede any hand-aligned table with `// prettier-ignore`.
- No copyrighted prose in the repo — mechanical/factual values only. Files with a table carry a `// PHB Table N, p.XX` citation comment.
- `src/core/**` stays at **100% lines / statements / functions** and **≥90% branches** (`npm run test:coverage`, enforced in CI). Every task's own tests must hold that.
- `ClassChassis`, `ClassId`, `ClassGroup`, `AbilityKey`, `AbilityScores`, `SphereName`, `SphereAccess`, `WizardSchool`, `ThiefSkill`, `SpellSlots` already exist in `src/core/types.ts`. `assertLevel`, `assertAbilityScore`, `assertSpellLevel` in `src/core/errors.ts`. `FIGHTER`/`MAGE`/`CLERIC`/`THIEF` chassis, `getChassis`, `xpForLevel`/`levelForXp`/`hitDice`, `SPECIALIST_SCHOOLS`, `PRIEST_SPELL_PROGRESSION`, `priestSpellSlots`, `CLERIC_SPHERE_ACCESS` already exist. Import / extend, do not redefine.

## Class facts (from `references/research-notes.md` §"PLAN 1b.2b")

| | Paladin | Ranger | Druid | Bard |
|---|---|---|---|---|
| group | warrior | warrior | priest | rogue |
| HD | d10 | d10 | d8 | d6 |
| hp after name level / cutoff | +3 @ 9 | +3 @ 9 | +2 @ 9 | +2 @ 10 |
| prime requisites | str, cha | str, dex, wis | wis, cha | dex, cha |
| ability minimums (Table 13) | str 12, con 9, wis 13, cha 17 | str 13, dex 13, con 14, wis 14 | wis 12, cha 15 | dex 12, int 13, cha 15 |
| races | human | human, elf, half-elf | human, half-elf | human, half-elf |
| XP table | Table 14 Paladin/Ranger col | Table 14 Paladin/Ranger col | Table 23 Druid col (L1–14) | Table 25 Thief/Bard col = `THIEF_XP` |
| XP beyond 20 | +300,000/level | +300,000/level | — (`maxLevel` 14) | +220,000/level |
| non-proficiency penalty | −2 (warrior) | −2 (warrior) | −3 (priest) | −3 (rogue) |
| weapon prof slots | 4 / 3 | 4 / 3 | 2 / 4 | 2 / 4 |
| non-weapon prof slots | 3 / 3 | 3 / 3 | 4 / 3 | 3 / 4 |
| armor | any | any | `["leather"]` only (+ wooden shield — a shield, not `armorAllowed`; PHB p.35) | `["padded","leather","studded leather","ring mail","brigandine","scale mail","hide","chain mail"]` — up to chain mail, no shield (PHB p.41) |
| weapons | any | any | `["club","sickle","dart","spear","dagger","scimitar","sling","staff"]` | any |
| weapon specialization | no | no | no | no |
| caster type / progression | priest / `"paladin"` | priest / `"ranger"` | priest / `"priest"` | wizard / `"bard"` |
| spell start level | 9 | 8 | 1 | 2 |
| Wisdom bonus spells | **no** (PHB p.28) | **no** (PHB p.29) | **yes** (full priest) | n/a (wizard caster) |
| thief-skill access | — | — (own stealth table) | — | `["pick-pockets","climb-walls","detect-noise","read-languages"]` |

- **Paladin / Ranger cast priest spells with no Wisdom bonus** — their slot functions are straight table lookups. The Paladin casts from spheres combat/divination/healing/protection; the Ranger from plant/animal. Sphere gating is a caller/`classFeature` concern (Plan 1c), not this plan.
- **Druid is a full priest for slots** — the derive layer (Plan 1c) calls the existing `priestSpellSlots({ priestLevel: druidLevel, wisdomScore, wisdomBonusSpells })`. `DRUID_SPHERE_ACCESS` (major: all, animal, elemental, healing, plant, weather; minor: divination) is the deferred Plan 1b.5 carry-forward.
- **Druid level cap:** the base rules cap a druid at 14 (level 15 = the unique Grand Druid, 16–20 = the hierophant path with a restarted XP progression — PHB p.37). This plan sets `maxLevel: 14` and ships only the L1–14 XP thresholds; the hierophant path is a later-plan feature.
- **Bard casts wizard spells** (Table 32) from level 2, casting level = bard level, Intelligence-gated for spells-known like a Mage, **no specialization ever**. Its four thief skills use the existing thief point-pool machinery (Plan 1b.6) — this plan only records which four via `thiefSkillAccess`.
- **`primeRequisiteXpBonus`** must become the multi-ability rule (PHB p.26: *"a score of 16 or more in **all** his prime requisites"*). Old signature `(group: ClassGroup, scores)`; new `(primeRequisites: readonly AbilityKey[], scores: AbilityScores)` → `primeRequisites.every((k) => scores[k] >= 16)`. Its only consumer is Plan 1c (not yet written).
- **Specialist wizards** are the Mage chassis (`hitDie` d4, `MAGE_XP`, wizard group / THAC0 / saves / progression) with a `specialistSchool`. This plan adds `minAbility` to each `SPECIALIST_SCHOOLS` profile (PHB Table 22: Abjurer 15 wis, Conjurer 15 con, Diviner 16 wis, Enchanter 16 cha, Illusionist 16 dex, Invoker 16 con, Necromancer 16 wis, Transmuter 15 dex). Plan 1c builds the eight `class` items from `{ chassis: MAGE, specialistSchool, minAbility }`.
- **Out of scope for Plan 1b.2b** (Plan 1c `classFeature` data + later sub-projects): every special ability — lay on hands, cure disease, detect evil, protection aura, turn undead, holy sword (paladin); tracking, species enemy, animal empathy, two-weapon style, followers (ranger); shapechange, plant/animal identification, hierophant progression past 14 (druid); bardic knowledge %, influence reactions, rally allies / counter-fear (bard); paladin/ranger warhorse; multi-/dual-class rules; the `data/` layer.

---

## File Structure

**Created:**
- `src/core/magic/class-slots.ts` — `paladinSpellSlots`, `rangerSpellSlots`, `bardSpellSlots`.
- `src/core/classes/ranger.ts` — `RANGER_STEALTH`, `rangerStealth`.
- `tests/core/magic/class-slots.test.ts`
- `tests/core/classes/ranger.test.ts`
- `tests/core/classes/new-chassis.test.ts`

**Modified:**
- `src/core/types.ts` — `ClassId` += `paladin | ranger | druid | bard`; `ClassChassis` += `maxLevel`, `spellStartLevel`, `spellProgressionId`, `thiefSkillAccess`.
- `src/core/abilities/index.ts` — `primeRequisiteXpBonus` signature change.
- `src/core/classes/chassis.ts` — the four new chassis + XP arrays; `BY_ID` → 8; the four existing chassis get the four new fields.
- `src/core/classes/progression.ts` — `xpForLevel` / `levelForXp` honour `chassis.maxLevel` and a variable-length `xpThresholds`.
- `src/core/magic/tables.ts` — `PALADIN_SPELL_PROGRESSION`, `RANGER_SPELL_PROGRESSION`, `BARD_SPELL_PROGRESSION`, `DRUID_SPHERE_ACCESS`; `SpecialistProfile` gains `minAbility`; each `SPECIALIST_SCHOOLS` entry gets its `minAbility`.
- `src/core/magic/index.ts` — `export * from "./class-slots";`.
- `src/core/classes/index.ts` — `export * from "./ranger";`.
- `tests/core/abilities/index.test.ts` — update `primeRequisiteXpBonus` cases.
- `tests/core/classes/progression.test.ts` — add `maxLevel` cases.
- `tests/core/magic/tables.test.ts` — add the new tables + `minAbility` assertions.
- `tests/core/index.test.ts` — extend the barrel smoke test.

---

## Task 1: shared types, `primeRequisiteXpBonus`, `progression.ts` cap handling

**Files:**
- Modify: `src/core/types.ts`, `src/core/abilities/index.ts`, `src/core/classes/progression.ts`, `src/core/classes/chassis.ts`, `tests/core/abilities/index.test.ts`, `tests/core/classes/progression.test.ts`

**Interfaces:**
- Produces:
  - `type SpellProgressionId = "wizard" | "priest" | "paladin" | "ranger" | "bard"`.
  - (`ClassId` is widened to 8 members in **Task 2**, together with the four chassis and `BY_ID` — keeping the `Record<ClassId, ClassChassis>` completeness check green.)
  - `ClassChassis` gains: `maxLevel: number | null` (class-intrinsic level cap; `null` = uncapped), `spellStartLevel: number | null` (first level a caster gets a spell; `null` for non-casters or from-level-1 casters), `spellProgressionId: SpellProgressionId | null`, `thiefSkillAccess: readonly ThiefSkill[] | null`.
  - `function primeRequisiteXpBonus(primeRequisites: readonly AbilityKey[], scores: AbilityScores): boolean` — `primeRequisites.every((k) => scores[k] >= 16)`. Empty array → `true` (vacuous — no class has zero prime requisites, but the reduction is well-defined).
  - `xpForLevel(chassis, level)` — unchanged for `level` within the table; if `chassis.maxLevel != null && level > chassis.maxLevel` throw `RangeError`; if `level > chassis.xpThresholds.length` and `maxLevel == null`, extrapolate with `xpPerLevelBeyond20` from the last table entry.
  - `levelForXp(chassis, xp)` — as now, but the result is `Math.min(result, chassis.maxLevel ?? Number.POSITIVE_INFINITY)`, and the table scan / beyond-table extrapolation both use `chassis.xpThresholds.length` rather than the constant `20`.

- [ ] **Step 1: Add the types to `src/core/types.ts`**

Do **not** touch `ClassId` in this task — Task 2 widens it alongside the chassis so the `Record<ClassId, ClassChassis>` in `BY_ID` never has a gap. Add, after `ClassId`:

```ts
/** Which spell-slot table a caster class uses (PHB Tables 21/24/17/18/32). */
export type SpellProgressionId = "wizard" | "priest" | "paladin" | "ranger" | "bard";
```

In `ClassChassis`, add these four fields (keep the rest):

```ts
  /** class-intrinsic maximum level (`null` = uncapped; Druid = 14 in the base rules) */
  maxLevel: number | null;
  /** the character level at which this caster gains its first spell (`null` = non-caster or casts from level 1) */
  spellStartLevel: number | null;
  /** which spell-slot table this class uses (`null` = non-caster) */
  spellProgressionId: SpellProgressionId | null;
  /** the thieving skills this class may spend points on (`null` = none, or — for the Thief — all of them) */
  thiefSkillAccess: readonly ThiefSkill[] | null;
```

(`ThiefSkill` is already imported into `types.ts`? It is defined there — no import needed.)

- [ ] **Step 2: Failing test — `primeRequisiteXpBonus`**

Replace the existing `primeRequisiteXpBonus` block in `tests/core/abilities/index.test.ts` with:

```ts
describe("primeRequisiteXpBonus", () => {
  const scores = { str: 16, dex: 16, con: 10, int: 12, wis: 15, cha: 17 };
  it("single prime requisite met", () => {
    expect(primeRequisiteXpBonus(["str"], scores)).toBe(true);
    expect(primeRequisiteXpBonus(["wis"], scores)).toBe(false); // 15
  });
  it("multi prime requisite needs 16+ in every one", () => {
    expect(primeRequisiteXpBonus(["str", "cha"], scores)).toBe(true); // 16 & 17
    expect(primeRequisiteXpBonus(["str", "dex", "wis"], scores)).toBe(false); // wis 15
    expect(primeRequisiteXpBonus(["dex", "cha"], scores)).toBe(true);
  });
  it("empty list is vacuously true", () => {
    expect(primeRequisiteXpBonus([], scores)).toBe(true);
  });
});
```

- [ ] **Step 3: Run — expect failure.** `npm run test -- tests/core/abilities/index.test.ts`

- [ ] **Step 4: Change `primeRequisiteXpBonus` in `src/core/abilities/index.ts`**

Delete the `PRIME_REQUISITE` constant and replace the function:

```ts
/**
 * PHB p.26: a character with a score of 16 or more in **every** one of the
 * class's prime requisites earns a 10% experience bonus.
 */
export function primeRequisiteXpBonus(
  primeRequisites: readonly AbilityKey[],
  scores: AbilityScores,
): boolean {
  return primeRequisites.every((k) => scores[k] >= 16);
}
```

(Adjust the imports at the top of `abilities/index.ts` — `AbilityKey` is already imported for other uses; remove `ClassGroup` from the import only if nothing else in the file uses it.)

- [ ] **Step 5: Failing test — `progression.ts` cap handling**

Add to `tests/core/classes/progression.test.ts` (import `DRUID` will not exist until Task 2 — use a local stub chassis for this task's test so Task 1 is self-contained):

```ts
import type { ClassChassis } from "../../../src/core/types";

const CAPPED: ClassChassis = {
  ...getChassis("cleric"),
  maxLevel: 14,
  // 14 real thresholds (arbitrary ascending values for the test)
  xpThresholds: [0, 2000, 4000, 7500, 12500, 20000, 35000, 60000, 90000, 125000, 200000, 300000, 750000, 1500000],
  xpPerLevelBeyond20: 0,
};

describe("progression with a maxLevel cap", () => {
  it("levelForXp never exceeds maxLevel", () => {
    expect(levelForXp(CAPPED, 1500000)).toBe(14);
    expect(levelForXp(CAPPED, 99_000_000)).toBe(14);
    expect(levelForXp(CAPPED, 90000)).toBe(9);
  });
  it("xpForLevel throws past the cap", () => {
    expect(xpForLevel(CAPPED, 14)).toBe(1500000);
    expect(() => xpForLevel(CAPPED, 15)).toThrow(RangeError);
  });
});
```

- [ ] **Step 6: Run — FAIL.**

- [ ] **Step 7: Update `src/core/classes/progression.ts`**

```ts
export function xpForLevel(chassis: ClassChassis, level: number): number {
  assertLevel(level, "class level");
  if (chassis.maxLevel != null && level > chassis.maxLevel) {
    throw new RangeError(`${chassis.id} cannot advance past level ${chassis.maxLevel}, got ${level}`);
  }
  const tableLength = chassis.xpThresholds.length;
  if (level <= tableLength) {
    return chassis.xpThresholds[level - 1];
  }
  return chassis.xpThresholds[tableLength - 1] + (level - tableLength) * chassis.xpPerLevelBeyond20;
}

export function levelForXp(chassis: ClassChassis, xp: number): number {
  assertXp(xp);
  const cap = chassis.maxLevel ?? Number.POSITIVE_INFINITY;
  const tableLength = chassis.xpThresholds.length;
  const top = chassis.xpThresholds[tableLength - 1];
  if (xp >= top && chassis.xpPerLevelBeyond20 > 0) {
    return Math.min(cap, tableLength + Math.floor((xp - top) / chassis.xpPerLevelBeyond20));
  }
  let level = 1;
  for (let i = 1; i < tableLength; i++) {
    if (xp >= chassis.xpThresholds[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return Math.min(cap, level);
}
```

(Delete the now-unused `TABLE_MAX_LEVEL` constant, or repurpose it — `hitDice` still needs the level-9/10 cutoff logic, which uses `chassis.conBonusCutoffLevel`, not `TABLE_MAX_LEVEL`, so `TABLE_MAX_LEVEL` can go.)

- [ ] **Step 8: Update the four existing chassis** in `src/core/classes/chassis.ts` — add the four new fields to `FIGHTER`, `MAGE`, `CLERIC`, `THIEF`:

```ts
// FIGHTER: maxLevel: null, spellStartLevel: null, spellProgressionId: null, thiefSkillAccess: null,
// MAGE:    maxLevel: null, spellStartLevel: null, spellProgressionId: "wizard", thiefSkillAccess: null,
// CLERIC:  maxLevel: null, spellStartLevel: null, spellProgressionId: "priest", thiefSkillAccess: null,
// THIEF:   maxLevel: null, spellStartLevel: null, spellProgressionId: null, thiefSkillAccess: null,
```

(THIEF's `thiefSkillAccess` is `null` — a `null` on the Thief means "all skills", per the field doc; only the Bard carries an explicit sub-list.)

- [ ] **Step 9: Run tests + gates**

`ClassId` is untouched in this task, so `BY_ID: Record<ClassId, ClassChassis>` stays complete and the full gate passes standalone:

Run: `npm run test -- tests/core/abilities/index.test.ts tests/core/classes/progression.test.ts` → PASS
Run: `npm run typecheck` (both `tsc`) → clean. (The four new non-optional `ClassChassis` fields are set on all four existing chassis in Step 8; no other chassis literal exists yet.)
Run: `npm run lint` → clean
Run: `npm run test:coverage` → the `primeRequisiteXpBonus` and `progression` changes stay at 100%. Branch coverage: `maxLevel != null` both sides, `level > maxLevel` both sides, `level <= tableLength` both sides, `xp >= top && xpPerLevelBeyond20 > 0` all combinations, `Math.min(cap, …)` with cap finite and infinite.

- [ ] **Step 10: Commit**

```bash
git add src/core/types.ts src/core/abilities/index.ts src/core/classes/progression.ts src/core/classes/chassis.ts tests/core/abilities/index.test.ts tests/core/classes/progression.test.ts
git commit -m "feat(core): multi-ability prime-req bonus + class maxLevel; ClassChassis caster fields"
```

---

## Task 2: the four new chassis constants

**Files:**
- Modify: `src/core/classes/chassis.ts`
- Create: `tests/core/classes/new-chassis.test.ts`

**Files:**
- Modify: `src/core/types.ts` (widen `ClassId`), `src/core/classes/chassis.ts`
- Create: `tests/core/classes/new-chassis.test.ts`

**Interfaces:**
- Consumes: `ClassChassis`, `ClassId` (`../types`).
- Produces: `type ClassId` = `"fighter" | "mage" | "cleric" | "thief" | "paladin" | "ranger" | "druid" | "bard"`; `PALADIN`, `RANGER`, `DRUID`, `BARD` (`ClassChassis`); `BY_ID` covers all 8 `ClassId`s; `getChassis` unchanged.

- [ ] **Step 1: Widen `ClassId` in `src/core/types.ts`**

```ts
export type ClassId =
  | "fighter"
  | "mage"
  | "cleric"
  | "thief"
  | "paladin"
  | "ranger"
  | "druid"
  | "bard";
```

This alone makes `npm run typecheck` fail (`BY_ID` is now missing four keys) — Steps 3–4 close the gap in the same commit.

- [ ] **Step 2: Failing test** — `tests/core/classes/new-chassis.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { PALADIN, RANGER, DRUID, BARD, getChassis } from "../../../src/core/classes/chassis";
import { levelForXp, xpForLevel } from "../../../src/core/classes/progression";
import { primeRequisiteXpBonus } from "../../../src/core/abilities";

describe("new chassis — identity & group", () => {
  it("Paladin", () => {
    expect(PALADIN).toMatchObject({
      id: "paladin", group: "warrior", hitDie: 10,
      primeRequisites: ["str", "cha"],
      abilityMinimums: { str: 12, con: 9, wis: 13, cha: 17 },
      spellProgressionId: "paladin", spellStartLevel: 9, maxLevel: null,
      weaponSpecializationAllowed: false, armorAllowed: "any", nonProficiencyPenalty: -2,
    });
  });
  it("Ranger", () => {
    expect(RANGER).toMatchObject({
      id: "ranger", group: "warrior", hitDie: 10,
      primeRequisites: ["str", "dex", "wis"],
      abilityMinimums: { str: 13, dex: 13, con: 14, wis: 14 },
      spellProgressionId: "ranger", spellStartLevel: 8,
    });
  });
  it("Druid", () => {
    expect(DRUID).toMatchObject({
      id: "druid", group: "priest", hitDie: 8,
      primeRequisites: ["wis", "cha"],
      abilityMinimums: { wis: 12, cha: 15 },
      spellProgressionId: "priest", spellStartLevel: 1, maxLevel: 14,
      weaponsAllowed: { names: ["club", "sickle", "dart", "spear", "dagger", "scimitar", "sling", "staff"] },
      armorAllowed: ["leather"],
    });
  });
  it("Bard", () => {
    expect(BARD).toMatchObject({
      id: "bard", group: "rogue", hitDie: 6,
      primeRequisites: ["dex", "cha"],
      abilityMinimums: { dex: 12, int: 13, cha: 15 },
      spellProgressionId: "bard", spellStartLevel: 2,
      thiefSkillAccess: ["pick-pockets", "climb-walls", "detect-noise", "read-languages"],
      armorAllowed: ["padded", "leather", "studded leather", "ring mail", "brigandine", "scale mail", "hide", "chain mail"],
    });
  });
  it("Druid wears leather only; Bard up to chain mail (PHB pp.35/41)", () => {
    expect(DRUID.armorAllowed).toEqual(["leather"]);
    expect(BARD.armorAllowed).not.toContain("plate mail");
  });
  it("getChassis covers all eight ids", () => {
    for (const id of ["fighter", "mage", "cleric", "thief", "paladin", "ranger", "druid", "bard"] as const) {
      expect(getChassis(id).id).toBe(id);
    }
  });
});

describe("new chassis — XP progression", () => {
  it("Paladin/Ranger use the Table 14 Paladin-Ranger column", () => {
    expect(xpForLevel(PALADIN, 2)).toBe(2250);
    expect(xpForLevel(PALADIN, 9)).toBe(300000);
    expect(xpForLevel(RANGER, 2)).toBe(2250);
    expect(levelForXp(PALADIN, 2250)).toBe(2);
    expect(xpForLevel(PALADIN, 21)).toBe(3600000 + 300000);
  });
  it("Druid caps at level 14", () => {
    expect(xpForLevel(DRUID, 14)).toBe(1500000);
    expect(() => xpForLevel(DRUID, 15)).toThrow(RangeError);
    expect(levelForXp(DRUID, 999_000_000)).toBe(14);
  });
  it("Bard uses the Thief/Bard column", () => {
    expect(xpForLevel(BARD, 2)).toBe(1250);
    expect(xpForLevel(BARD, 20)).toBe(2200000);
  });
});

describe("prime-req XP bonus for the new classes", () => {
  it("paladin needs str & cha both 16+", () => {
    expect(primeRequisiteXpBonus(PALADIN.primeRequisites, { str: 16, dex: 10, con: 10, int: 10, wis: 13, cha: 17 })).toBe(true);
    expect(primeRequisiteXpBonus(PALADIN.primeRequisites, { str: 15, dex: 10, con: 10, int: 10, wis: 13, cha: 17 })).toBe(false);
  });
});
```

- [ ] **Step 3: Run — FAIL.**

- [ ] **Step 4: Implement** — add to `src/core/classes/chassis.ts`

Add the XP arrays near the existing ones:

```ts
// PHB Table 14: WARRIOR EXPERIENCE LEVELS (p.26) — Paladin/Ranger column.
// prettier-ignore
const PALADIN_RANGER_XP: readonly number[] = [
  0, 2250, 4500, 9000, 18000, 36000, 75000, 150000, 300000, 600000,
  900000, 1200000, 1500000, 1800000, 2100000, 2400000, 2700000, 3000000, 3300000, 3600000,
];
// PHB Table 23: PRIEST EXPERIENCE LEVELS (p.33) — Druid column, levels 1-14 only
// (the base-rules cap; level 15 is the unique Grand Druid, 16-20 the hierophant path — PHB p.37).
// prettier-ignore
const DRUID_XP: readonly number[] = [
  0, 2000, 4000, 7500, 12500, 20000, 35000, 60000, 90000, 125000, 200000, 300000, 750000, 1500000,
];
// Bard uses the Table 25 Thief/Bard column — identical to THIEF_XP.
```

Add the weapon lists:

```ts
const DRUID_WEAPONS = ["club", "sickle", "dart", "spear", "dagger", "scimitar", "sling", "staff"] as const;
```

Add the chassis constants (after `THIEF`):

```ts
export const PALADIN: ClassChassis = {
  id: "paladin",
  name: "Paladin",
  group: "warrior",
  hitDie: 10,
  hpAfterNameLevel: 3,
  conBonusCutoffLevel: 9,
  primeRequisites: ["str", "cha"],
  abilityMinimums: { str: 12, con: 9, wis: 13, cha: 17 },
  xpThresholds: PALADIN_RANGER_XP,
  xpPerLevelBeyond20: 300000,
  weaponProficiencies: { initial: 4, levelsPerSlot: 3 },
  nonweaponProficiencies: { initial: 3, levelsPerSlot: 3 },
  nonProficiencyPenalty: -2,
  casterType: "priest",
  armorAllowed: "any",
  weaponsAllowed: "any",
  weaponSpecializationAllowed: false,
  raceLevelLimits: {},
  maxLevel: null,
  spellStartLevel: 9,
  spellProgressionId: "paladin",
  thiefSkillAccess: null,
};

export const RANGER: ClassChassis = {
  id: "ranger",
  name: "Ranger",
  group: "warrior",
  hitDie: 10,
  hpAfterNameLevel: 3,
  conBonusCutoffLevel: 9,
  primeRequisites: ["str", "dex", "wis"],
  abilityMinimums: { str: 13, dex: 13, con: 14, wis: 14 },
  xpThresholds: PALADIN_RANGER_XP,
  xpPerLevelBeyond20: 300000,
  weaponProficiencies: { initial: 4, levelsPerSlot: 3 },
  nonweaponProficiencies: { initial: 3, levelsPerSlot: 3 },
  nonProficiencyPenalty: -2,
  casterType: "priest",
  armorAllowed: "any",
  weaponsAllowed: "any",
  weaponSpecializationAllowed: false,
  raceLevelLimits: {},
  maxLevel: null,
  spellStartLevel: 8,
  spellProgressionId: "ranger",
  thiefSkillAccess: null,
};

export const DRUID: ClassChassis = {
  id: "druid",
  name: "Druid",
  group: "priest",
  hitDie: 8,
  hpAfterNameLevel: 2,
  conBonusCutoffLevel: 9,
  primeRequisites: ["wis", "cha"],
  abilityMinimums: { wis: 12, cha: 15 },
  xpThresholds: DRUID_XP,
  xpPerLevelBeyond20: 0,
  weaponProficiencies: { initial: 2, levelsPerSlot: 4 },
  nonweaponProficiencies: { initial: 4, levelsPerSlot: 3 },
  nonProficiencyPenalty: -3,
  casterType: "priest",
  armorAllowed: ["leather"],
  weaponsAllowed: { names: [...DRUID_WEAPONS] },
  weaponSpecializationAllowed: false,
  raceLevelLimits: {},
  maxLevel: 14,
  spellStartLevel: 1,
  spellProgressionId: "priest",
  thiefSkillAccess: null,
};

export const BARD: ClassChassis = {
  id: "bard",
  name: "Bard",
  group: "rogue",
  hitDie: 6,
  hpAfterNameLevel: 2,
  conBonusCutoffLevel: 10,
  primeRequisites: ["dex", "cha"],
  abilityMinimums: { dex: 12, int: 13, cha: 15 },
  xpThresholds: THIEF_XP,
  xpPerLevelBeyond20: 220000,
  weaponProficiencies: { initial: 2, levelsPerSlot: 4 },
  nonweaponProficiencies: { initial: 3, levelsPerSlot: 4 },
  nonProficiencyPenalty: -3,
  casterType: "wizard",
  armorAllowed: ["padded", "leather", "studded leather", "ring mail", "brigandine", "scale mail", "hide", "chain mail"],
  weaponsAllowed: "any",
  weaponSpecializationAllowed: false,
  raceLevelLimits: {},
  maxLevel: null,
  spellStartLevel: 2,
  spellProgressionId: "bard",
  thiefSkillAccess: ["pick-pockets", "climb-walls", "detect-noise", "read-languages"],
};
```

Update `BY_ID`:

```ts
const BY_ID: Record<ClassId, ClassChassis> = {
  fighter: FIGHTER,
  mage: MAGE,
  cleric: CLERIC,
  thief: THIEF,
  paladin: PALADIN,
  ranger: RANGER,
  druid: DRUID,
  bard: BARD,
};
```

- [ ] **Step 5: Run — PASS.**  **Step 6: Full gate** — `npm run typecheck` (both `tsc`, now that all 8 chassis exist and `BY_ID` is complete) · `npm run lint` · `npm run test:coverage` · `npm run build` → all exit 0, `src/core/**` 100%.

- [ ] **Step 7: Commit**

```bash
git add src/core/types.ts src/core/classes/chassis.ts tests/core/classes/new-chassis.test.ts
git commit -m "feat(core): Paladin/Ranger/Druid/Bard class chassis (PHB Tables 13/14/23/25)"
```

---

## Task 3: Paladin/Ranger/Bard spell progressions + Druid sphere access + specialist minAbility

**Files:**
- Modify: `src/core/magic/tables.ts`, `src/core/magic/index.ts`, `tests/core/magic/tables.test.ts`
- Create: `src/core/magic/class-slots.ts`, `tests/core/magic/class-slots.test.ts`

**Interfaces:**
- Consumes: `assertLevel`, `assertSpellLevel` (`../errors`); `SphereName`, `SphereAccess`, `AbilityKey` (`../types`); `PALADIN_SPELL_PROGRESSION` etc. (`./tables`).
- Produces:
  - `const PALADIN_SPELL_PROGRESSION: readonly (readonly number[])[]` — 12 rows (index 0 = paladin level 9 … index 11 = level 20), 4 columns (priest spell levels 1–4).
  - `const RANGER_SPELL_PROGRESSION: readonly (readonly number[])[]` — 16 rows (index 0 = ranger level 1 … index 15 = level 16), 3 columns (priest spell levels 1–3).
  - `const BARD_SPELL_PROGRESSION: readonly (readonly number[])[]` — 20 rows (index 0 = bard level 1 … index 19 = level 20), 6 columns (wizard spell levels 1–6).
  - `const DRUID_SPHERE_ACCESS: Partial<Record<SphereName, SphereAccess>>` — major: all, animal, elemental, healing, plant, weather; minor: divination.
  - `interface SpecialistProfile` gains `minAbility: { ability: AbilityKey; score: number }` (PHB Table 22).
  - `function paladinSpellSlots(paladinLevel: number): readonly number[]` — `assertLevel`; below 9 → `[0, 0, 0, 0]`; 9–20 → the table row; above 20 → the level-20 row. No Wisdom bonus.
  - `function rangerSpellSlots(rangerLevel: number): readonly number[]` — `assertLevel`; below 8 → `[0, 0, 0]`; 8–16 → the table row; above 16 → the level-16 row. No Wisdom bonus.
  - `function bardSpellSlots(input: { bardLevel: number; maxSpellLevelKnown: number }): SpellSlots` — `assertLevel(bardLevel)`, `assertSpellLevel(maxSpellLevelKnown)`; `base` = row for `min(bardLevel, 20)`; below 2 → all-zero; zero any spell level above `maxSpellLevelKnown` (report in `suppressed`); `bonus` is all-zero (bards never specialise). Same `SpellSlots` shape as `wizardSpellSlots`.

- [ ] **Step 1: Failing tests** — `tests/core/magic/class-slots.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { paladinSpellSlots, rangerSpellSlots, bardSpellSlots } from "../../../src/core/magic/class-slots";

describe("paladinSpellSlots() (PHB Table 17)", () => {
  it("no spells before level 9", () => {
    expect(paladinSpellSlots(1)).toEqual([0, 0, 0, 0]);
    expect(paladinSpellSlots(8)).toEqual([0, 0, 0, 0]);
  });
  it("matches the table rows", () => {
    expect(paladinSpellSlots(9)).toEqual([1, 0, 0, 0]);
    expect(paladinSpellSlots(11)).toEqual([2, 1, 0, 0]);
    expect(paladinSpellSlots(14)).toEqual([3, 2, 1, 0]);
    expect(paladinSpellSlots(20)).toEqual([3, 3, 3, 3]);
  });
  it("above 20 reuses the level-20 row", () => {
    expect(paladinSpellSlots(25)).toEqual([3, 3, 3, 3]);
  });
  it("rejects a bad level", () => {
    expect(() => paladinSpellSlots(0)).toThrow(RangeError);
  });
});

describe("rangerSpellSlots() (PHB Table 18)", () => {
  it("no spells before level 8", () => {
    expect(rangerSpellSlots(7)).toEqual([0, 0, 0]);
  });
  it("matches the table rows", () => {
    expect(rangerSpellSlots(8)).toEqual([1, 0, 0]);
    expect(rangerSpellSlots(10)).toEqual([2, 1, 0]);
    expect(rangerSpellSlots(12)).toEqual([2, 2, 1]);
    expect(rangerSpellSlots(16)).toEqual([3, 3, 3]);
  });
  it("above 16 reuses the level-16 row", () => {
    expect(rangerSpellSlots(20)).toEqual([3, 3, 3]);
  });
});

describe("bardSpellSlots() (PHB Table 32)", () => {
  it("no spells before level 2", () => {
    expect(bardSpellSlots({ bardLevel: 1, maxSpellLevelKnown: 6 }).perLevel).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it("matches the table rows, INT-capped", () => {
    expect(bardSpellSlots({ bardLevel: 2, maxSpellLevelKnown: 6 }).perLevel).toEqual([1, 0, 0, 0, 0, 0]);
    expect(bardSpellSlots({ bardLevel: 7, maxSpellLevelKnown: 6 }).perLevel).toEqual([3, 2, 1, 0, 0, 0]);
    expect(bardSpellSlots({ bardLevel: 20, maxSpellLevelKnown: 6 }).perLevel).toEqual([4, 4, 4, 4, 4, 3]);
  });
  it("Intelligence cap zeroes and reports high spell levels", () => {
    const r = bardSpellSlots({ bardLevel: 16, maxSpellLevelKnown: 4 });
    // L16 base [4,3,3,3,2,1] -> 5th & 6th suppressed
    expect(r.perLevel).toEqual([4, 3, 3, 3, 0, 0]);
    expect(r.suppressed).toEqual([5, 6]);
    expect(r.bonus).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it("above 20 reuses the level-20 row", () => {
    expect(bardSpellSlots({ bardLevel: 25, maxSpellLevelKnown: 6 }).perLevel).toEqual([4, 4, 4, 4, 4, 3]);
  });
});
```

Append to `tests/core/magic/tables.test.ts`:

```ts
import {
  PALADIN_SPELL_PROGRESSION,
  RANGER_SPELL_PROGRESSION,
  BARD_SPELL_PROGRESSION,
  DRUID_SPHERE_ACCESS,
} from "../../../src/core/magic/tables";

describe("PALADIN_SPELL_PROGRESSION (PHB Table 17)", () => {
  it("12 rows (level 9-20) of 4 columns", () => {
    expect(PALADIN_SPELL_PROGRESSION).toHaveLength(12);
    for (const row of PALADIN_SPELL_PROGRESSION) expect(row).toHaveLength(4);
  });
  it("spot-checks", () => {
    expect(PALADIN_SPELL_PROGRESSION[0]).toEqual([1, 0, 0, 0]); // L9
    expect(PALADIN_SPELL_PROGRESSION[6]).toEqual([3, 2, 1, 1]); // L15
    expect(PALADIN_SPELL_PROGRESSION[11]).toEqual([3, 3, 3, 3]); // L20
  });
});

describe("RANGER_SPELL_PROGRESSION (PHB Table 18)", () => {
  it("16 rows (level 1-16) of 3 columns", () => {
    expect(RANGER_SPELL_PROGRESSION).toHaveLength(16);
    for (const row of RANGER_SPELL_PROGRESSION) expect(row).toHaveLength(3);
  });
  it("spot-checks", () => {
    expect(RANGER_SPELL_PROGRESSION[6]).toEqual([0, 0, 0]); // L7 — none yet
    expect(RANGER_SPELL_PROGRESSION[7]).toEqual([1, 0, 0]); // L8
    expect(RANGER_SPELL_PROGRESSION[15]).toEqual([3, 3, 3]); // L16
  });
});

describe("BARD_SPELL_PROGRESSION (PHB Table 32)", () => {
  it("20 rows of 6 columns", () => {
    expect(BARD_SPELL_PROGRESSION).toHaveLength(20);
    for (const row of BARD_SPELL_PROGRESSION) expect(row).toHaveLength(6);
  });
  it("spot-checks", () => {
    expect(BARD_SPELL_PROGRESSION[0]).toEqual([0, 0, 0, 0, 0, 0]); // L1
    expect(BARD_SPELL_PROGRESSION[1]).toEqual([1, 0, 0, 0, 0, 0]); // L2
    expect(BARD_SPELL_PROGRESSION[15]).toEqual([4, 3, 3, 3, 2, 1]); // L16
    expect(BARD_SPELL_PROGRESSION[19]).toEqual([4, 4, 4, 4, 4, 3]); // L20
  });
});

describe("DRUID_SPHERE_ACCESS (PHB p.35)", () => {
  it("major to nature spheres, minor to divination", () => {
    expect(DRUID_SPHERE_ACCESS.all).toBe("major");
    expect(DRUID_SPHERE_ACCESS.animal).toBe("major");
    expect(DRUID_SPHERE_ACCESS.elemental).toBe("major");
    expect(DRUID_SPHERE_ACCESS.healing).toBe("major");
    expect(DRUID_SPHERE_ACCESS.plant).toBe("major");
    expect(DRUID_SPHERE_ACCESS.weather).toBe("major");
    expect(DRUID_SPHERE_ACCESS.divination).toBe("minor");
    expect(DRUID_SPHERE_ACCESS.combat ?? "none").toBe("none");
  });
});
```

And in the existing `SPECIALIST_SCHOOLS` describe block, add:

```ts
  it("carries the Table 22 minimum ability (keyed by coarse school)", () => {
    expect(SPECIALIST_SCHOOLS.illusion.minAbility).toEqual({ ability: "dex", score: 16 }); // Illusionist
    expect(SPECIALIST_SCHOOLS.abjuration.minAbility).toEqual({ ability: "wis", score: 15 }); // Abjurer
    expect(SPECIALIST_SCHOOLS.alteration.minAbility).toEqual({ ability: "dex", score: 15 }); // Transmuter
    expect(SPECIALIST_SCHOOLS.invocation.minAbility).toEqual({ ability: "con", score: 16 }); // Invoker
  });
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/magic/tables.ts`

Add the three progression tables (after `PRIEST_SPELL_PROGRESSION`):

```ts
/**
 * PHB Table 17: PALADIN SPELL PROGRESSION (p.28). Row 0 = paladin level 9 …
 * row 11 = level 20. Columns = priest spell levels 1-4. No Wisdom bonus spells.
 */
// prettier-ignore
export const PALADIN_SPELL_PROGRESSION: readonly (readonly number[])[] = [
  [1, 0, 0, 0], // L9
  [2, 0, 0, 0], // L10
  [2, 1, 0, 0], // L11
  [2, 2, 0, 0], // L12
  [2, 2, 1, 0], // L13
  [3, 2, 1, 0], // L14
  [3, 2, 1, 1], // L15
  [3, 3, 2, 1], // L16
  [3, 3, 3, 1], // L17
  [3, 3, 3, 1], // L18
  [3, 3, 3, 2], // L19
  [3, 3, 3, 3], // L20
];

/**
 * PHB Table 18: RANGER ABILITIES (p.28), priest-spell columns. Row 0 = ranger
 * level 1 … row 15 = level 16. Columns = priest spell levels 1-3. No Wisdom
 * bonus spells (PHB p.29). Levels above 16 reuse the level-16 row.
 */
// prettier-ignore
export const RANGER_SPELL_PROGRESSION: readonly (readonly number[])[] = [
  [0, 0, 0], // L1
  [0, 0, 0], // L2
  [0, 0, 0], // L3
  [0, 0, 0], // L4
  [0, 0, 0], // L5
  [0, 0, 0], // L6
  [0, 0, 0], // L7
  [1, 0, 0], // L8
  [2, 0, 0], // L9
  [2, 1, 0], // L10
  [2, 2, 0], // L11
  [2, 2, 1], // L12
  [3, 2, 1], // L13
  [3, 2, 2], // L14
  [3, 3, 2], // L15
  [3, 3, 3], // L16
];

/**
 * PHB Table 32: BARD SPELL PROGRESSION (p.42). Row 0 = bard level 1 … row 19 =
 * level 20. Columns = wizard spell levels 1-6. Bards cast wizard spells and
 * never specialise.
 */
// prettier-ignore
export const BARD_SPELL_PROGRESSION: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0, 0], // L1
  [1, 0, 0, 0, 0, 0], // L2
  [2, 0, 0, 0, 0, 0], // L3
  [2, 1, 0, 0, 0, 0], // L4
  [3, 1, 0, 0, 0, 0], // L5
  [3, 2, 0, 0, 0, 0], // L6
  [3, 2, 1, 0, 0, 0], // L7
  [3, 3, 1, 0, 0, 0], // L8
  [3, 3, 2, 0, 0, 0], // L9
  [3, 3, 2, 1, 0, 0], // L10
  [3, 3, 3, 1, 0, 0], // L11
  [3, 3, 3, 2, 0, 0], // L12
  [3, 3, 3, 2, 1, 0], // L13
  [3, 3, 3, 3, 1, 0], // L14
  [3, 3, 3, 3, 2, 0], // L15
  [4, 3, 3, 3, 2, 1], // L16
  [4, 4, 3, 3, 3, 1], // L17
  [4, 4, 4, 3, 3, 2], // L18
  [4, 4, 4, 4, 3, 2], // L19
  [4, 4, 4, 4, 4, 3], // L20
];
```

Add `DRUID_SPHERE_ACCESS` after `CLERIC_SPHERE_ACCESS`:

```ts
/**
 * The Druid (PHB p.35): major access to all, animal, elemental, healing, plant,
 * and weather; minor access to divination. Spheres omitted default to "none".
 */
// prettier-ignore
export const DRUID_SPHERE_ACCESS: Partial<Record<SphereName, SphereAccess>> = {
  all: "major", animal: "major", elemental: "major", healing: "major", plant: "major", weather: "major",
  divination: "minor",
};
```

Extend `SpecialistProfile` and `SPECIALIST_SCHOOLS` (add `AbilityKey` to the type import from `../types`):

```ts
export interface SpecialistProfile {
  school: WizardSchool;
  opposition: readonly WizardSchool[];
  /** PHB Table 22: the ability score a character needs to take this specialty */
  minAbility: { ability: AbilityKey; score: number };
}

// prettier-ignore
export const SPECIALIST_SCHOOLS: Readonly<Record<WizardSchool, SpecialistProfile>> = {
  abjuration:  { school: "abjuration",  opposition: ["alteration", "illusion"],                minAbility: { ability: "wis", score: 15 } },
  alteration:  { school: "alteration",  opposition: ["abjuration", "necromancy"],              minAbility: { ability: "dex", score: 15 } },
  conjuration: { school: "conjuration", opposition: ["divination", "invocation"],              minAbility: { ability: "con", score: 15 } },
  divination:  { school: "divination",  opposition: ["conjuration"],                           minAbility: { ability: "wis", score: 16 } },
  enchantment: { school: "enchantment", opposition: ["invocation", "necromancy"],              minAbility: { ability: "cha", score: 16 } },
  illusion:    { school: "illusion",    opposition: ["necromancy", "invocation", "abjuration"], minAbility: { ability: "dex", score: 16 } },
  invocation:  { school: "invocation",  opposition: ["enchantment", "conjuration"],            minAbility: { ability: "con", score: 16 } },
  necromancy:  { school: "necromancy",  opposition: ["illusion", "enchantment"],               minAbility: { ability: "wis", score: 16 } },
};
```

- [ ] **Step 4: Create `src/core/magic/class-slots.ts`**

```ts
// PHB Table 17 (Paladin), Table 18 (Ranger), Table 32 (Bard): limited-caster
// spell slots. Paladin and Ranger get no Wisdom bonus spells (PHB p.28-29);
// Bards cast wizard spells and never specialise.
import { assertLevel, assertSpellLevel } from "../errors";
import type { SpellSlots } from "../types";
import { BARD_SPELL_PROGRESSION, PALADIN_SPELL_PROGRESSION, RANGER_SPELL_PROGRESSION } from "./tables";

const PALADIN_START = 9;
const RANGER_START = 8;
const RANGER_TABLE_MAX = 16;
const BARD_TABLE_MAX = 20;

/** Priest spell slots for a paladin (PHB Table 17). No Wisdom bonus. */
export function paladinSpellSlots(paladinLevel: number): readonly number[] {
  assertLevel(paladinLevel, "paladinLevel");
  if (paladinLevel < PALADIN_START) return [0, 0, 0, 0];
  const row = Math.min(paladinLevel, PALADIN_START + PALADIN_SPELL_PROGRESSION.length - 1) - PALADIN_START;
  return [...PALADIN_SPELL_PROGRESSION[row]];
}

/** Priest spell slots for a ranger (PHB Table 18). No Wisdom bonus. */
export function rangerSpellSlots(rangerLevel: number): readonly number[] {
  assertLevel(rangerLevel, "rangerLevel");
  if (rangerLevel < RANGER_START) return [0, 0, 0];
  return [...RANGER_SPELL_PROGRESSION[Math.min(rangerLevel, RANGER_TABLE_MAX) - 1]];
}

export interface BardSlotInput {
  bardLevel: number;
  /** highest castable spell level — IntelligenceModifiers.maxSpellLevel (1-9) */
  maxSpellLevelKnown: number;
}

/** Wizard spell slots for a bard (PHB Table 32), Intelligence-capped, never specialised. */
export function bardSpellSlots(input: BardSlotInput): SpellSlots {
  assertLevel(input.bardLevel, "bardLevel");
  assertSpellLevel(input.maxSpellLevelKnown);
  const base = BARD_SPELL_PROGRESSION[Math.min(input.bardLevel, BARD_TABLE_MAX) - 1];
  const bonus = base.map(() => 0);
  const suppressed: number[] = [];
  const perLevel = base.map((count, i) => {
    if (i + 1 > input.maxSpellLevelKnown) {
      if (count > 0) suppressed.push(i + 1);
      return 0;
    }
    return count;
  });
  return { perLevel, base: [...base], bonus, suppressed };
}
```

- [ ] **Step 5: Update `src/core/magic/index.ts`**

```ts
export * from "./tables";
export * from "./wizard-slots";
export * from "./priest-slots";
export * from "./class-slots";
export * from "./spheres";
export * from "./spellbook";
```

- [ ] **Step 6: Run — PASS.**  **Step 7: Gates** (`typecheck && lint && test:coverage`, 100%). Branch coverage: `paladinLevel < PALADIN_START` both sides; the `Math.min` clamps at and below the table max; `rangerLevel < RANGER_START` both sides; `bardLevel` clamp both sides; `i + 1 > maxSpellLevelKnown` both sides; `count > 0` inside the cap both sides.

- [ ] **Step 8: Commit**

```bash
git add src/core/magic/tables.ts src/core/magic/class-slots.ts src/core/magic/index.ts tests/core/magic/tables.test.ts tests/core/magic/class-slots.test.ts
git commit -m "feat(core): paladin/ranger/bard spell slots + druid spheres + specialist minAbility (PHB Tables 17/18/22/32)"
```

---

## Task 4: Ranger stealth table + barrel smoke

**Files:**
- Create: `src/core/classes/ranger.ts`, `tests/core/classes/ranger.test.ts`
- Modify: `src/core/classes/index.ts`, `tests/core/index.test.ts`

**Interfaces:**
- Consumes: `assertLevel` (`../errors`).
- Produces:
  - `const RANGER_STEALTH: readonly (readonly [number, number])[]` — 16 rows (index 0 = ranger level 1), each `[hideInShadows, moveSilently]` percent.
  - `interface RangerStealth { hideInShadows: number; moveSilently: number }`
  - `function rangerStealth(rangerLevel: number): RangerStealth` — `assertLevel`; row for `min(rangerLevel, 16)`. These are base percentages in natural terrain and studded-leather-or-lighter armour; the caller applies the race / Dexterity / armour adjustments (Plan 1b.6 thief tables) and the halving in non-natural terrain.

- [ ] **Step 1: Failing test** — `tests/core/classes/ranger.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { RANGER_STEALTH, rangerStealth } from "../../../src/core/classes/ranger";

describe("RANGER_STEALTH (PHB Table 18)", () => {
  it("16 rows of [hide, move]", () => {
    expect(RANGER_STEALTH).toHaveLength(16);
    expect(RANGER_STEALTH[0]).toEqual([10, 15]);
    expect(RANGER_STEALTH[15]).toEqual([99, 99]);
  });
});

describe("rangerStealth()", () => {
  it("reads the level row", () => {
    expect(rangerStealth(1)).toEqual({ hideInShadows: 10, moveSilently: 15 });
    expect(rangerStealth(8)).toEqual({ hideInShadows: 49, moveSilently: 62 });
    expect(rangerStealth(13)).toEqual({ hideInShadows: 85, moveSilently: 99 });
  });
  it("above 16 reuses the level-16 row", () => {
    expect(rangerStealth(20)).toEqual({ hideInShadows: 99, moveSilently: 99 });
  });
  it("rejects a bad level", () => {
    expect(() => rangerStealth(0)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `src/core/classes/ranger.ts`

```ts
// PHB Table 18: RANGER ABILITIES (p.28) — the Hide in Shadows / Move Silently
// columns. Base percentages, usable only in natural terrain and in studded
// leather or lighter armour; the caller applies the race / Dexterity / armour
// adjustments (Plan 1b.6 thief tables) and halves the result in non-natural
// surroundings (PHB p.29).
import { assertLevel } from "../errors";

const TABLE_MAX_LEVEL = 16;

/** [hideInShadows, moveSilently] percent, index 0 = ranger level 1. */
// prettier-ignore
export const RANGER_STEALTH: readonly (readonly [number, number])[] = [
  [10, 15], [15, 21], [20, 27], [25, 33], [31, 40], [37, 47], [43, 55], [49, 62],
  [56, 70], [63, 78], [70, 86], [77, 94], [85, 99], [93, 99], [99, 99], [99, 99],
];

export interface RangerStealth {
  hideInShadows: number;
  moveSilently: number;
}

export function rangerStealth(rangerLevel: number): RangerStealth {
  assertLevel(rangerLevel, "rangerLevel");
  const [hideInShadows, moveSilently] = RANGER_STEALTH[Math.min(rangerLevel, TABLE_MAX_LEVEL) - 1];
  return { hideInShadows, moveSilently };
}
```

- [ ] **Step 4: Update `src/core/classes/index.ts`**

```ts
export * from "./chassis";
export * from "./progression";
export * from "./thac0";
export * from "./ranger";
```

- [ ] **Step 5: Extend the barrel smoke test** — `tests/core/index.test.ts`

Import `getChassis` and `paladinSpellSlots` from the barrel alongside the existing imports and add inside the existing `it(...)`:

```ts
    expect(getChassis("druid").maxLevel).toBe(14);
    expect(paladinSpellSlots(9)).toEqual([1, 0, 0, 0]);
```

- [ ] **Step 6: Run — PASS.**  **Step 7: Full gate** — `npm run typecheck && npm run lint && npm run test:coverage && npm run build` → all exit 0; `src/core/**` 100% lines/statements/functions, ≥90% branches. Branch coverage: `Math.min` clamp in `rangerStealth` at and below the table max; the `assertLevel` throw.

- [ ] **Step 8: Commit**

```bash
git add src/core/classes/ranger.ts src/core/classes/index.ts tests/core/classes/ranger.test.ts tests/core/index.test.ts
git commit -m "feat(core): ranger stealth table (PHB Table 18)"
```

---

## Self-Review

**1. Spec coverage:**

| Spec item | Task |
|---|---|
| §1 — the class engine covers all PHB player classes | Tasks 1–4 (Paladin/Ranger/Druid/Bard chassis; specialists = Mage + selector) |
| §5.4 `class` item schema — `group`, `hitDie`, `hpAfterName`, `primeRequisites`, `xpTable`, `weaponSlots`, `nonweaponSlots`, `weaponProfPenalty`, `armorAllowed`, `weaponsAllowed`, `spellProgression`, `casterType`, `raceLevelLimits` | Task 2 (every field of the four chassis; `spellProgressionId` + `spellStartLevel` + `maxLevel` + `thiefSkillAccess` are the new chassis fields the 1c `class` DataModel reads) |
| §6.1 `CONFIG.ADND2E.classGroups` | unchanged — the four new classes reuse `warrior`/`priest`/`rogue` |
| §9 Vitest, PHB values asserted, 100% core coverage in CI | all tasks |
| §11 values transcribed from `references/` with citations | file header comments in `chassis.ts` additions, `magic/tables.ts`, `classes/ranger.ts` |
| Plan 1b.5 carry-forward — Druid sphere access | Task 3 (`DRUID_SPHERE_ACCESS`) |
| Plan 1b.2 carry-forward — replace `primeRequisiteXpBonus`'s class-group approximation | Task 1 |

Out of scope for Plan 1b.2b (Plan 1c `classFeature` data + later sub-projects): all class special abilities (lay on hands, cure disease, detect evil, protection aura, turn undead, holy sword, tracking, species enemy, animal empathy, two-weapon style, followers, shapechange, hierophant progression, bardic knowledge/influence/rally); the paladin/ranger warhorse; sphere gating of the paladin/ranger spell lists (the slot functions return counts; which spells fill them is `classFeature` / caller); multi-/dual-class rules; the `data/` layer / `CONFIG.ADND2E`.

**2. Placeholder scan:** No "TBD" / "handle edge cases" / "similar to Task N". Every function body and every test assertion is literal. The four spell tables (17/18/32) are spot-checked cell-by-cell against the PHB in `tables.test.ts`; the chassis fields are asserted with `toMatchObject`; the XP progressions are checked against the transcribed Table 14/23/25 columns. The Druid level-14 cap and the "no Wisdom bonus for paladins/rangers" are documented as PHB facts (p.37, p.28-29) with citations.

**3. Type consistency:**
- `ClassId` — 8 members after Task 1; `BY_ID` is `Record<ClassId, ClassChassis>` and Task 2 fills all 8 keys (the compiler enforces completeness).
- `SpellProgressionId` — defined once in `types.ts` (Task 1); consumed by `ClassChassis.spellProgressionId`. The five members map to: `wizardSpellSlots` / `priestSpellSlots` / `paladinSpellSlots` / `rangerSpellSlots` / `bardSpellSlots` — the 1c derive layer switches on it.
- `ClassChassis` gains four fields; all eight chassis literals set all four (four in Task 1 Step 8, four in Task 2 Step 3); no `?` optionals, so a missing field is a compile error.
- `primeRequisiteXpBonus(primeRequisites, scores)` — the new signature is used in `new-chassis.test.ts` (`PALADIN.primeRequisites`) and `abilities/index.test.ts`. No other caller in `src/core` (checked: `deriveAbilities` does not call it).
- `paladinSpellSlots` / `rangerSpellSlots` return `readonly number[]` (fixed-length priest columns, no `SpellSlots` breakdown needed — no bonus, no INT cap). `bardSpellSlots` returns the full `SpellSlots` shape (it has an INT cap and therefore `suppressed`), matching `wizardSpellSlots`.
- `SpecialistProfile` gains `minAbility: { ability: AbilityKey; score: number }`; every `SPECIALIST_SCHOOLS` entry sets it (Task 3); `tables.test.ts` asserts three of them.

**4. Coverage:** every new file is small pure functions or `const` data.
- `progression.ts` — `maxLevel != null` both sides; `level > maxLevel` both sides (throw + pass); `level <= tableLength` both sides; `xp >= top && xpPerLevelBeyond20 > 0` — the Druid path (`xpPerLevelBeyond20 === 0`) forces the loop branch, the Fighter path forces the extrapolation branch; `Math.min(cap, …)` with `cap` finite (Druid) and infinite (others).
- `chassis.ts` — pure `const` data; `getChassis` is a one-line index, covered by the "all eight ids" test.
- `abilities/index.ts` — `primeRequisiteXpBonus` is one `.every(...)`; the empty-array, single-met, single-unmet, multi-met, multi-unmet cases cover the predicate both ways.
- `magic/tables.ts` — pure `const` data.
- `magic/class-slots.ts` — `paladinLevel < PALADIN_START` both sides; the `Math.min(paladinLevel, 20)` clamp at and below (L20 and L25 tests); `rangerLevel < RANGER_START` both sides; `bardLevel` clamp both sides; `i + 1 > maxSpellLevelKnown` both sides; `count > 0` inside the cap both sides (the INT-4 test hits both).
- `classes/ranger.ts` — `Math.min` clamp both sides; `assertLevel` throw.
- No `/* v8 ignore */`. `magic/index.ts` / `classes/index.ts` are `export *` barrels.

**5. The rules easy to get wrong (all mirrored in `references/research-notes.md`):**
- **Paladins and rangers get no Wisdom bonus priest spells** (PHB p.28 for paladins, p.29 for rangers — "He does not gain bonus spells for a high Wisdom score"). Their slot functions are plain table lookups. The Druid, by contrast, *is* a full priest — Plan 1c calls the existing `priestSpellSlots` with the druid's level.
- **The Druid's XP table is level 1–14 only.** Level 15 is the unique Grand Druid, 16–20 the hierophant path with a *restarted* progression (PHB p.37) — not representable as a monotonic `xpThresholds` array, so `maxLevel: 14` and a 14-entry table; `xpForLevel(DRUID, 15)` throws.
- **Bard XP == Thief XP** (Table 25 "Thief/Bard" column) — `BARD` reuses the existing `THIEF_XP` constant, it is not a separate array. **Paladin XP == Ranger XP** (Table 14 "Paladin/Ranger" column) — one shared `PALADIN_RANGER_XP`.
- **The prime-requisite XP bonus needs 16+ in *every* prime requisite**, not any one — a paladin with Str 18 / Cha 15 gets no bonus.
- **Ranger stealth is its own table** (Table 18 columns), not the thief's Table 26 — a ranger of level N has fixed base percentages, then the same race/Dex/armour adjustments as a thief.

**6. Deviations from the spec:**
- Spec §5.4's `class` schema names `spellProgression: TableRef|null` and `casterType`. This plan adds `spellProgressionId` (a string enum, not a `TableRef`) and `spellStartLevel` to `ClassChassis`, because the engine now has five distinct slot tables (wizard/priest/paladin/ranger/bard) and the limited casters start late. `maxLevel` and `thiefSkillAccess` are also new `ClassChassis` fields the spec's prose implies (Druid cap; bard's four skills) but does not name. The 1c `class` DataModel schema will mirror these.
- Specialist wizards are **not** `ClassId` members (per the 2026-09-08 scope decision) — they are `{ chassis: MAGE, specialistSchool, minAbility }` assembled in Plan 1c. `SPECIALIST_SCHOOLS` now carries the `minAbility` so 1c has everything it needs.
- Tables stay co-located (`magic/tables.ts`, `classes/ranger.ts`) per the pattern set in Plans 1b.2–1b.7, not a top-level `core/tables/`.

No issues requiring rework.
