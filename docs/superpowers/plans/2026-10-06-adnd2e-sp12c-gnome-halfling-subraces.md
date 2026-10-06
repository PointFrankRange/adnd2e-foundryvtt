# Sub-project 12 Plan C: Flat Save Bonus + Gnome and Halfling Subraces — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The subrace layer gains an optional flat saving-throw bonus (the Deep Gnome's +3 on all saves, +2 vs poison), and the `races` pack ships four gnome and seven halfling subraces from *The Complete Book of Gnomes and Halflings* (28 race items total).

**Architecture:** `SubraceLayer.flatSaveBonus` (nullable) flows through `normalizeSubrace`, the race-item schema, the snapshot's `raceLayer`, `deriveSaves` and the save composer; one new pure `racialSaveModifier` decides the racial save modifier (a set flat bonus replaces the Constitution-based bonus). Everything else is content on the Plan A/B engine.

**Tech Stack:** TypeScript, Foundry v14 DataModel fields, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-adnd2e-sp12c-gnome-halfling-subraces-design.md`.

## Global Constraints

- **Every implementer runs `npm run typecheck` (NOT just `tsc -p tsconfig.json`), `npm run lint` and the task's tests before reporting done; the controller runs the full CI sequence `npm run typecheck && npm run lint && npm run test:coverage && npm run build` before the PR** (`npm run build` needs Foundry CLOSED — a running Foundry holds a LevelDB lock on `dist/packs`; if it fails with a LOCK error, do NOT kill Foundry; verify the pack compile another way and tell the controller).
- 100% statement/line/function coverage gate (90% branches) on `src/core/**`, `src/data/derive/**`. `src/data/item/race.ts` and `src/data/actor/**` are Foundry glue outside the gate (the controller proves them headlessly).
- **Foundry gotcha:** no object/array-literal `initial` (`initial: {}` / `[]`) on any new field; the new field is a nullable `SchemaField` with `initial: null` (the same precedent as `abilityAdjustments`).
- All new fields default so existing race items need no migration; the six PHB items, the six dwarf and five elf subraces must behave exactly as before.
- Content policy: mechanical data only, `description: ""`, `grantedFeatures` are short labels with no rule numbers or prose. Dark Sun-only content (the Athasian halfling) is NOT shipped.
- All changed files valid UTF-8; source files use CRLF line endings (preserve them); verify with `git diff --name-only master HEAD | while read f; do iconv -f UTF-8 -t UTF-8 "$f" >/dev/null 2>&1 || echo "bad: $f"; done` (prints nothing).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## File Structure

- Modify `src/core/races/subrace.ts`, `src/core/saves/racial.ts`, `src/core/saves/composer.ts`.
- Modify `src/data/item/race.ts`, `src/data/derive/character/saves.ts`, `src/data/derive/character/derive.ts`.
- Tests: modify `tests/core/races/subrace.test.ts`, the core saves test file(s) (find with `grep -rln racialSaveBonus tests/core`), `tests/data/derive/character/saves.test.ts`, `tests/data/derive/character/derive.test.ts`, `tests/sheets/character/context.test.ts` (literal `SubraceLayer` fix-ups), `tests/packs/content.test.ts`.
- Create `packs/races/_source/{rock-gnome,deep-gnome,tinker-gnome,forest-gnome,hairfoot,stout-dexterity,stout-constitution,tallfellow-dexterity,tallfellow-wisdom,furchin,kender}.json`; modify `packs/races/_source/_MANIFEST.md`, `README.md`.

---

### Task 1: Pure flat-save rules

**Files:**
- Modify: `src/core/races/subrace.ts`, `src/core/saves/racial.ts`, `src/core/saves/composer.ts`
- Test: `tests/core/races/subrace.test.ts`, the core saves test file(s) that already cover `racialSaveBonus` / `saveTargetBest` (`grep -rln "racialSaveBonus\|saveTargetBest" tests/core`)

**Interfaces:**
- Produces:
  - `interface FlatSaveBonus { all: number; poison: number }` (exported from `src/core/races`)
  - `SubraceLayer.flatSaveBonus: FlatSaveBonus | null`; `NO_SUBRACE.flatSaveBonus === null`; `RawSubrace.flatSaveBonus?: unknown`
  - `interface RacialSaveModifierInput { race: Race; category: SaveCategory; con: number; tags?: readonly SaveEffectTag[]; conAdjustment?: number; flat?: { all: number; poison: number } | null }` and `racialSaveModifier(input: RacialSaveModifierInput): number` (exported from `src/core/saves`)
  - `SaveTargetInput.racialFlatSaveBonus?` and `SaveTargetBestInput.racialFlatSaveBonus?: { all: number; poison: number } | null`

- [ ] **Step 1: Write the failing tests.**

In `tests/core/races/subrace.test.ts`: change the `NO_SUBRACE` equality expectation to include `flatSaveBonus: null`; in the "keeps valid values" test add `flatSaveBonus: { all: 3, poison: 2 }` to the raw input and `expect(layer.flatSaveBonus).toEqual({ all: 3, poison: 2 })`; add:

```ts
  it("reads flatSaveBonus leniently: both integers or null", () => {
    expect(normalizeSubrace({ flatSaveBonus: { all: 3, poison: 2 } }).flatSaveBonus).toEqual({ all: 3, poison: 2 });
    expect(normalizeSubrace({ flatSaveBonus: { all: 0, poison: 0 } }).flatSaveBonus).toEqual({ all: 0, poison: 0 });
    for (const bad of [undefined, null, "x", 7, {}, { all: 3 }, { poison: 2 }, { all: 3, poison: "2" }, { all: 3.5, poison: 2 }]) {
      expect(normalizeSubrace({ flatSaveBonus: bad }).flatSaveBonus, JSON.stringify(bad)).toBeNull();
    }
  });
```

In the core saves test file(s), import `racialSaveModifier` (and `saveTargetBest` if not present) and add:

```ts
describe("racialSaveModifier (SP12 Plan C)", () => {
  const flat = { all: 3, poison: 2 };
  const CATEGORIES = ["ppd", "rsw", "pp", "bw", "spell"] as const;
  const RACES = ["human", "dwarf", "elf", "gnome", "half-elf", "halfling"] as const;
  it("a flat bonus is `all` for every category, whatever the race or Constitution", () => {
    for (const race of RACES) for (const category of CATEGORIES) {
      expect(racialSaveModifier({ race, category, con: 3, flat }), `${race} ${category}`).toBe(3);
      expect(racialSaveModifier({ race, category, con: 18, flat }), `${race} ${category}`).toBe(3);
    }
  });
  it("a poison-tagged paralysis/poison save uses the poison value; the tag changes nothing else", () => {
    expect(racialSaveModifier({ race: "gnome", category: "ppd", con: 12, tags: ["poison"], flat })).toBe(2);
    expect(racialSaveModifier({ race: "gnome", category: "rsw", con: 12, tags: ["poison"], flat })).toBe(3);
    expect(racialSaveModifier({ race: "gnome", category: "pp", con: 12, tags: ["poison"], flat })).toBe(3);
  });
  it("a flat bonus REPLACES the Constitution bonus (a gnome with CON 14 would otherwise get +4)", () => {
    expect(racialSaveBonus("gnome", "rsw", 14)).toBe(4);
    expect(racialSaveModifier({ race: "gnome", category: "rsw", con: 14, flat })).toBe(3);
  });
  it("with no flat bonus it equals racialSaveBonus, including the Constitution adjustment", () => {
    for (const race of RACES) for (const category of CATEGORIES) for (const tags of [[], ["poison"]] as const) for (const adj of [0, 1]) {
      expect(racialSaveModifier({ race, category, con: 14, tags, conAdjustment: adj, flat: null }), `${race} ${category}`)
        .toBe(racialSaveBonus(race, category, 14, tags, adj));
      expect(racialSaveModifier({ race, category, con: 14, tags, conAdjustment: adj }))
        .toBe(racialSaveBonus(race, category, 14, tags, adj));
    }
  });
  it("still validates the Constitution score on both paths", () => {
    expect(() => racialSaveModifier({ race: "dwarf", category: "rsw", con: 0, flat })).toThrow();
    expect(() => racialSaveModifier({ race: "dwarf", category: "rsw", con: 0 })).toThrow();
  });
});

describe("saveTargetBest with a flat racial bonus (SP12 Plan C)", () => {
  const base = { groups: [{ group: "warrior" as const, level: 3 }], category: "rsw" as const, race: "gnome" as const, con: 14, wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0 };
  it("replaces the Constitution bonus in the breakdown and the roll modifier", () => {
    expect(saveTargetBest(base).breakdown.racialConBonus).toBe(4);
    const flat = saveTargetBest({ ...base, racialFlatSaveBonus: { all: 3, poison: 2 } });
    expect(flat.breakdown.racialConBonus).toBe(3);
    expect(flat.rollModifier).toBe(3);
  });
  it("uses the poison value for a poison-tagged paralysis/poison save", () => {
    const r = saveTargetBest({ ...base, category: "ppd", tags: ["poison"], racialFlatSaveBonus: { all: 3, poison: 2 } });
    expect(r.breakdown.racialConBonus).toBe(2);
  });
});
```
(Use the file's existing imports/helpers; if `saveTarget` is the more convenient entry in the existing tests, add one `saveTarget({... racialFlatSaveBonus })` assertion too so its forwarding is covered.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/core`
Expected: FAIL (missing export / field).

- [ ] **Step 3: Implement.**

`src/core/races/subrace.ts`:
- Add `export interface FlatSaveBonus { /** every saving throw */ all: number; /** a poison-tagged paralysis/poison save */ poison: number }`.
- `SubraceLayer`: add `/** SP12 Plan C: a flat saving-throw bonus that REPLACES the race's Constitution-based bonus (Deep Gnome +3 all, +2 poison); null = none */ flatSaveBonus: FlatSaveBonus | null;`.
- `NO_SUBRACE`: add `flatSaveBonus: null,`. `RawSubrace`: add `flatSaveBonus?: unknown;`.
- Add above `normalizeSubrace`:

```ts
function normalizeFlatSaveBonus(raw: unknown): FlatSaveBonus | null {
  if (!raw || typeof raw !== "object") return null;
  const { all, poison } = raw as { all?: unknown; poison?: unknown };
  return isInt(all) && isInt(poison) ? { all, poison } : null;
}
```
and in `normalizeSubrace`'s returned object add `flatSaveBonus: normalizeFlatSaveBonus(raw?.flatSaveBonus),`.

`src/core/saves/racial.ts` — append (reusing the file's `assertAbilityScore` and types):

```ts
export interface RacialSaveModifierInput {
  race: Race;
  category: SaveCategory;
  con: number;
  tags?: readonly SaveEffectTag[];
  /** a subrace's Constitution-save adjustment (SP12 Plan A) */
  conAdjustment?: number;
  /** a subrace's flat bonus (SP12 Plan C): when set it REPLACES the Constitution-based bonus */
  flat?: { all: number; poison: number } | null;
}

/**
 * The racial saving-throw modifier, decided in one place (SP12 Plan C). A flat bonus (Deep Gnome)
 * applies to every category — `poison` for a poison-tagged paralysis/poison save — and replaces the
 * Constitution-based bonus; with no flat bonus this is exactly `racialSaveBonus`.
 */
export function racialSaveModifier(input: RacialSaveModifierInput): number {
  assertAbilityScore(input.con, "con");
  const tags = input.tags ?? [];
  if (input.flat) return input.category === "ppd" && tags.includes("poison") ? input.flat.poison : input.flat.all;
  return racialSaveBonus(input.race, input.category, input.con, tags, input.conAdjustment ?? 0);
}
```

`src/core/saves/composer.ts`:
- Import `racialSaveModifier` instead of `racialSaveBonus` (`import { racialSaveModifier } from "./racial";`).
- Add to BOTH `SaveTargetInput` and `SaveTargetBestInput` (next to `racialSaveAdjustment`): `/** SP12 Plan C: a subrace's flat save bonus (replaces the Constitution-based bonus) */ racialFlatSaveBonus?: { all: number; poison: number } | null;`.
- Replace the `racialSaveBonus(...)` call with:

```ts
  const racialConBonus = racialSaveModifier({
    race: input.race,
    category: input.category,
    con: input.con,
    tags,
    conAdjustment: input.racialSaveAdjustment ?? 0,
    flat: input.racialFlatSaveBonus ?? null,
  });
```
- In `saveTarget`'s call to `saveTargetBest` add `racialFlatSaveBonus: input.racialFlatSaveBonus,`.
- Update the `breakdown.racialConBonus` doc comment: "the racial saving-throw modifier (the Constitution-based bonus, or a subrace's flat bonus)".

- [ ] **Step 4: Run to verify they pass, plus typecheck**

Run: `npx vitest run tests/core && npm run typecheck`
Expected: PASS. Fix any existing test or source that builds a `SubraceLayer` object literal without `flatSaveBonus` (tsc lists them; add `flatSaveBonus: null`).

- [ ] **Step 5: Commit**

```bash
git add src/core tests/core
git commit -m "feat(races): pure flat saving-throw bonus on the subrace layer and racialSaveModifier

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Schema and derive plumbing

**Files:**
- Modify: `src/data/item/race.ts`, `src/data/derive/character/saves.ts`, `src/data/derive/character/derive.ts`
- Test: `tests/data/derive/character/saves.test.ts`, `tests/data/derive/character/derive.test.ts`, `tests/sheets/character/context.test.ts` (literal fix-ups only)

**Interfaces:**
- Consumes: `FlatSaveBonus`, `SubraceLayer.flatSaveBonus`, `racialSaveModifier`, `SaveTargetBestInput.racialFlatSaveBonus` (Task 1).
- Produces: race-item `system.subrace.flatSaveBonus` (schema); `SavesInput.racialFlatSaveBonus?: { all: number; poison: number } | null`.

- [ ] **Step 1: Write the failing tests.**

In `tests/data/derive/character/saves.test.ts`, using the file's fixtures:

```ts
  it("a flat racial save bonus replaces the Constitution bonus on every category (SP12 Plan C)", () => {
    const input = { groups: [{ group: "warrior" as const, level: 3 }], race: "gnome" as const, con: 15, wisMagicalDefenseAdj: 0, dexDefensiveAdj: 0 };
    const plain = deriveSaves(input);
    expect(plain.rsw.rollModifier).toBe(4);   // gnome CON 15 -> +4 on rod/staff/wand and spell
    expect(plain.spell.rollModifier).toBe(4);
    expect(plain.pp.rollModifier).toBe(0);
    const deep = deriveSaves({ ...input, racialFlatSaveBonus: { all: 3, poison: 2 } });
    for (const category of ["ppd", "rsw", "pp", "bw", "spell"] as const) expect(deep[category].rollModifier, category).toBe(3);
  });
```

In `tests/data/derive/character/derive.test.ts`, extend the Plan A "subrace layer" describe (it already has `dwarfFighter`, a `deepLayer` literal — add `flatSaveBonus: null` to that literal) with:

```ts
  it("a Deep Gnome layer gives +3 on every save; a Rock Gnome keeps the Constitution bonus (SP12 Plan C)", () => {
    const gnomeFighter = { ...base, race: "gnome" as const, classes: [{ ...fighterClass, level: 3, xp: 4000 }], abilities: { ...base.abilities, con: 15 } };
    const noLayer = { id: "", abilityAdjustments: null, abilityRanges: null, thiefAdjustments: null, conSaveBonusAdjustment: 0, xpModifierPercent: 0, flatSaveBonus: null };
    const rock = deriveCharacter({ ...gnomeFighter, raceLayer: noLayer }, DEFAULT_OPTIONAL_RULES);
    const deep = deriveCharacter({ ...gnomeFighter, raceLayer: { ...noLayer, id: "deep-gnome", flatSaveBonus: { all: 3, poison: 2 } } }, DEFAULT_OPTIONAL_RULES);
    expect(rock.saves!.rsw.rollModifier).toBe(4);
    expect(rock.saves!.pp.rollModifier).toBe(0);
    for (const category of ["ppd", "rsw", "pp", "bw", "spell"] as const) expect(deep.saves![category].rollModifier, category).toBe(3);
    // null / absent flat bonus leaves the derive unchanged
    expect(deriveCharacter({ ...gnomeFighter, raceLayer: null }, DEFAULT_OPTIONAL_RULES)).toEqual(rock);
  });
```
(The multi-class path shares `deriveSaves`; if the file has a multiclass derive test, add one assertion there that the layer's flat bonus reaches the multiclass `saves` too.) In `tests/sheets/character/context.test.ts` add `flatSaveBonus: null` to the `baseLayer` literal (type fix-up only).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/data/derive`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`src/data/derive/character/saves.ts`: add to `SavesInput`:

```ts
  /** SP12 Plan C: a subrace's flat saving-throw bonus (replaces the Constitution-based bonus) */
  racialFlatSaveBonus?: { all: number; poison: number } | null;
```
and pass `racialFlatSaveBonus: input.racialFlatSaveBonus,` in the `saveTargetBest` call.

`src/data/derive/character/derive.ts`: at BOTH `deriveSaves({...})` call sites (the single-class one and the multi/dual one), next to `racialSaveAdjustment`, add `racialFlatSaveBonus: snapshot.raceLayer?.flatSaveBonus ?? null,`.

`src/data/item/race.ts`: inside the `subrace` SchemaField, after `xpModifierPercent`, add:

```ts
        /** SP12 Plan C: a flat saving-throw bonus that REPLACES the race's Constitution-based bonus (Deep Gnome: all 3, poison 2); null = none. Nullable SchemaField, same precedent as abilityAdjustments. */
        flatSaveBonus: new SchemaField(
          {
            all: new NumberField({ required: true, integer: true, initial: 0 }),
            poison: new NumberField({ required: true, integer: true, initial: 0 }),
          },
          { required: true, nullable: true, initial: null },
        ),
```
(The snapshot builder already passes the whole normalized layer through `normalizeSubrace`, so no snapshot edit is needed; confirm by reading `src/data/actor/snapshot.ts`.)

- [ ] **Step 4: Run to verify they pass, plus the CI-style checks**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(races): race-item flatSaveBonus schema and saves derive plumbing

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The eleven gnome and halfling subraces, manifest, README

**Files:**
- Create: the eleven JSON files under `packs/races/_source/` (names in File Structure above)
- Modify: `packs/races/_source/_MANIFEST.md`, `README.md`, `tests/packs/content.test.ts`

**Interfaces:** Consumes the schema (Task 2) and `normalizeSubrace` (Task 1).

- [ ] **Step 1: Write the failing test.** In `tests/packs/content.test.ts`, `describe("races pack content")`:

1. Update the count test: 28 items (6 PHB + 6 dwarf + 5 elf + 4 gnome + 7 halfling); the set of `raceId`s still equals `RACE_IDS`; subraces (non-blank `subrace.id`) are 22; the dwarf ones `raceId: "dwarf"` (6), elf (5), gnome (4), halfling (7).
2. Keep the existing dwarf and elf tests (their filters are already restricted by `raceId`). Add a `SMALL` table and test (import nothing new beyond what the file already has):

```ts
  const SMALL = {
    "rock-gnome":     { race: "gnome", adj: { int: 1, wis: -1 }, ranges: [[6,18],[3,18],[8,18],[7,19],[3,17],[3,18]], infra: 60, flat: null,
                        langs: ["common", "dwarf", "halfling", "kobold", "goblin", "burrowing animal"], features: [] },
    "deep-gnome":     { race: "gnome", adj: { dex: 1, wis: 1, int: -1, cha: -2 }, ranges: [[6,18],[6,19],[6,18],[3,17],[4,18],[3,16]], infra: 120, flat: { all: 3, poison: 2 },
                        langs: ["gnome common", "underworld common", "drow", "kuo-toan", "earth elemental"],
                        features: ["Deep gnome: magic resistance", "Deep gnome: innate illusions", "Deep gnome: freeze in place", "Deep gnome: surprise bonuses", "Deep gnome: improving armor class", "Deep gnome: stun darts"] },
    "tinker-gnome":   { race: "gnome", adj: { dex: 2, str: -1, wis: -1 }, ranges: [[6,18],[8,18],[8,18],[8,18],[3,12],[3,18]], infra: 60, flat: null,
                        langs: ["gnome common", "any human language"], features: ["Tinker: unreliable inventions"] },
    "forest-gnome":   { race: "gnome", adj: { dex: 1, wis: 1, str: -1, int: -1 }, ranges: [[3,17],[8,19],[8,18],[3,17],[6,18],[3,18]], infra: 0, flat: null,
                        langs: ["gnome common", "elf", "treant", "forest mammal"],
                        features: ["Forest gnome: pass without trace", "Forest gnome: hide in woods", "Forest gnome: armor class bonus vs larger foes"] },
    "hairfoot":       { race: "halfling", adj: { str: -1, dex: 1 }, ranges: [[3,17],[8,19],[10,18],[6,18],[3,18],[7,18]], infra: 0, flat: null,
                        langs: ["any human language"], features: ["Hairfoot: reaction bonus with humans"] },
    "stout-dex":      { race: "halfling", adj: { str: -1, dex: 1 }, ranges: [[5,17],[8,19],[10,19],[6,18],[3,18],[5,18]], infra: 60, flat: null,
                        langs: ["dwarvish"], features: ["Stout: underground detection"] },
    "stout-con":      { race: "halfling", adj: { str: -1, con: 1 }, ranges: [[5,17],[8,19],[10,19],[6,18],[3,18],[5,18]], infra: 60, flat: null,
                        langs: ["dwarvish"], features: ["Stout: underground detection"] },
    "tallfellow-dex": { race: "halfling", adj: { str: -1, dex: 1 }, ranges: [[3,17],[8,19],[10,18],[6,18],[7,19],[5,18]], infra: 0, flat: null,
                        langs: ["elvish"], features: ["Tallfellow: secret door detection", "Tallfellow: woodland surprise bonus"] },
    "tallfellow-wis": { race: "halfling", adj: { str: -1, wis: 1 }, ranges: [[3,17],[8,19],[10,18],[6,18],[7,19],[5,18]], infra: 0, flat: null,
                        langs: ["elvish"], features: ["Tallfellow: secret door detection", "Tallfellow: woodland surprise bonus"] },
    "furchin":        { race: "halfling", adj: { con: 1, dex: 1, str: -1, wis: -1 }, ranges: [[3,17],[8,19],[10,19],[6,18],[3,17],[7,18]], infra: 0, flat: null,
                        langs: ["dwarvish"], features: ["Furchin: cold-weather survival", "Furchin: cold save bonus", "Furchin: armor class bonus vs larger foes"] },
    "kender":         { race: "halfling", adj: { dex: 2, str: -1 }, ranges: [[6,16],[8,19],[10,18],[6,18],[3,16],[6,18]], infra: 30, flat: null,
                        langs: ["krynn common"], features: ["Kender: fearless", "Kender: the taunt", "Kender: natural thieving talent"] },
  } as const;

  it("every gnome and halfling subrace matches The Complete Book of Gnomes and Halflings (PHBR9)", () => {
    const subs = items.filter((d) => ["gnome", "halfling"].includes(String(sys(d).raceId)) && (sys(d).subrace as { id?: string }).id);
    expect(subs.map((d) => (sys(d).subrace as { id: string }).id).sort()).toEqual(Object.keys(SMALL).sort());
    for (const d of subs) {
      const id = (sys(d).subrace as { id: keyof typeof SMALL }).id;
      const want = SMALL[id];
      const layer = normalizeSubrace(sys(d).subrace as never);
      const phb = items.find((p) => sys(p).raceId === want.race && !(sys(p).subrace as { id?: string } | undefined)?.id)!;
      expect(sys(d).raceId, id).toBe(want.race);
      expect(layer.abilityAdjustments, id).toEqual(want.adj);
      expect(ABILITY_KEYS.map((k) => layer.abilityRanges![k]), id).toEqual(want.ranges);
      expect(layer.flatSaveBonus, id).toEqual(want.flat);
      expect(layer.xpModifierPercent, id).toBe(0);
      expect(layer.conSaveBonusAdjustment, id).toBe(0);
      expect(layer.thiefAdjustments, id).toBeNull();
      expect(sys(d).infravision, id).toBe(want.infra);
      expect(sys(d).bonusLanguages, id).toEqual(want.langs);
      expect(sys(d).grantedFeatures, id).toEqual(want.features);
      expect(sys(d).size, id).toBe("small");
      expect(sys(d).baseMovement, id).toBe(6);
      expect(sys(d).description, id).toBe("");
      // the book gives subraces no limits or class lists of their own: copied from the PHB item
      expect(sys(d).classLevelLimits, id).toEqual(sys(phb).classLevelLimits);
      expect(sys(d).allowedClasses, id).toEqual(sys(phb).allowedClasses);
      expect(sys(d).allowedMulticlass, id).toEqual(sys(phb).allowedMulticlass);
    }
  });
```
(In the existing dwarf and elf tests, make sure the "no flat bonus" expectation also holds if they iterate layers: add `expect(layer.flatSaveBonus).toBeNull()` to both.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/packs/content.test.ts`
Expected: FAIL (17 items; no gnome/halfling subraces).

- [ ] **Step 3: Implement.** Create the eleven JSON files, each modeled on `packs/races/_source/deep-dwarf.json` (same shape; add `"flatSaveBonus"` inside `subrace`). Common to every file: `"description": ""`, `"size": "small"`, `"baseMovement": 6`, `"type": "race"`, `"img"` copied from the PHB item of that base race (`gnome.json` / `halfling.json`), `classLevelLimits`, `allowedClasses` and `allowedMulticlass` COPIED from that PHB item, and a `subrace` block with: `id`, `abilityAdjustments` (all six integers, zeros included), `abilityRanges` ({min,max} for all six), `thiefAdjustments: null`, `conSaveBonusAdjustment: 0`, `xpModifierPercent: 0`, `flatSaveBonus` (`null`, or `{ "all": 3, "poison": 2 }` for Deep Gnome). Values come from the `SMALL` table in Step 1 (adjustments, ranges, infravision, languages as `bonusLanguages`, features as `grantedFeatures`). Per-file identity:

| file | `_id` (16 chars) | name | `raceId` | `subrace.id` |
|---|---|---|---|---|
| rock-gnome.json | `kGnomeRock000001` | Rock Gnome | gnome | rock-gnome |
| deep-gnome.json | `kGnomeDeep000001` | Deep Gnome | gnome | deep-gnome |
| tinker-gnome.json | `kGnomeTinker0001` | Tinker Gnome | gnome | tinker-gnome |
| forest-gnome.json | `kGnomeForest0001` | Forest Gnome | gnome | forest-gnome |
| hairfoot.json | `kHalfHairfoot001` | Hairfoot | halfling | hairfoot |
| stout-dexterity.json | `kHalfStoutDex001` | Stout (Dexterity) | halfling | stout-dex |
| stout-constitution.json | `kHalfStoutCon001` | Stout (Constitution) | halfling | stout-con |
| tallfellow-dexterity.json | `kHalfTallDex0001` | Tallfellow (Dexterity) | halfling | tallfellow-dex |
| tallfellow-wisdom.json | `kHalfTallWis0001` | Tallfellow (Wisdom) | halfling | tallfellow-wis |
| furchin.json | `kHalfFurchin0001` | Furchin | halfling | furchin |
| kender.json | `kHalfKender00001` | Kender | halfling | kender |

`_key` is `!items!<_id>`; names are unique; the ids above are exactly 16 characters (the existing unique-name / 16-char-id test checks every item).

Also add `"flatSaveBonus": null` to the existing PHB, dwarf and elf JSON files ONLY IF the build's strict key-count guard (`npm run build:packs`, the `compilePack` key-count check) requires every `subrace` block to list every field; otherwise leave them (the schema default is null). Verify by running `npm run build:packs` (or the scratch-dir compile if Foundry is open and holds the lock).

`packs/races/_source/_MANIFEST.md`: append a "Gnome and halfling subraces (SP12 Plan C)" section (source: *The Complete Book of Gnomes and Halflings* ch. 2 pp. 20-37 and 66-77, text layer and, for the Tallfellow table, the page image; eleven items; Rock Gnome and Hairfoot are shipped because their ranges/infravision differ from the PHB items; "either/or" adjustments are two items each; the Deep Gnome's flat save bonus; the Athasian halfling is deliberately not shipped (Dark Sun is planned separately); specials are labels only).

`README.md`: update the Sub-project 12 row: Plans A-C complete (engine, the six dwarf subraces, the five elf subraces, the four gnome and seven halfling subraces, the flat save bonus); note the Athasian halfling and Dark Sun content are deferred, level limits are still data only and specials are labels only. Keep the row's other wording.

- [ ] **Step 4: Run to verify, then build**

Run: `npx vitest run tests/packs tests/data && npm run build:packs`
Expected: PASS; `build-packs: races  28/28 documents OK` (or the scratch-dir equivalent if Foundry holds the lock).

- [ ] **Step 5: Commit**

```bash
git add packs README.md tests/packs
git commit -m "feat(races): the four gnome and seven halfling subraces from PHBR9, manifest, README (SP12 Plan C)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Verification gates (no new feature code unless a gate fails)

- [ ] **Step 1: The full CI sequence.** `npm run typecheck && npm run lint && npm run test:coverage && npm run build` (build only with Foundry closed; otherwise rely on CI and the scratch-dir compile). Expected: all green, 100% statements/lines/functions.
- [ ] **Step 2: Whole-branch review** (most capable model) on `git diff master...HEAD`. Pay attention to: `racialSaveModifier` with and without `flat` for every race/category (existing PHB, dwarf and elf saves must be byte-identical); both `deriveSaves` call sites; the schema field and clean defaults for pre-existing items; that a Deep Gnome's cached save block is untagged (+3 on `ppd`, since the cached baseline has no poison tag); NPC and PC use the same layer; the content values vs the spec table; UTF-8/CRLF hygiene; the `ObjectField` shared-initial lesson (no `initial: {}`/`[]`).
- [ ] **Step 3: Headless proof (controller; see the `foundry-headless-proof-harness` memory).** Real Foundry schema + shipped JSON: all 28 race items validate after `clean`; pre-existing items clean to `flatSaveBonus: null`; Deep Gnome through the real `snapshotActor` -> `deriveCharacter` gives +3 on all five saves while a Rock Gnome with the same Constitution gets the Constitution-based bonus on rod/staff/wand and spell only, and a Forest Gnome likewise; a dwarf and an elf derive exactly as before; real ability adjustments for Stout (Dexterity) vs Stout (Constitution) and Tallfellow (Dexterity) vs (Wisdom); the range-warning computation for a Forest Gnome with low Dexterity; XP surcharge stays 0; thief tables inherit.
- [ ] **Step 4: Rebuild the installed system** only if Foundry is closed (check for a running process first).
- [ ] **Step 5: Push and open the PR** (branch-finishing preference: always push + PR, never ask). PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Confirm CI is green; do NOT retry `gh pr merge`; ask the user to merge. Hand the user a short manual checklist (what the harness cannot prove): as a non-GM player seat, drop Deep Gnome and read the Saving Throws panel (+3 on each, versus a Rock Gnome whose bonus is Constitution-based on rod/staff/wand and spell only); drop Stout (Constitution) and see Con +1 / Str -1; drop Forest Gnome on a character with Dexterity 6 and see the out-of-range toast; drop a plain PHB Gnome and confirm nothing changes.

---

## Self-Review notes

- Spec coverage: engine (layer field, `racialSaveModifier`, composer, schema, derive) -> Tasks 1-2; eleven items, copied class data, labels, manifest/README -> Task 3; tests, gates, headless proof, manual checklist -> Tasks 1-4.
- Names are consistent: `FlatSaveBonus`, `SubraceLayer.flatSaveBonus`, `RawSubrace.flatSaveBonus`, `racialSaveModifier`, `RacialSaveModifierInput`, `racialFlatSaveBonus` (composer and `SavesInput`), `subrace.flatSaveBonus` (schema).
- Judgment points flagged for the implementer: the exact existing test fixtures in the core saves and derive tests, whether the build's key-count guard needs `flatSaveBonus` listed in every `subrace` block, and which existing literals need `flatSaveBonus: null`.
