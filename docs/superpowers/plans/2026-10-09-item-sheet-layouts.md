# Item Sheet Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give weapon, armor, equipment, ammo and spell item sheets designed layouts (a stat strip and ordered panels, a themed spell card), add proper labels for armor and weapon enums, and show item prose descriptions in actor-sheet inventory row summaries.

**Architecture:** A pure `applyLayout` function (new `src/sheets/item-layouts/`, in the coverage gate) rearranges the field rows the generic raw-field sheet already builds into a strip plus ordered panels, with unclaimed rows falling into an automatic "Other" panel. A declarative `ITEM_LAYOUTS` table holds the five specs. The Handlebars template is split into two reusable partials (row, panel) so strip, leading panels, description and trailing panels share one renderer. Label maps are new `CONFIG.ADND2E` entries consulted by choice rows and by inventory row summaries.

**Tech Stack:** TypeScript, Foundry VTT v14 (ApplicationV2 item sheets), Handlebars, SCSS, vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-adnd2e-item-sheet-layouts-design.md`

## Global Constraints

- Five types get layouts: weapon, armor, equipment, ammo, spell. The other nine item types keep the current `groupFieldRows` rendering, byte-for-byte unchanged in behavior.
- A layout may rearrange and group rows but must never drop one: every schema field is either claimed by the strip/a panel or lands in the trailing "Other" panel. A path in a layout that matches no row is reported in `unknownPaths` (and must be zero for all five shipped layouts).
- Claiming a path claims that row plus every row whose path starts with `<path>.` (a whole `SchemaField` group, including a nullable group's "Set" row and its children, moves as a unit). Rows keep their `indent`, `data-*` attributes, `kind` and `nullGroup`/`hidden` untouched, so every existing parser in `_processFormData` keeps working. `_processFormData` is NOT changed.
- A group heading row (`header: true` or `kind: "nullcheck"`) left with no remaining children is dropped from the "Other" panel (an orphaned heading, e.g. `system.components` when the strip claims `components.v/s/m`).
- Label lookup falls back to the raw value whenever a map or key is missing; it must never render blank.
- Description enrichment uses Foundry's `enrichHTML` (sanitizing), never raw HTML.
- No schema, setting or migration change. No change to the other nine item types. The item Effects UI is a separate later item (#146).
- Spell and gear panel titles use `ADND2E.sheets.layout.*` keys; map labels use `ADND2E.armorTypes.*`, `ADND2E.weaponDamageTypes.*`, `ADND2E.weaponCategories.*`, `ADND2E.weaponSizes.*`.
- Before opening a PR: `npm run lint`, `npm run typecheck` (includes the Foundry-free `tsconfig.core.json`), `npm run test:coverage` (100% statements).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 1: The pure `applyLayout` engine

**Files:**
- Create: `src/sheets/item-layouts/apply.ts`
- Create: `tests/sheets/item-layouts/apply.test.ts`
- Modify: `vitest.config.ts` (add `"src/sheets/item-layouts/**/*.ts",` to the coverage `include`, next to `"src/sheets/kit/**/*.ts",`)

**Interfaces:**
- Produces (exported from `src/sheets/item-layouts/apply.ts`):
  ```ts
  export interface LayoutRow { path: string; indent: number; header?: boolean; kind?: string }
  export type StripDisplay = "field" | "badge" | "pill" | "chips";
  export type StripEntry = string | { path: string; display: StripDisplay };
  export interface LayoutPanel { titleKey: string; paths: readonly string[]; columns?: 1 | 2 | 3 }
  export interface ItemLayout {
    strip?: readonly StripEntry[];
    panels: readonly LayoutPanel[];
    /** index into `panels` the description is placed under; omitted = the description stays above every panel */
    descriptionAfterPanel?: number;
  }
  export interface PanelView<R> { title: string; titleKey: string; isHeader: true; rows: R[]; columns: 1 | 2 | 3 }
  export interface StripItem<R> { row: R; display: StripDisplay }
  export interface LayoutResult<R> {
    strip: StripItem<R>[];
    leading: PanelView<R>[];   // panels rendered before the description
    trailing: PanelView<R>[];  // panels rendered after the description (includes "Other")
    unknownPaths: string[];
  }
  export const OTHER_TITLE_KEY = "ADND2E.sheets.layout.other";
  export function applyLayout<R extends LayoutRow>(rows: readonly R[], layout: ItemLayout): LayoutResult<R>;
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/sheets/item-layouts/apply.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyLayout, OTHER_TITLE_KEY, type ItemLayout, type LayoutRow } from "../../../src/sheets/item-layouts/apply";

const row = (path: string, extra: Partial<LayoutRow> = {}): LayoutRow & { tag: string } => ({
  path, indent: path.split(".").length * 12 - 12, tag: path, ...extra,
});

const ROWS = [
  row("system.a"), row("system.b"), row("system.c"),
  row("system.grp", { header: true }), row("system.grp.x"), row("system.grp.y"),
  row("system.nul", { kind: "nullcheck" }), row("system.nul.p"), row("system.nul.q"),
  row("system.comp", { header: true }), row("system.comp.v"), row("system.comp.s"),
];

const paths = (rs: readonly LayoutRow[]) => rs.map((r) => r.path);

describe("applyLayout", () => {
  it("places claimed rows in the listed panel order and the claimed-path order", () => {
    const layout: ItemLayout = { panels: [{ titleKey: "t.one", paths: ["system.b", "system.a"] }, { titleKey: "t.two", paths: ["system.c"] }] };
    const r = applyLayout(ROWS, layout);
    expect(r.leading).toEqual([]);
    expect(r.trailing.map((p) => p.titleKey).slice(0, 2)).toEqual(["t.one", "t.two"]);
    expect(paths(r.trailing[0]!.rows)).toEqual(["system.b", "system.a"]);
    expect(paths(r.trailing[1]!.rows)).toEqual(["system.c"]);
    expect(r.trailing[0]!.isHeader).toBe(true);
    expect(r.trailing[0]!.columns).toBe(1);
  });

  it("claiming a group path moves the heading and every child together, in schema order", () => {
    const r = applyLayout(ROWS, { panels: [{ titleKey: "t.g", paths: ["system.grp"] }, { titleKey: "t.n", paths: ["system.nul"] }] });
    expect(paths(r.trailing[0]!.rows)).toEqual(["system.grp", "system.grp.x", "system.grp.y"]);
    expect(paths(r.trailing[1]!.rows)).toEqual(["system.nul", "system.nul.p", "system.nul.q"]);
  });

  it("does not match a sibling that merely shares a prefix", () => {
    const rows = [row("system.range"), row("system.rangeBonus")];
    const r = applyLayout(rows, { panels: [{ titleKey: "t", paths: ["system.range"] }] });
    expect(paths(r.trailing[0]!.rows)).toEqual(["system.range"]);
    expect(paths(r.trailing[1]!.rows)).toEqual(["system.rangeBonus"]);
  });

  it("collects every unclaimed row in a trailing Other panel", () => {
    const r = applyLayout(ROWS, { panels: [{ titleKey: "t", paths: ["system.a"] }] });
    const other = r.trailing[r.trailing.length - 1]!;
    expect(other.titleKey).toBe(OTHER_TITLE_KEY);
    expect(paths(other.rows)).toEqual([
      "system.b", "system.c", "system.grp", "system.grp.x", "system.grp.y",
      "system.nul", "system.nul.p", "system.nul.q",
      // system.comp heading is NOT orphaned here: its children are unclaimed
      "system.comp", "system.comp.v", "system.comp.s",
    ]);
  });

  it("drops a group heading whose children were all claimed individually (an orphaned heading)", () => {
    const r = applyLayout(ROWS, {
      strip: ["system.comp.v", "system.comp.s"],
      panels: [{ titleKey: "t", paths: ["system.a", "system.b", "system.c", "system.grp", "system.nul"] }],
    });
    expect(r.trailing.map((p) => p.titleKey)).toEqual(["t"]); // nothing left, so no Other panel
    expect(paths(r.strip.map((s) => s.row))).toEqual(["system.comp.v", "system.comp.s"]);
  });

  it("omits the Other panel when nothing is left and omits empty panels", () => {
    const layout: ItemLayout = {
      panels: [
        { titleKey: "t.all", paths: ROWS.map((x) => x.path).filter((p) => p !== "system.grp.x" && p !== "system.grp.y" && p !== "system.nul.p" && p !== "system.nul.q" && p !== "system.comp.v" && p !== "system.comp.s") },
        { titleKey: "t.empty", paths: ["system.missing"] },
      ],
    };
    const r = applyLayout(ROWS, layout);
    expect(r.trailing.map((p) => p.titleKey)).toEqual(["t.all"]);
    expect(r.unknownPaths).toEqual(["system.missing"]);
  });

  it("builds the strip with display hints, defaulting to field", () => {
    const r = applyLayout(ROWS, {
      strip: ["system.a", { path: "system.b", display: "badge" }, { path: "system.c", display: "pill" }],
      panels: [],
    });
    expect(r.strip.map((s) => [s.row.path, s.display])).toEqual([
      ["system.a", "field"], ["system.b", "badge"], ["system.c", "pill"],
    ]);
  });

  it("a path claimed twice (or not present) is reported unknown the second time", () => {
    const r = applyLayout(ROWS, { strip: ["system.a"], panels: [{ titleKey: "t", paths: ["system.a", "system.b"] }] });
    expect(r.unknownPaths).toEqual(["system.a"]);
    expect(paths(r.trailing[0]!.rows)).toEqual(["system.b"]);
  });

  it("honors per-panel columns", () => {
    const r = applyLayout(ROWS, { panels: [{ titleKey: "t", paths: ["system.a"], columns: 3 }] });
    expect(r.trailing[0]!.columns).toBe(3);
  });

  it("descriptionAfterPanel splits the panels around the description (Other stays trailing)", () => {
    const r = applyLayout(ROWS, {
      descriptionAfterPanel: 0,
      panels: [{ titleKey: "t.0", paths: ["system.a"] }, { titleKey: "t.1", paths: ["system.b"] }],
    });
    expect(r.leading.map((p) => p.titleKey)).toEqual(["t.0"]);
    expect(r.trailing.map((p) => p.titleKey)).toEqual(["t.1", OTHER_TITLE_KEY]);
  });

  it("never mutates or reorders the input rows and keeps the same row objects", () => {
    const copy = ROWS.map((x) => ({ ...x }));
    const r = applyLayout(ROWS, { panels: [{ titleKey: "t", paths: ["system.grp"] }] });
    expect(ROWS).toEqual(copy);
    expect(r.trailing[0]!.rows[0]).toBe(ROWS.find((x) => x.path === "system.grp"));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/sheets/item-layouts/apply.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/sheets/item-layouts/apply.ts`:

```ts
// Pure layout engine for the item sheets (#110). Takes the flat field rows the generic raw-field sheet already builds
// and arranges them into a stat strip plus ordered panels; anything a layout does not claim lands in a trailing "Other"
// panel, so a schema field can never silently disappear. No Foundry imports — the sheet engine in
// src/sheets/raw-field-sheet.ts owns row building and form round-tripping, which this never touches.

export interface LayoutRow {
  path: string;
  indent: number;
  header?: boolean;
  kind?: string;
}

export type StripDisplay = "field" | "badge" | "pill" | "chips";
export type StripEntry = string | { path: string; display: StripDisplay };

export interface LayoutPanel {
  titleKey: string;
  paths: readonly string[];
  columns?: 1 | 2 | 3;
}

export interface ItemLayout {
  strip?: readonly StripEntry[];
  panels: readonly LayoutPanel[];
  /** index into `panels` the description is placed under; omitted = the description stays above every panel */
  descriptionAfterPanel?: number;
}

export interface PanelView<R> {
  title: string;
  titleKey: string;
  isHeader: true;
  rows: R[];
  columns: 1 | 2 | 3;
}

export interface StripItem<R> {
  row: R;
  display: StripDisplay;
}

export interface LayoutResult<R> {
  strip: StripItem<R>[];
  leading: PanelView<R>[];
  trailing: PanelView<R>[];
  unknownPaths: string[];
}

export const OTHER_TITLE_KEY = "ADND2E.sheets.layout.other";

function isHeading(r: LayoutRow): boolean {
  return r.header === true || r.kind === "nullcheck";
}

/** Arrange `rows` per `layout`. Claiming a path claims that row and every row beneath it (`<path>.…`). */
export function applyLayout<R extends LayoutRow>(rows: readonly R[], layout: ItemLayout): LayoutResult<R> {
  const remaining = [...rows];
  const unknownPaths: string[] = [];

  const take = (path: string): R[] => {
    const taken: R[] = [];
    for (let i = 0; i < remaining.length; ) {
      const r = remaining[i]!;
      if (r.path === path || r.path.startsWith(`${path}.`)) {
        taken.push(r);
        remaining.splice(i, 1);
      } else {
        i += 1;
      }
    }
    if (taken.length === 0) unknownPaths.push(path);
    return taken;
  };

  const strip: StripItem<R>[] = [];
  for (const entry of layout.strip ?? []) {
    const path = typeof entry === "string" ? entry : entry.path;
    const display: StripDisplay = typeof entry === "string" ? "field" : entry.display;
    for (const row of take(path)) strip.push({ row, display });
  }

  const panels: PanelView<R>[] = [];
  const panelIndexByLayoutIndex: (number | undefined)[] = [];
  layout.panels.forEach((panel, layoutIndex) => {
    const panelRows = panel.paths.flatMap((p) => take(p));
    if (panelRows.length === 0) return;
    panelIndexByLayoutIndex[layoutIndex] = panels.length;
    panels.push({ title: "", titleKey: panel.titleKey, isHeader: true, rows: panelRows, columns: panel.columns ?? 1 });
  });

  // a heading whose children were all claimed elsewhere would render as a stray empty heading
  const other = remaining.filter((r) => !isHeading(r) || remaining.some((o) => o !== r && o.path.startsWith(`${r.path}.`)));
  const otherPanel: PanelView<R>[] = other.length
    ? [{ title: "", titleKey: OTHER_TITLE_KEY, isHeader: true, rows: other, columns: 1 }]
    : [];

  const after = layout.descriptionAfterPanel;
  let splitAt = 0;
  if (after !== undefined) {
    // the number of rendered panels at or before the layout index (a skipped empty panel does not count)
    splitAt = panelIndexByLayoutIndex.slice(0, after + 1).filter((i) => i !== undefined).length;
  }
  return {
    strip,
    leading: panels.slice(0, splitAt),
    trailing: [...panels.slice(splitAt), ...otherPanel],
    unknownPaths,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/sheets/item-layouts/apply.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint`
Expected: clean.

```bash
git add src/sheets/item-layouts/apply.ts tests/sheets/item-layouts/apply.test.ts vitest.config.ts
git commit -m "feat(item-sheets): pure applyLayout engine (#110)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The five layout specs and their panel titles

**Files:**
- Create: `src/sheets/item-layouts/layouts.ts`
- Create: `tests/sheets/item-layouts/layouts.test.ts`
- Modify: `lang/en.json` (add `sheets.layout.*` panel titles under the existing `sheets` object — find it: it already holds `detailsTitle`, `descriptionTitle`, `badListEntry`)

**Interfaces:**
- Consumes: Task 1 `ItemLayout`.
- Produces: `export const ITEM_LAYOUTS: Readonly<Record<string, ItemLayout>>` keyed by item type (`weapon`, `armor`, `equipment`, `ammo`, `spell`). Panel/strip paths are `system.<field>` paths matching the walker's row paths.

- [ ] **Step 1: Write the failing tests**

Create `tests/sheets/item-layouts/layouts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ITEM_LAYOUTS } from "../../../src/sheets/item-layouts/layouts";
import { OTHER_TITLE_KEY } from "../../../src/sheets/item-layouts/apply";

const LANG = JSON.parse(readFileSync(path.resolve(__dirname, "..", "..", "..", "lang", "en.json"), "utf8")) as Record<string, unknown>;
const hasKey = (key: string): boolean =>
  key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), LANG) !== undefined;

const claimed = (type: string): string[] => {
  const l = ITEM_LAYOUTS[type]!;
  return [
    ...(l.strip ?? []).map((e) => (typeof e === "string" ? e : e.path)),
    ...l.panels.flatMap((p) => [...p.paths]),
  ];
};

describe("ITEM_LAYOUTS", () => {
  it("defines exactly the five designed types", () => {
    expect(Object.keys(ITEM_LAYOUTS).sort()).toEqual(["ammo", "armor", "equipment", "spell", "weapon"]);
  });

  for (const type of ["weapon", "armor", "equipment", "ammo", "spell"]) {
    it(`${type}: no path is claimed twice and every path is a system path`, () => {
      const paths = claimed(type);
      expect(new Set(paths).size).toBe(paths.length);
      for (const p of paths) expect(p.startsWith("system."), p).toBe(true);
    });
    it(`${type}: every panel title key exists in en.json`, () => {
      for (const panel of ITEM_LAYOUTS[type]!.panels) expect(hasKey(panel.titleKey), panel.titleKey).toBe(true);
    });
  }

  it("the Other panel title exists in en.json", () => {
    expect(hasKey(OTHER_TITLE_KEY)).toBe(true);
  });

  it("the spell card strip uses badge, chips and pill hints and places the description after the Casting panel", () => {
    const spell = ITEM_LAYOUTS.spell!;
    const displays = Object.fromEntries((spell.strip ?? []).map((e) => (typeof e === "string" ? [e, "field"] : [e.path, e.display])));
    expect(displays["system.level"]).toBe("badge");
    expect(displays["system.schools"]).toBe("chips");
    expect(displays["system.spheres"]).toBe("chips");
    for (const c of ["v", "s", "m"]) expect(displays[`system.components.${c}`]).toBe("pill");
    expect(spell.panels[spell.descriptionAfterPanel!]!.titleKey).toBe("ADND2E.sheets.layout.casting");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/sheets/item-layouts/layouts.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the specs**

Create `src/sheets/item-layouts/layouts.ts`:

```ts
// Declarative layouts for the five item types that get a designed sheet (#110). Paths are the item sheet's own
// `system.<field>` row paths; anything not listed falls into the automatic "Other" panel (see apply.ts), and the
// layout census (headless proof) checks every path here names a real schema field. Panel titles are
// ADND2E.sheets.layout.* keys.
import type { ItemLayout, LayoutPanel } from "./apply";

const PHYSICAL: LayoutPanel = {
  titleKey: "ADND2E.sheets.layout.physical",
  paths: [
    "system.quantity", "system.weight", "system.cost", "system.location",
    "system.identified", "system.equipped", "system.magicBonus",
  ],
  columns: 2,
};

export const ITEM_LAYOUTS: Readonly<Record<string, ItemLayout>> = {
  weapon: {
    strip: ["system.category", "system.damageVsSM", "system.damageVsL", "system.damageType", "system.speedFactor"],
    panels: [
      {
        titleKey: "ADND2E.sheets.layout.combat",
        paths: ["system.size", "system.handsRequired", "system.rateOfFire", "system.materialToHit"],
        columns: 2,
      },
      { titleKey: "ADND2E.sheets.layout.range", paths: ["system.range"] },
      {
        titleKey: "ADND2E.sheets.layout.proficiency",
        paths: ["system.proficiencyGroup", "system.baseWeaponName", "system.styleGroup", "system.specialistWeaponClass"],
        columns: 2,
      },
      { titleKey: "ADND2E.sheets.layout.ammunition", paths: ["system.ammoType", "system.selectedAmmoId"], columns: 2 },
      PHYSICAL,
    ],
  },
  armor: {
    strip: ["system.baseAc", "system.armorType", "system.isShield"],
    panels: [
      { titleKey: "ADND2E.sheets.layout.protection", paths: ["system.shieldAcBonus"] },
      { titleKey: "ADND2E.sheets.layout.penalties", paths: ["system.movementPenalty", "system.checkPenalty"], columns: 2 },
      PHYSICAL,
    ],
  },
  equipment: {
    panels: [
      { titleKey: "ADND2E.sheets.layout.details", paths: ["system.category", "system.consumable"], columns: 2 },
      { titleKey: "ADND2E.sheets.layout.charges", paths: ["system.charges"] },
      {
        titleKey: "ADND2E.sheets.layout.container",
        paths: ["system.container", "system.capacity", "system.contentsWeightMultiplier"],
        columns: 2,
      },
      PHYSICAL,
    ],
  },
  ammo: {
    strip: ["system.ammoType", "system.damageVsSM", "system.damageVsL", "system.damageType"],
    panels: [PHYSICAL],
  },
  spell: {
    strip: [
      { path: "system.level", display: "badge" },
      "system.casterClass",
      { path: "system.schools", display: "chips" },
      { path: "system.spheres", display: "chips" },
      { path: "system.components.v", display: "pill" },
      { path: "system.components.s", display: "pill" },
      { path: "system.components.m", display: "pill" },
    ],
    descriptionAfterPanel: 0,
    panels: [
      {
        titleKey: "ADND2E.sheets.layout.casting",
        paths: ["system.range", "system.duration", "system.castingTime", "system.areaOfEffect", "system.savingThrow"],
        columns: 2,
      },
      { titleKey: "ADND2E.sheets.layout.components", paths: ["system.materialComponent"] },
      { titleKey: "ADND2E.sheets.layout.reversible", paths: ["system.reversible", "system.isReversedForm"], columns: 2 },
      { titleKey: "ADND2E.sheets.layout.automation", paths: ["system.automation"] },
    ],
  },
};
```

Before moving on, open each of `src/data/item/{weapon,armor,equipment,ammo,spell}.ts` and `src/data/common/physical-item.ts` and confirm every path above is a real field of that type (the census in Task 6 re-checks this against the live models). If a field is missing or named differently, fix the path here; if a real field is not claimed, leave it for the Other panel.

- [ ] **Step 4: Add the copy**

In `lang/en.json`, inside the existing top-level `sheets` object (the one with `detailsTitle`, `descriptionTitle`), add a `layout` object:

```json
      "layout": {
        "other": "Other",
        "physical": "Physical",
        "combat": "Combat",
        "range": "Range",
        "proficiency": "Proficiency & Mastery",
        "ammunition": "Ammunition",
        "protection": "Protection",
        "penalties": "Penalties",
        "details": "Details",
        "charges": "Charges",
        "container": "Container",
        "casting": "Casting",
        "components": "Components",
        "reversible": "Reversible",
        "automation": "Automation"
      },
```

(Match the surrounding indentation; confirm the file still parses: `node -e "JSON.parse(require('fs').readFileSync('lang/en.json','utf8'))"`.)

- [ ] **Step 5: Run to verify pass, then commit**

Run: `npx vitest run tests/sheets/item-layouts tests/lang && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add src/sheets/item-layouts/layouts.ts tests/sheets/item-layouts/layouts.test.ts lang/en.json
git commit -m "feat(item-sheets): layout specs for weapon, armor, equipment, ammo and spell (#110)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Label maps for armor and weapon enums, and choice-row labels

**Files:**
- Modify: `src/config.ts` (the `Adnd2eConfig`-style interface near line 65-85 and the builder that fills it, near the `damageTypes` literal ~line 199)
- Modify: `lang/en.json` (new label objects as siblings of `ADND2E.damageTypes`, near line 100)
- Create: `src/sheets/item-layouts/labels.ts`
- Create: `tests/sheets/item-layouts/labels.test.ts`
- Modify: `tests/config/build-config.test.ts` (the expected-key list ~line 16 and the `assertLabelMap` calls ~line 84)
- Modify: `src/sheets/handlebars.ts` (register a helper next to `adnd2eOrDash`, ~line 41)
- Modify: `src/sheets/raw-field-sheet.ts` (`toChoiceRows` and its callers in `walk`)

**Interfaces:**
- Produces:
  - `CONFIG.ADND2E.armorTypes`, `.weaponDamageTypes`, `.weaponCategories`, `.weaponSizes` — each `Record<value, "ADND2E.<map>.<value>">`.
  - `export const CHOICE_LABEL_MAPS: Readonly<Record<string, string>>` and `export function choiceLabelKey(path: string, value: string): string | null` in `src/sheets/item-layouts/labels.ts`.
  - Handlebars helper `adnd2eLabel(map: string, value: unknown): string` — returns the localized `ADND2E.<map>.<value>` when that key exists, else the raw value as a string (and `"—"`-free: an empty value returns `""`).

- [ ] **Step 1: Write the failing tests**

Create `tests/sheets/item-layouts/labels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CHOICE_LABEL_MAPS, choiceLabelKey } from "../../../src/sheets/item-layouts/labels";
import { ARMOR_TYPES, DAMAGE_TYPES, WEAPON_CATEGORIES, WEAPON_SIZES } from "../../../src/data/item/choices";

const LANG = JSON.parse(readFileSync(path.resolve(__dirname, "..", "..", "..", "lang", "en.json"), "utf8")) as { ADND2E: Record<string, Record<string, string>> };

describe("choiceLabelKey", () => {
  it("maps the four item enum fields to their label map keys", () => {
    expect(choiceLabelKey("system.armorType", "chain-mail")).toBe("ADND2E.armorTypes.chain-mail");
    expect(choiceLabelKey("system.damageType", "piercing-slashing")).toBe("ADND2E.weaponDamageTypes.piercing-slashing");
    expect(choiceLabelKey("system.category", "bow")).toBe("ADND2E.weaponCategories.bow");
    expect(choiceLabelKey("system.size", "M")).toBe("ADND2E.weaponSizes.M");
  });
  it("returns null for any unmapped path", () => {
    expect(choiceLabelKey("system.casterClass", "wizard")).toBeNull();
    expect(choiceLabelKey("name", "x")).toBeNull();
  });
});

describe("label map copy", () => {
  const cases: [string, readonly string[]][] = [
    ["armorTypes", ARMOR_TYPES], ["weaponDamageTypes", DAMAGE_TYPES],
    ["weaponCategories", WEAPON_CATEGORIES], ["weaponSizes", WEAPON_SIZES],
  ];
  for (const [map, values] of cases) {
    it(`${map} has an en.json label for every enum value`, () => {
      expect(Object.values(CHOICE_LABEL_MAPS)).toContain(map);
      for (const v of values) expect(LANG.ADND2E[map]?.[v], `${map}.${v}`).toBeTruthy();
    });
  }
});
```

In `tests/config/build-config.test.ts`: add `"armorTypes", "weaponCategories", "weaponDamageTypes", "weaponSizes"` to the expected-keys list near line 16 (keep it sorted the way the file does) and add `assertLabelMap(cfg.armorTypes); assertLabelMap(cfg.weaponDamageTypes); assertLabelMap(cfg.weaponCategories); assertLabelMap(cfg.weaponSizes);` beside the existing `assertLabelMap(cfg.damageTypes);` (~line 84).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/sheets/item-layouts/labels.test.ts tests/config`
Expected: FAIL.

- [ ] **Step 3: Implement the pure lookup**

Create `src/sheets/item-layouts/labels.ts`:

```ts
// Which item-sheet choice fields have a label map (#111). Pure: the sheet engine resolves the key against the
// localization table and falls back to the raw value when the key does not exist.

/** document path of an item enum field -> the CONFIG.ADND2E / lang map holding its labels */
export const CHOICE_LABEL_MAPS: Readonly<Record<string, string>> = {
  "system.armorType": "armorTypes",
  "system.damageType": "weaponDamageTypes",
  "system.category": "weaponCategories",
  "system.size": "weaponSizes",
};

/** The localization key for `value` of the field at `path`, or null when the field has no label map. */
export function choiceLabelKey(path: string, value: string): string | null {
  const map = CHOICE_LABEL_MAPS[path];
  return map ? `ADND2E.${map}.${value}` : null;
}
```

- [ ] **Step 4: Config maps and copy**

In `src/config.ts`: add four members to the config interface (beside `damageTypes`): `readonly armorTypes: LabelMap<ArmorType>; readonly weaponDamageTypes: LabelMap<DamageType>; readonly weaponCategories: LabelMap<WeaponCategory>; readonly weaponSizes: LabelMap<WeaponSize>;` (import those types from where `ARMOR_TYPES`/`DAMAGE_TYPES` etc. get their types — `src/core/types` or `src/data/item/choices`; follow how `config.ts` already imports `ConfigDamageType`). In the builder, after the `damageTypes: { … }` literal, add four literals whose values are exactly `ADND2E.<mapName>.<value>` for every value, e.g.:

```ts
    weaponDamageTypes: {
      slashing: "ADND2E.weaponDamageTypes.slashing",
      piercing: "ADND2E.weaponDamageTypes.piercing",
      bludgeoning: "ADND2E.weaponDamageTypes.bludgeoning",
      "piercing-slashing": "ADND2E.weaponDamageTypes.piercing-slashing",
      "piercing-bludgeoning": "ADND2E.weaponDamageTypes.piercing-bludgeoning",
    },
    weaponCategories: {
      melee: "ADND2E.weaponCategories.melee", thrown: "ADND2E.weaponCategories.thrown",
      bow: "ADND2E.weaponCategories.bow", crossbow: "ADND2E.weaponCategories.crossbow",
    },
    weaponSizes: { S: "ADND2E.weaponSizes.S", M: "ADND2E.weaponSizes.M", L: "ADND2E.weaponSizes.L" },
    armorTypes: {
      none: "ADND2E.armorTypes.none", padded: "ADND2E.armorTypes.padded", leather: "ADND2E.armorTypes.leather",
      "studded-leather": "ADND2E.armorTypes.studded-leather", "ring-mail": "ADND2E.armorTypes.ring-mail",
      "scale-mail": "ADND2E.armorTypes.scale-mail", "chain-mail": "ADND2E.armorTypes.chain-mail",
      "elven-chain": "ADND2E.armorTypes.elven-chain", "splint-mail": "ADND2E.armorTypes.splint-mail",
      "banded-mail": "ADND2E.armorTypes.banded-mail", "plate-mail": "ADND2E.armorTypes.plate-mail",
      "field-plate": "ADND2E.armorTypes.field-plate", "full-plate": "ADND2E.armorTypes.full-plate",
    },
```

In `lang/en.json`, beside the existing `ADND2E.damageTypes` object (~line 100), add:

```json
    "weaponDamageTypes": {
      "slashing": "Slashing", "piercing": "Piercing", "bludgeoning": "Bludgeoning",
      "piercing-slashing": "Piercing / Slashing", "piercing-bludgeoning": "Piercing / Bludgeoning"
    },
    "weaponCategories": { "melee": "Melee", "thrown": "Thrown", "bow": "Bow", "crossbow": "Crossbow" },
    "weaponSizes": { "S": "Small", "M": "Medium", "L": "Large" },
    "armorTypes": {
      "none": "No armor", "padded": "Padded", "leather": "Leather", "studded-leather": "Studded leather",
      "ring-mail": "Ring mail", "scale-mail": "Scale mail", "chain-mail": "Chain mail", "elven-chain": "Elven chain",
      "splint-mail": "Splint mail", "banded-mail": "Banded mail", "plate-mail": "Plate mail",
      "field-plate": "Field plate", "full-plate": "Full plate"
    },
```

Check there is no existing `weaponSizes` / `weaponCategories` / `armorTypes` key (grep `lang/en.json` and `src/config.ts`) before adding; if `tests/lang/en-coverage.test.ts` asserts every config label key exists in en.json, these additions satisfy it.

- [ ] **Step 5: The Handlebars helper and `toChoiceRows`**

In `src/sheets/handlebars.ts`, after the `adnd2eOrDash` helper registration, add:

```ts
  // #111: a localized label for an enum value from CONFIG.ADND2E's label maps (armorTypes, weaponDamageTypes, …), else the raw value
  Handlebars.registerHelper("adnd2eLabel", (map: unknown, value: unknown) => {
    if (value === null || value === undefined || value === "") return "";
    const key = `ADND2E.${String(map)}.${String(value)}`;
    return game.i18n!.has(key) ? game.i18n!.localize(key) : String(value);
  });
```
(Use whatever local alias/`Handlebars` reference the neighbouring helpers use. If `game` is typed unavailable in this file, use `(globalThis as unknown as { game: Game }).game`.)

In `src/sheets/raw-field-sheet.ts`: import `choiceLabelKey` from `./item-layouts/labels`; give `toChoiceRows` a third parameter `path?: string` and, when mapping each `[value, label]` entry, replace `label` with `labelFor(path, value, label)` where:

```ts
/** A localized label for an enum value when the field has a label map and the key exists; else the entry's own label. */
function labelFor(path: string | undefined, value: string, fallback: string): string {
  const key = path ? choiceLabelKey(path, value) : null;
  return key && game.i18n!.has(key) ? game.i18n!.localize(key) : fallback;
}
```
Pass `path` at the `StringField` call in `walk` (`toChoiceRows(choices, value, path)`); the multiselect call keeps its two-argument form (spell schools/spheres are not mapped).

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run tests/sheets/item-layouts tests/config tests/lang && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add src/config.ts lang/en.json src/sheets/item-layouts/labels.ts tests/sheets/item-layouts/labels.test.ts tests/config/build-config.test.ts src/sheets/handlebars.ts src/sheets/raw-field-sheet.ts
git commit -m "feat(item-sheets): label maps for armor and weapon enums (#111)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Render the layouts (partials, strip, spell card, styles)

**Files:**
- Create: `templates/sheets/raw-field-row.hbs` (extracted row markup)
- Create: `templates/sheets/raw-group.hbs` (extracted panel markup)
- Modify: `templates/sheets/raw-fields.hbs`
- Modify: `src/sheets/handlebars.ts` (register the two partials — add both to the partial path list, and make sure they register under the names `adnd2e.raw-field-row` and `adnd2e.raw-group`; read how the existing names like `adnd2e.item-controls` are derived from the paths)
- Modify: `src/sheets/raw-field-sheet.ts` (export the helpers the proof needs; `_prepareContext` uses `applyLayout`)
- Modify: `styles/kit/_kit.scss`

**Interfaces:**
- Consumes: Task 1 `applyLayout`/`LayoutResult`; Task 2 `ITEM_LAYOUTS`; Task 3 labels (already inside `toChoiceRows`).
- Produces: sheet template context keys `strip` (array of `{ row, display }`), `leading` (panels before the description), `groups` (the panels after it — same name as today so non-layout types are unchanged), and the partials `adnd2e.raw-field-row` (context = a row) and `adnd2e.raw-group` (context = a panel).

This task is Foundry glue; it is verified by typecheck/lint/the existing suite and, in Task 6, a real-template headless render and the manual checklist. Read `templates/sheets/raw-fields.hbs`, `src/sheets/raw-field-sheet.ts` (`_prepareContext`, `groupFieldRows`) and `styles/kit/_kit.scss` (the item-sheet block near line 164) in full first.

- [ ] **Step 1: Extract the row partial (behavior-preserving)**

Move the body of the inner `{{#each this.rows}}…{{/each}}` loop's non-nullcheck, non-header branch — the `<div class="form-group" …>` block through its closing `</div>` — verbatim into `templates/sheets/raw-field-row.hbs`, and replace it in `raw-fields.hbs` with `{{> adnd2e.raw-field-row this}}`. Keep the nullcheck (`<h3 class="raw-field-header">… Set …`) and header (`<h3 …>{{this.label}}</h3>`) branches inline in the panel markup (they belong to panel flow, not to a single field). Register the new partial. Confirm the sheet still renders unchanged for a non-layout type (the template output for a `race` item must be identical; the Task 6 headless render checks this).

- [ ] **Step 2: Extract the panel partial and add the strip/leading/trailing structure**

Move the whole `<section class="kit-panel raw-group">…</section>` (the body of `{{#each groups}}`) verbatim into `templates/sheets/raw-group.hbs`, changing only its root to `<section class="kit-panel raw-group cols-{{#if this.columns}}{{this.columns}}{{else}}1{{/if}}">` and its title block so a panel with a `titleKey` and no toggle shows `{{localize this.titleKey}}` (this already works via the existing `{{#if this.isHeader}}{{#if this.titleKey}}…` branch). Then restructure `raw-fields.hbs` after the header panel as:

```hbs
    {{#if strip.length}}
      <section class="kit-panel raw-strip">
        <div class="kit-body raw-strip-body">
          {{#each strip}}
            <div class="raw-strip-item display-{{this.display}}">
              {{> adnd2e.raw-field-row this.row}}
              {{#if (eq this.display "chips")}}
                <span class="raw-chips">{{#each this.row.choices}}{{#if this.selected}}<span class="chip">{{this.label}}</span>{{/if}}{{/each}}</span>
              {{/if}}
            </div>
          {{/each}}
        </div>
      </section>
    {{/if}}

    {{#if leading.length}}
      <div class="raw-groups">{{#each leading}}{{> adnd2e.raw-group this}}{{/each}}</div>
    {{/if}}

    {{#if description}}
      (the existing description panel, unchanged)
    {{/if}}

    <div class="raw-groups">
      {{#each groups}}{{> adnd2e.raw-group this}}{{/each}}
    </div>
```
For types without a layout, `strip` and `leading` are empty, so the page is exactly today's.

- [ ] **Step 3: Use the engine in `_prepareContext`**

In `src/sheets/raw-field-sheet.ts`:
1. Export `buildFieldRows` and `groupFieldRows` and the `FieldRow` type (add the `export` keyword; no behavior change) so the headless proof can import them.
2. Add `import { applyLayout } from "./item-layouts/apply"; import { ITEM_LAYOUTS } from "./item-layouts/layouts";`.
3. Replace the grouping in `_prepareContext` with:

```ts
      const rows = buildFieldRows(this.document, source);
      const grouped = groupFieldRows(rows);
      const itemType = this.document.documentName === "Item" ? (this.document as unknown as { type: string }).type : undefined;
      const layout = itemType ? ITEM_LAYOUTS[itemType] : undefined;
      context.header = grouped.header;
      context.description = grouped.description;
      if (layout) {
        const laid = applyLayout(rows.filter((r) => r.indent > 0 && r.path !== DESCRIPTION_PATH), layout);
        if (laid.unknownPaths.length) {
          console.warn(`adnd2e | item layout for "${itemType}" names fields that do not exist:`, laid.unknownPaths);
        }
        context.strip = laid.strip;
        context.leading = laid.leading;
        context.groups = laid.trailing;
      } else {
        context.strip = [];
        context.leading = [];
        context.groups = grouped.groups;
      }
```
Keep the existing `context.subtitle` assignment. `DESCRIPTION_PATH` already exists in this file.

- [ ] **Step 4: Styles**

In `styles/kit/_kit.scss`, inside the item-sheet block (`.adnd2e.raw-field-sheet.item { … }`, after the `.raw-groups` rules), add — using the kit's existing tokens (`--kit-row-rule`, `--kit-muted`, `--kit-accent-ink`, and whichever accent/background tokens the neighbouring rules use; read `styles/theme/_tokens.scss` for the available names and use only those):

```scss
  // panel columns: a panel body laid out as a 1-3 column grid
  .raw-group.cols-2 .kit-body { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 12px; }
  .raw-group.cols-3 .kit-body { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 12px; }
  .raw-group.cols-2 .raw-field-header, .raw-group.cols-3 .raw-field-header { grid-column: 1 / -1; }

  // the stat strip under the title (gear) / the spell card header (spell)
  .raw-strip .raw-strip-body { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 4px 12px; }
  .raw-strip-item { display: flex; flex-direction: column; min-width: 70px; }
  .raw-strip-item .form-group { margin: 0; }
  .raw-strip-item .form-group label { font-size: 10px; text-transform: uppercase; color: var(--kit-muted); }

  // spell card: level badge, chips for the selected schools/spheres, V/S/M pills that light up when checked
  .raw-strip-item.display-badge .form-group label { text-align: center; }
  .raw-strip-item.display-badge input { width: 3.2em; text-align: center; font-size: 20px; font-weight: 700; }
  .raw-chips { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px; }
  .raw-chips .chip { font-size: 11px; padding: 0 6px; border: 1px solid var(--kit-row-rule); border-radius: 9px; color: var(--kit-accent-ink); }
  .raw-strip-item.display-pill { min-width: 0; }
  .raw-strip-item.display-pill .form-group { display: flex; align-items: center; gap: 4px; padding: 0 8px; border: 1px solid var(--kit-row-rule); border-radius: 12px; opacity: .55; }
  .raw-strip-item.display-pill .form-group:has(input:checked) { opacity: 1; border-color: var(--kit-accent-ink); color: var(--kit-accent-ink); font-weight: 700; }
  .raw-strip-item.display-pill .form-group label { font-size: 12px; text-transform: none; color: inherit; }
```
If `:has()` selectors are not used elsewhere in the SCSS, keep them anyway (Foundry v14's Chromium supports them) but add no vendor prefixes.

- [ ] **Step 5: Verify and commit**

Run: `npm run typecheck && npm run lint && npx vitest run` and then `npx vite build` (compiles the SCSS; there is no `build:css` script).
Expected: all green; the build succeeds.

```bash
git add templates/sheets/raw-field-row.hbs templates/sheets/raw-group.hbs templates/sheets/raw-fields.hbs src/sheets/handlebars.ts src/sheets/raw-field-sheet.ts styles/kit/_kit.scss
git commit -m "feat(item-sheets): render per-type layouts, stat strip and spell card (#110)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Labels and prose descriptions in the actor-sheet row summaries

**Files:**
- Modify: `templates/actor/pc/partials/pc-item-table.hbs` (the `.kit-summary` block)
- Modify: `src/sheets/character/context-types.ts` (`PhysicalItemView`, ~line 293)
- Modify: `src/sheets/character/sheet.ts` (`toPhysicalView` ~line 166; `_prepareContext`; `#buildInput`)
- Modify: `src/sheets/npc/sheet.ts` (its `_prepareContext`/`#buildInput` ~line 236-260)
- Create: `src/sheets/item-descriptions.ts`
- Modify: `styles/kit/_kit.scss` (a `.kit-description` rule)
- Test: `tests/templates/item-row-summary.test.ts` (new) and any existing fixtures that construct a `PhysicalItemView` (found by typecheck)

**Interfaces:**
- Consumes: Task 3 helper `adnd2eLabel`.
- Produces:
  - `PhysicalItemView.descriptionHtml: string` (required; `""` when none).
  - `toPhysicalView(it: RawItem, descriptions?: ReadonlyMap<string, string>): PhysicalItemView` — sets `descriptionHtml` from the map.
  - `enrichItemDescriptions(items: Iterable<{ id: string; isOwner?: boolean; system: unknown }>): Promise<Map<string, string>>` in `src/sheets/item-descriptions.ts`.

- [ ] **Step 1: Write the failing template test**

Create `tests/templates/item-row-summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const TABLE = readFileSync(path.resolve(__dirname, "..", "..", "templates", "actor", "pc", "partials", "pc-item-table.hbs"), "utf8");

describe("inventory row summary (#111)", () => {
  it("labels category, damage type and armor type through adnd2eLabel instead of printing raw values", () => {
    expect(TABLE).toContain("adnd2eLabel 'weaponCategories' r.item.weapon.category");
    expect(TABLE).toContain("adnd2eLabel 'weaponDamageTypes' r.item.weapon.damageType");
    expect(TABLE).toContain("adnd2eLabel 'armorTypes' r.item.armor.armorType");
    expect(TABLE).not.toMatch(/\}\} *r\.item\.weapon\.category|:<\/span> \{\{r\.item\.weapon\.category\}\}/);
    expect(TABLE).not.toContain("{{r.item.armor.armorType}}");
  });
  it("shows the enriched description under the stats", () => {
    expect(TABLE).toContain("{{{r.item.descriptionHtml}}}");
    expect(TABLE).toContain('class="kit-description"');
  });
});
```

Run: `npx vitest run tests/templates/item-row-summary.test.ts` → FAIL.

- [ ] **Step 2: Template, view type, and the enrichment glue**

In `pc-item-table.hbs`'s `.kit-summary`: replace `{{r.item.weapon.category}}` with `{{adnd2eLabel 'weaponCategories' r.item.weapon.category}}`, `{{r.item.weapon.damageType}}` with `{{adnd2eLabel 'weaponDamageTypes' r.item.weapon.damageType}}`, `{{r.item.armor.armorType}}` with `{{adnd2eLabel 'armorTypes' r.item.armor.armorType}}`; and append, as the last child inside `.kit-summary`:

```hbs
          {{#if r.item.descriptionHtml}}<div class="kit-description">{{{r.item.descriptionHtml}}}</div>{{/if}}
```

In `context-types.ts` add `descriptionHtml: string;` to `PhysicalItemView` (after `magicBonus`).

Create `src/sheets/item-descriptions.ts`:

```ts
// Enriched item descriptions for the actor sheets' inventory row summaries (#111). Foundry-coupled (async text
// enrichment, which sanitizes the stored HTML); dev-world verified.
interface DescribedItem {
  id: string;
  isOwner?: boolean;
  system: unknown;
}

/** item id -> sanitized, enriched description HTML, for every item that has a non-blank description. */
export async function enrichItemDescriptions(items: Iterable<DescribedItem>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const editor = (foundry.applications.ux as unknown as {
    TextEditor: { implementation: { enrichHTML(html: string, options: Record<string, unknown>): Promise<string> } };
  }).TextEditor.implementation;
  for (const item of items) {
    const raw = String((item.system as { description?: unknown }).description ?? "").trim();
    if (!raw) continue;
    out.set(item.id, await editor.enrichHTML(raw, { secrets: item.isOwner === true, relativeTo: item }));
  }
  return out;
}
```
Verify `foundry.applications.ux.TextEditor.implementation.enrichHTML` against `C:/Program Files/Foundry Virtual Tabletop/resources/app/client/applications/ux/text-editor.mjs` (v14); if the namespace differs, use the one the core sheets use (see `client/applications/sheets/base-sheet.mjs:40`).

- [ ] **Step 3: Thread it through the sheets**

In `src/sheets/character/sheet.ts`: change `toPhysicalView(it: RawItem)` to `toPhysicalView(it: RawItem, descriptions?: ReadonlyMap<string, string>)` and add `descriptionHtml: descriptions?.get(it.id) ?? "",` to the `view` object literal. Add a private field `#descriptions: ReadonlyMap<string, string> = new Map();`; in `_prepareContext`, before `buildCharacterSheetContext(this.#buildInput())`, set `this.#descriptions = await enrichItemDescriptions(physicalItemDocs)` where `physicalItemDocs` is the actor's items of types `weapon`, `armor`, `equipment`, `ammo` (`[...this.document.items].filter(...)`); and pass `this.#descriptions` into both `toPhysicalView(...)` calls in `#buildInput` (the PC sheet's ~line 562 call, and any other). Make the same change in `src/sheets/npc/sheet.ts` (its `toPhysicalView(it)` at ~line 260 and its own `#descriptions`). Import `enrichItemDescriptions` from `../item-descriptions`.

Run `npm run typecheck`; every existing fixture that builds a `PhysicalItemView` literal will now fail on the missing `descriptionHtml` — add `descriptionHtml: ""` to each (do not make the field optional).

- [ ] **Step 4: Style, verify, commit**

In `styles/kit/_kit.scss` (the actor-sheet kit block that already styles `.kit-summary`; find it with grep), add:

```scss
  .kit-summary .kit-description { flex-basis: 100%; margin-top: 4px; font-size: 12px; color: var(--kit-muted); }
  .kit-summary .kit-description p { margin: 0 0 4px; }
```

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all green.

```bash
git add templates/actor/pc/partials/pc-item-table.hbs src/sheets/character/context-types.ts src/sheets/character/sheet.ts src/sheets/npc/sheet.ts src/sheets/item-descriptions.ts styles/kit/_kit.scss tests
git commit -m "feat(item-sheets): label maps and prose descriptions in inventory row summaries (#111)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Gates, layout census and real-template proof, checklist

**Files:**
- Scratch (git-ignored, do NOT commit): `.superpowers/proof/item-layouts.proof.ts`
- Modify: `README.md` only if it states item sheets are an undifferentiated raw editor (`grep -n -i "raw-field\|item sheet" README.md`); otherwise skip.

- [ ] **Step 1: Full CI sequence**

Run: `npm run lint && npm run typecheck && npm run test:coverage`
Expected: green; 100% statement coverage.

- [ ] **Step 2: Layout census and real-template render (headless proof)**

Recipe: memory note `foundry-headless-proof-harness` (load real Foundry `common/server.mjs`, set `globalThis.foundry` and stub `game.i18n` (`localize`, `format`, `has` backed by `lang/en.json`) / `ui` / `logger`, then dynamically import repo `src/**`). Write `.superpowers/proof/item-layouts.proof.ts` and run it with the proof vitest config. Prove, using the REAL data models and a REAL Handlebars render of `templates/sheets/raw-fields.hbs` (register the two partials and `localize`/`eq`/`adnd2eLabel`/`checked` helpers as the real sheet does):
1. **Census:** for each of weapon, armor, equipment, ammo, spell, build a document-like object whose `system.schema` is the real model's schema, run the exported `buildFieldRows` + `applyLayout(…, ITEM_LAYOUTS[type])`, and assert `unknownPaths` is empty and every `system.*` row appears exactly once across strip + panels + Other.
2. **No orphan Other:** report which fields (if any) fall into Other for each type — expected: only fields intentionally unlisted; list them in the report.
3. **Round-trip safety:** the rendered form for each type contains an input/select/textarea with `name="<path>"` for every row (nothing lost), and the weapon's nullable `range` group still renders its `data-null-toggle` and `data-null-group` rows.
4. **Spell card:** the rendered spell page has a `raw-strip` with a badge for level, chips containing the selected schools/spheres labels, and three pill inputs `system.components.v/s/m`, and the description appears after the Casting panel.
5. **Non-layout type unchanged:** a `race` item still renders through the plain grouped path (no strip, description first).
6. **Labels:** a weapon's `damageType` select shows "Piercing / Slashing" for `piercing-slashing`, and an armor's `armorType` shows "Chain mail".
Report what was proven and what was not (real clicks, visual styling, the non-GM seat, enrichment of a real description).

- [ ] **Step 3: README (only if needed) and commit**

If Step 2's grep found an outdated statement, update it and commit `docs: item sheet layouts (#110, #111)`; otherwise no commit.

- [ ] **Step 4: Manual dev-world checklist (the controller hands this to the user)**

Prerequisites: Foundry closed, `npm run build`, relaunch. A world with a PC owning a weapon (set a bow's `ammoType`), a piece of armor and a shield, an equipment container with charges, an ammo stack, and a spell with schools, spheres and V/S material set plus a prose description; give the weapon, armor and spell a text description. A second item owned by someone else (or a Limited/Observer permission). A non-GM player seat owning the PC. Reset any setting you change.
1. Open each of the five item types: weapon shows a stat strip (category, damage S-M / L, damage type, speed) then Combat / Range / Proficiency / Ammunition / Physical panels; armor shows base AC / type / shield in the strip then Protection / Penalties / Physical; equipment shows Details / Charges / Container / Physical; ammo shows its strip and Physical.
2. Change a value in each, Save, close and reopen: it persisted. Toggle the weapon's `range` "Set" box off and on: its short/medium/long rows hide and show.
3. Spell: the header shows the level badge, caster class, school and sphere chips (after Save), and V / S / M pills that light up for the components that are checked. The prose description sits directly under the Casting panel, not at the top.
4. Armor type and weapon damage type selects show labels ("Chain mail", "Piercing / Slashing"), not `chain-mail` / `piercing-slashing`.
5. Any field not placed by a layout appears under "Other" (none expected, but check).
6. Open a class, race and kit item: they look exactly as before (generic panels, description at top).
7. On the PC's Inventory tab, click a weapon, armor and an item with a description: the expanded row shows labelled category / damage type / armor type and the item's prose description under the stats; an item without a description shows none.
8. From the non-GM seat: repeat 1, 3, 7 on an owned item (works), and open the not-owned item: the layout renders read-only (no editing).
9. The Monster NPC sheet's gear section is out of scope and unchanged.
```

---

## Self-Review

- **Spec coverage:** §1 `applyLayout` + specs + Other panel + orphan-heading rule → Task 1 (and Global Constraints); §2 the five layouts + shared Physical panel → Task 2; §3 spell card (badge, chips, pills, description under Casting) → Tasks 2 (`descriptionAfterPanel`, strip hints) and 4 (render, styles); §4 label maps in select options and row summaries → Tasks 3 and 5; §5 prose descriptions in row summaries with enrichment → Task 5; §6 out of scope respected; Testing: unit tests (Tasks 1-3, 5), census and real-template render (Task 6, headless), lang/config tests (Task 3), gates and manual checklist (Task 6).
- **Spec deviation:** the spec put `magicBonus` in Combat/Protection; the plan keeps it in the shared Physical panel because it lives in `physicalItemSchema()` for all gear (Task 2 note). The census (Task 6) still guarantees every field is placed exactly once.
- **Foundry-coupled code:** Task 4's template/sheet changes and Task 5's enrichment are outside the coverage gate; they are covered by typecheck, the real-template headless render (Task 6) and the manual checklist.
- **Placeholder scan:** none. Task 3/4/5 name exact files and give the code; where a step says "follow the neighbouring pattern" (config literal placement, partial registration names, SCSS tokens, fixture fixes) it points at the exact adjacent code to read first.
- **Type consistency:** `ItemLayout`/`LayoutResult`/`StripItem` (Task 1) match their use in Tasks 2 and 4; the context keys `strip`, `leading`, `groups`; `choiceLabelKey`/`CHOICE_LABEL_MAPS` (Task 3); `adnd2eLabel` (Tasks 3, 5); `descriptionHtml`, `toPhysicalView(it, descriptions?)`, `enrichItemDescriptions` (Task 5).
