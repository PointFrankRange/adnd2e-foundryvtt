# SP18 Plan D - Style Weapons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A character can buy a style's weapon tight groups (1 slot each), and armed martial arts maneuvers use them: per-maneuver "Weapons Allowed" hints, the book's +2 weapon bonuses, and Weapon Breaker needing a style weapon.

**Architecture:** Two pure modules (`weapon-groups.ts`, `weapon-use.ts`) in `src/core/martial-arts/`, a new `knownWeaponGroups` field on the `martialStyle` item shaped like `knownManeuvers`, view rows, Features Learn/Unlearn, Main display, and glue in `martial-arts-actions.ts`. Damage is never replaced by weapon dice.

**Tech Stack:** TypeScript, Foundry v14 DataModels, Handlebars, SCSS, vitest (100% statement coverage gate on `src/core/**`).

**Spec:** `docs/superpowers/specs/2026-10-14-adnd2e-sp18d-style-weapons-design.md`

## Global Constraints

- `src/core/**` is pure (no Foundry globals) and keeps 100% statement coverage; `npm run typecheck` includes `tsconfig.core.json`.
- Plain ASCII in comments; keep `lang/en.json` valid JSON; labels must not end in an ellipsis.
- Repo files are CRLF on Windows: use the Edit tool and preserve line endings. README is CRLF too (touch only the SP18 row).
- Never run `npm run build` while Foundry is running; check builds with `npx vite build --outDir <scratchpad>/dist-check --emptyOutDir`.
- Run vitest through the PowerShell tool (Windows path) if Git Bash fails every file.
- New dialogs use `themedPrompt`/`themedConfirm`. Weapon damage is never replaced by the weapon's dice.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 1: Weapon group registry (pure)

**Files:**
- Create: `src/core/martial-arts/weapon-groups.ts`
- Modify: `src/core/martial-arts/index.ts` (add `export * from "./weapon-groups";`)
- Test: `tests/core/martial-arts/weapon-groups.test.ts`

**Interfaces:**
- Produces: `WEAPON_GROUPS: readonly WeaponGroupDef[]` (`{ id, label, members }`), `WEAPON_GROUP_IDS: readonly string[]`, `normalizeWeaponName(raw): string`, `weaponGroupIdsFor(...names: string[]): string[]`, `offeredGroupIds(weaponGroups: readonly string[]): string[]`, `weaponGroupLabelKey(id): string` (`ADND2E.martialWeaponGroups.<id>`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { WEAPON_GROUPS, WEAPON_GROUP_IDS, normalizeWeaponName, offeredGroupIds, weaponGroupIdsFor, weaponGroupLabelKey } from "../../../src/core/martial-arts";

describe("normalizeWeaponName", () => {
  it("lowercases, strips magic bonuses, punctuation and parentheses", () => {
    expect(normalizeWeaponName("Katana +1")).toBe("katana");
    expect(normalizeWeaponName("Long Sword, +2 (flaming)")).toBe("long sword");
    expect(normalizeWeaponName("Footman's Mace")).toBe("footmans mace");
    expect(normalizeWeaponName("Main-gauche")).toBe("main gauche");
  });
});

describe("weaponGroupIdsFor", () => {
  it("finds every group a weapon belongs to (overlaps allowed)", () => {
    expect(weaponGroupIdsFor("Dagger")).toEqual(["fencingBlades", "shortBlades"]);
    expect(weaponGroupIdsFor("Katana +1")).toEqual(["mediumBlades", "orientalBlades"]);
    expect(weaponGroupIdsFor("Sai")).toEqual(["karateWeapons"]);
  });
  it("tries each name given (base name first) and returns nothing for unknown weapons", () => {
    expect(weaponGroupIdsFor("Sword of Doom", "Long Sword")).toEqual(["mediumBlades"]);
    expect(weaponGroupIdsFor("Lasso")).toEqual([]);
    expect(weaponGroupIdsFor("")).toEqual([]);
  });
});

describe("offeredGroupIds", () => {
  it("maps the shipped style names to ids and drops unknown names", () => {
    expect(offeredGroupIds(["Staves", "Fencing Blades", "Oriental Blades", "Medium Blades"])).toEqual(["fencingBlades", "mediumBlades", "orientalBlades", "staves"]);
    expect(offeredGroupIds(["Nonsense"])).toEqual([]);
  });
  it("'Any Tight Group of Melee Weapons' offers every group", () => {
    expect(offeredGroupIds(["Any Tight Group of Melee Weapons"])).toEqual([...WEAPON_GROUP_IDS]);
  });
});

describe("registry shape", () => {
  it("has unique ids and non-empty members, and a label key per id", () => {
    expect(new Set(WEAPON_GROUPS.map((g) => g.id)).size).toBe(WEAPON_GROUPS.length);
    for (const g of WEAPON_GROUPS) expect(g.members.length, g.id).toBeGreaterThan(0);
    expect(weaponGroupLabelKey("staves")).toBe("ADND2E.martialWeaponGroups.staves");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/martial-arts/weapon-groups.test.ts`
Expected: FAIL (exports missing).

- [ ] **Step 3: Implement**

```ts
// PHBR15 Table 13 (pp.32-33): the melee tight groups. Pure. Missile and throwing groups are not melee style weapons and are omitted.
// Weapons the book marks "not part of a tight group" (lasso, net, gunsen, siangkam, dart, tetsu-bishi) are omitted.

export interface WeaponGroupDef {
  id: string;
  /** the English name as written on the shipped styles' `weaponGroups` */
  label: string;
  /** normalized weapon names (slash-separated book entries are listed as separate names) */
  members: readonly string[];
}

export const WEAPON_GROUPS: readonly WeaponGroupDef[] = [
  { id: "fencingBlades", label: "Fencing Blades", members: ["dagger", "dirk", "knife", "stiletto", "main gauche", "rapier", "sabre"] },
  { id: "longBlades", label: "Long Blades", members: ["bastard sword", "no daichi", "tetsu to", "two handed sword"] },
  { id: "mediumBlades", label: "Medium Blades", members: ["broad sword", "cutlass", "katana", "bokken", "khopesh", "long sword", "ninja to", "scimitar"] },
  { id: "orientalBlades", label: "Oriental Blades", members: ["katana", "bokken", "ninja to", "no daichi", "tetsu to", "tanto", "yoroi toshi", "wakizashi"] },
  {
    id: "shortBlades",
    label: "Short Blades",
    members: ["chopsticks", "dagger", "dirk", "gaff", "hook", "knife", "stiletto", "main gauche", "parang", "short sword", "shuriken", "nekode", "tanto", "yoroi toshi", "wakizashi"],
  },
  { id: "chainWeapons", label: "Chain Weapons", members: ["kau sin ke", "kusarigama", "manriki gusari", "three section staff"] },
  { id: "lashWeapons", label: "Lash Weapons", members: ["scourge", "whip"] },
  { id: "ropeWeapons", label: "Rope Weapons", members: ["bola", "kawanaga", "kyogetsu shogi"] },
  { id: "axes", label: "Axes", members: ["battle axe", "hand axe", "throwing axe"] },
  {
    id: "clubbingWeapons",
    label: "Clubbing Weapons",
    members: ["club", "footmans mace", "hanbo", "horsemans mace", "jo", "kiseru", "morning star", "tonfa", "war hammer"],
  },
  { id: "flails", label: "Flails", members: ["footmans flail", "horsemans flail"] },
  { id: "karateWeapons", label: "Karate Weapons", members: ["kama", "nunchaku", "quarterstaff", "bo", "sai", "jitte", "tonfa"] },
  { id: "picks", label: "Picks", members: ["fang", "footmans pick", "horsemans pick"] },
  { id: "sickles", label: "Sickles", members: ["kama", "sickle", "scythe"] },
  { id: "staves", label: "Staves", members: ["kumade", "lajatang", "quarterstaff", "bo", "tetsu bo"] },
  {
    id: "bladedPoles",
    label: "Bladed Poles",
    members: [
      "bardiche", "bec de corbin", "bill guisarme", "fauchard", "fauchard fork", "glaive", "glaive guisarme", "guisarme", "guisarme voulge", "halberd",
      "hook fauchard", "lajatang", "lucern hammer", "man catcher", "military fork", "nagimaki", "naginata", "partisan", "ranseur", "sang kauw", "sode garami",
    ],
  },
  { id: "poleSpears", label: "Pole Spears", members: ["spetum", "trident", "voulge"] },
  { id: "lances", label: "Lances", members: ["heavy horse lance", "light horse lance", "jousting lance", "medium horse lance"] },
  { id: "spears", label: "Spears", members: ["awl pike", "chijiriki", "harpoon", "javelin", "long spear", "shakujo yari", "spear", "trident", "uchi ne"] },
];

export const WEAPON_GROUP_IDS: readonly string[] = WEAPON_GROUPS.map((g) => g.id);

const ANY_MELEE = "any tight group of melee weapons";

/** Lowercase, drop parentheses and magic bonuses, turn punctuation into spaces and drop apostrophes. */
export function normalizeWeaponName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[+-]\s*\d+/g, " ")
    .replace(/'/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The tight groups containing a weapon; each given name is tried (put the base weapon name first). */
export function weaponGroupIdsFor(...names: string[]): string[] {
  const wanted = names.map(normalizeWeaponName).filter((n) => n !== "");
  const out: string[] = [];
  for (const g of WEAPON_GROUPS) if (wanted.some((n) => g.members.includes(n))) out.push(g.id);
  return out;
}

/** A style's offered tight-group ids from its `weaponGroups` names (registry order, unknown names dropped). */
export function offeredGroupIds(weaponGroups: readonly string[]): string[] {
  const names = weaponGroups.map((n) => n.trim().toLowerCase());
  if (names.includes(ANY_MELEE)) return [...WEAPON_GROUP_IDS];
  return WEAPON_GROUPS.filter((g) => names.includes(g.label.toLowerCase())).map((g) => g.id);
}

export const weaponGroupLabelKey = (id: string): string => `ADND2E.martialWeaponGroups.${id}`;
```

Add `export * from "./weapon-groups";` to `src/core/martial-arts/index.ts`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/martial-arts/weapon-groups.test.ts` then `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/martial-arts/weapon-groups.ts src/core/martial-arts/index.ts tests/core/martial-arts/weapon-groups.test.ts
git commit -m "feat(martial-arts): Table 13 melee weapon group registry (SP18 Plan D)"
```

---

### Task 2: Buying groups - data field, learn rules, view rows

**Files:**
- Modify: `src/data/item/martial-style.ts`, `src/core/martial-arts/style.ts` (`freshStyleUpdate`), `src/core/martial-arts/maneuvers.ts` (`learnability` cap), `src/core/martial-arts/weapon-groups.ts` (learn/unlearn), `src/core/martial-arts/view.ts`
- Test: `tests/core/martial-arts/weapon-groups.test.ts`, `tests/core/martial-arts/style.test.ts`, `tests/core/martial-arts/maneuvers.test.ts`, `tests/core/martial-arts/maneuver-view.test.ts`

**Interfaces:**
- Consumes: Task 1 `offeredGroupIds`, `weaponGroupLabelKey`; `MAX_MANEUVERS_PER_LEVEL` and `LearnVerdict` from `maneuvers.ts`.
- Produces: `groupLearnability(input): LearnVerdict`, `unlearnGroupUpdate(input)`, `learnability` accepts optional `groupsAtLevel?: number`; `StyleRow.weaponGroups: WeaponGroupRow[]` (`{ id, labelKey, state: "known"|"learnable"|"locked", reasonKey }`) and `StyleRow.knownWeaponGroups: WeaponGroupRow[]`; `StyleItemLike.system` gains `weaponGroups?: string[]` and `knownWeaponGroups?: { id: string; level: number }[]`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/core/martial-arts/weapon-groups.test.ts`:

```ts
import { groupLearnability, unlearnGroupUpdate } from "../../../src/core/martial-arts";

describe("groupLearnability", () => {
  const base = { groupId: "staves", offered: ["staves", "fencingBlades"], knownGroups: [] as { id: string; level: number }[], maneuversAtLevel: 0, freeSlots: 1, level: 3 };
  it("is ok with a free slot and room under the cap", () => {
    expect(groupLearnability(base)).toEqual({ ok: true });
  });
  it("refuses groups the style does not offer, already-known groups, no free slot and the shared two-per-level cap", () => {
    expect(groupLearnability({ ...base, groupId: "axes" })).toEqual({ ok: false, reason: "notOffered" });
    expect(groupLearnability({ ...base, knownGroups: [{ id: "staves", level: 1 }] })).toEqual({ ok: false, reason: "known" });
    expect(groupLearnability({ ...base, freeSlots: 0 })).toEqual({ ok: false, reason: "noSlot" });
    expect(groupLearnability({ ...base, maneuversAtLevel: 1, knownGroups: [{ id: "fencingBlades", level: 3 }] })).toEqual({ ok: false, reason: "levelCap" });
  });
});

describe("unlearnGroupUpdate", () => {
  it("removes the group and refunds the slot (never below the first)", () => {
    expect(unlearnGroupUpdate({ known: [{ id: "staves", level: 2 }], groupId: "staves", slotsInvested: 3 })).toEqual({ knownWeaponGroups: [], slotsInvested: 2 });
    expect(unlearnGroupUpdate({ known: [{ id: "staves", level: 2 }], groupId: "staves", slotsInvested: 1 })).toEqual({ knownWeaponGroups: [], slotsInvested: 1 });
  });
  it("returns null for a group that is not known", () => {
    expect(unlearnGroupUpdate({ known: [], groupId: "staves", slotsInvested: 2 })).toBeNull();
  });
});
```

In `tests/core/martial-arts/style.test.ts` change the `freshStyleUpdate` expectation to `{ "system.slotsInvested": 1, "system.knownManeuvers": [], "system.knownWeaponGroups": [] }`.

In `tests/core/martial-arts/maneuvers.test.ts` add (use that file's existing `learnability` import):

```ts
it("bought weapon groups count toward the two-per-level cap", () => {
  const offered = [{ list: "block", difficulties: [1, 2, 3] }];
  const v = learnability({ maneuverId: "block:2", offered, known: [{ id: "block:1", level: 4 }], freeSlots: 3, level: 4, groupsAtLevel: 1 });
  expect(v).toEqual({ ok: false, reason: "levelCap" });
});
```

In `tests/core/martial-arts/maneuver-view.test.ts` add (reusing that file's `style(known, id)` helper, which is at module scope after the Plan C follow-up):

```ts
describe("weapon group rows (SP18 Plan D)", () => {
  it("lists offered groups with their state and the known ones", () => {
    const item = style([], "a");
    item.system.weaponGroups = ["Staves", "Fencing Blades"];
    item.system.knownWeaponGroups = [{ id: "staves", level: 2 }];
    const v = buildMartialArtsView({ enabled: true, knowsBasics: true, storedActiveId: "", canAct: true, level: 2, freeSlots: 1, items: [item] });
    const row = v.styles[0];
    expect(row.weaponGroups.map((g) => [g.id, g.state])).toEqual([["fencingBlades", "learnable"], ["staves", "known"]]);
    expect(row.knownWeaponGroups.map((g) => g.id)).toEqual(["staves"]);
    expect(row.weaponGroups[0].labelKey).toBe("ADND2E.martialWeaponGroups.fencingBlades");
  });
  it("a locked group carries a reason key", () => {
    const item = style([], "a");
    item.system.weaponGroups = ["Staves"];
    const v = buildMartialArtsView({ enabled: true, knowsBasics: true, storedActiveId: "", canAct: true, level: 2, freeSlots: 0, items: [item] });
    expect(v.styles[0].weaponGroups[0]).toMatchObject({ state: "locked", reasonKey: "ADND2E.sheet.martialArts.locked.noSlot" });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/martial-arts`. Expected: FAIL.

- [ ] **Step 3: Implement**

`src/core/martial-arts/weapon-groups.ts` - add `import { MAX_MANEUVERS_PER_LEVEL, type LearnVerdict } from "./maneuvers";` and:

```ts
/** Whether a style may buy a tight group now. The two-per-level cap is shared with maneuvers. */
export function groupLearnability(input: {
  groupId: string;
  offered: readonly string[];
  knownGroups: readonly { id: string; level: number }[];
  /** maneuvers already learned at the current level on this style */
  maneuversAtLevel: number;
  freeSlots: number;
  level: number;
}): LearnVerdict {
  if (!input.offered.includes(input.groupId)) return { ok: false, reason: "notOffered" };
  if (input.knownGroups.some((g) => g.id === input.groupId)) return { ok: false, reason: "known" };
  if (input.freeSlots < 1) return { ok: false, reason: "noSlot" };
  const groupsAtLevel = input.knownGroups.filter((g) => g.level === input.level).length;
  if (input.maneuversAtLevel + groupsAtLevel >= MAX_MANEUVERS_PER_LEVEL) return { ok: false, reason: "levelCap" };
  return { ok: true };
}

/** Removes one bought group and refunds its slot (never below the style's first slot); null when it is not known. */
export function unlearnGroupUpdate(input: {
  known: readonly { id: string; level: number }[];
  groupId: string;
  slotsInvested: number;
}): { knownWeaponGroups: { id: string; level: number }[]; slotsInvested: number } | null {
  if (!input.known.some((g) => g.id === input.groupId)) return null;
  return {
    knownWeaponGroups: input.known.filter((g) => g.id !== input.groupId).map((g) => ({ id: g.id, level: g.level })),
    slotsInvested: Math.max(1, input.slotsInvested - 1),
  };
}
```

`src/core/martial-arts/maneuvers.ts` - `learnability` input gets `groupsAtLevel?: number;` and the cap line becomes:

```ts
  if (input.known.filter((k) => k.level === input.level).length + (input.groupsAtLevel ?? 0) >= MAX_MANEUVERS_PER_LEVEL) return { ok: false, reason: "levelCap" };
```

`src/core/martial-arts/style.ts`:

```ts
export function freshStyleUpdate(): { "system.slotsInvested": 1; "system.knownManeuvers": []; "system.knownWeaponGroups": [] } {
  return { "system.slotsInvested": 1, "system.knownManeuvers": [], "system.knownWeaponGroups": [] };
}
```

`src/data/item/martial-style.ts` - add after `knownManeuvers`:

```ts
      /** SP18 Plan D: the weapon tight groups bought on this style ({ id: group id, level bought at }); one slot each. */
      knownWeaponGroups: new ArrayField(
        new SchemaField({
          id: new StringField({ required: true, blank: false }),
          level: new NumberField({ required: true, integer: true, min: 1 }),
        }),
        { required: true, initial: () => [] },
      ),
```

`src/core/martial-arts/view.ts`:
- `StyleItemLike.system` adds `weaponGroups?: string[]; knownWeaponGroups?: { id: string; level: number }[];`
- import `{ groupLearnability, offeredGroupIds, weaponGroupLabelKey } from "./weapon-groups"`.
- add and export:

```ts
export interface WeaponGroupRow {
  id: string;
  labelKey: string;
  state: "known" | "learnable" | "locked";
  reasonKey: string;
}
```
- `StyleRow` adds `weaponGroups: WeaponGroupRow[]; knownWeaponGroups: WeaponGroupRow[];`
- in the `styles` map, hoist `const knownGroups = i.system.knownWeaponGroups ?? []; const level = input.level ?? 0;` above the `maneuvers` computation, pass `groupsAtLevel: knownGroups.filter((g) => g.level === level).length` into that map's `learnability(...)` call, and after `maneuvers` compute:

```ts
    const offeredIds = offeredGroupIds(i.system.weaponGroups ?? []);
    const maneuversAtLevel = known.filter((k) => k.level === level).length;
    const weaponGroups = offeredIds.map((id): WeaponGroupRow => {
      const isKnown = knownGroups.some((g) => g.id === id);
      const verdict = groupLearnability({ groupId: id, offered: offeredIds, knownGroups, maneuversAtLevel, freeSlots: input.freeSlots ?? 0, level });
      return {
        id,
        labelKey: weaponGroupLabelKey(id),
        state: isKnown ? "known" : verdict.ok ? "learnable" : "locked",
        reasonKey: isKnown || verdict.ok ? "" : `ADND2E.sheet.martialArts.locked.${verdict.reason}`,
      };
    });
```
  and the returned row adds `weaponGroups, knownWeaponGroups: weaponGroups.filter((g) => g.state === "known"),`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/martial-arts tests/data` then `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(martial-arts): knownWeaponGroups, group learn/unlearn rules and view rows (SP18 Plan D)"
```

---

### Task 3: Per-maneuver weapon permissions and the armed assessment (pure)

**Files:**
- Create: `src/core/martial-arts/weapon-use.ts`
- Modify: `src/core/martial-arts/index.ts` (`export * from "./weapon-use";`)
- Test: `tests/core/martial-arts/weapon-use.test.ts`

**Interfaces:**
- Consumes: Task 1 `weaponGroupIdsFor`; `MANEUVERS` from `maneuvers.ts` (test only).
- Produces: `MANEUVER_WEAPONS: Readonly<Record<string, WeaponUse>>`, `WEAPON_HIT_BONUS`, `assessWeaponUse({ maneuverId, knownGroups, weapons }): WeaponUseAssessment` where `WeaponUseAssessment = { state: "unarmed" | "ok" | "uncovered" | "notAllowed" | "needsStyleWeapon"; weaponName: string | null; covered: boolean; hitBonus: number }`; `WieldedWeapon = { name: string; baseName?: string }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { MANEUVERS, MANEUVER_WEAPONS, WEAPON_GROUP_IDS, WEAPON_HIT_BONUS, assessWeaponUse } from "../../../src/core/martial-arts";

describe("MANEUVER_WEAPONS census", () => {
  it("covers every registry maneuver, and only with known group ids", () => {
    for (const m of MANEUVERS) expect(MANEUVER_WEAPONS[m.id], m.id).toBeDefined();
    for (const [id, use] of Object.entries(MANEUVER_WEAPONS)) {
      if (Array.isArray(use)) for (const g of use) expect(WEAPON_GROUP_IDS, `${id} ${g}`).toContain(g);
    }
    for (const id of Object.keys(WEAPON_HIT_BONUS)) expect(MANEUVER_WEAPONS[id], id).toBeDefined();
  });
  it("matches the book on the spot checks", () => {
    expect(MANEUVER_WEAPONS["kick:1"]).toBe("none");
    expect(MANEUVER_WEAPONS["block:1"]).toBe("any");
    expect(MANEUVER_WEAPONS["strike:1"]).toBe("any");
    expect(MANEUVER_WEAPONS["lock:4"]).toEqual(["chainWeapons", "ropeWeapons", "lashWeapons"]);
    expect(MANEUVER_WEAPONS["vitalArea:2"]).toEqual(["clubbingWeapons"]);
  });
});

describe("assessWeaponUse", () => {
  const sai = { name: "Sai +1", baseName: "" };
  it("is unarmed with no weapon (and Weapon Breaker then needs a style weapon)", () => {
    expect(assessWeaponUse({ maneuverId: "kick:1", knownGroups: [], weapons: [] })).toEqual({ state: "unarmed", weaponName: null, covered: false, hitBonus: 0 });
    expect(assessWeaponUse({ maneuverId: "weapon:1", knownGroups: [], weapons: [] }).state).toBe("needsStyleWeapon");
  });
  it("an unarmed-only maneuver while wielding is notAllowed", () => {
    expect(assessWeaponUse({ maneuverId: "kick:1", knownGroups: ["karateWeapons"], weapons: [sai] })).toMatchObject({ state: "notAllowed", weaponName: "Sai +1" });
  });
  it("'any' is ok; the sai bonus needs the group learned", () => {
    expect(assessWeaponUse({ maneuverId: "block:1", knownGroups: [], weapons: [sai] })).toMatchObject({ state: "ok", covered: false, hitBonus: 0 });
    expect(assessWeaponUse({ maneuverId: "block:1", knownGroups: ["karateWeapons"], weapons: [sai] })).toMatchObject({ state: "ok", covered: true, hitBonus: 2 });
    expect(assessWeaponUse({ maneuverId: "lock:2", knownGroups: ["karateWeapons"], weapons: [sai] }).hitBonus).toBe(2);
  });
  it("chain and rope groups give Grappling Block +2", () => {
    const chain = { name: "Kusarigama", baseName: "" };
    expect(assessWeaponUse({ maneuverId: "block:3", knownGroups: ["chainWeapons"], weapons: [chain] })).toMatchObject({ state: "ok", hitBonus: 2 });
  });
  it("a listed group must be learned: uncovered when not, notAllowed when the weapon is in no permitted group", () => {
    const club = { name: "Club", baseName: "" };
    expect(assessWeaponUse({ maneuverId: "vitalArea:1", knownGroups: [], weapons: [club] }).state).toBe("uncovered");
    expect(assessWeaponUse({ maneuverId: "vitalArea:1", knownGroups: ["clubbingWeapons"], weapons: [club] })).toMatchObject({ state: "ok", covered: true });
    expect(assessWeaponUse({ maneuverId: "vitalArea:1", knownGroups: ["clubbingWeapons"], weapons: [{ name: "Rapier", baseName: "" }] }).state).toBe("notAllowed");
  });
  it("Weapon Breaker needs a wielded weapon from a learned group", () => {
    const kat = { name: "Katana", baseName: "" };
    expect(assessWeaponUse({ maneuverId: "weapon:1", knownGroups: [], weapons: [kat] }).state).toBe("needsStyleWeapon");
    expect(assessWeaponUse({ maneuverId: "weapon:1", knownGroups: ["orientalBlades"], weapons: [kat] })).toMatchObject({ state: "ok", covered: true });
  });
  it("picks the first workable weapon when several are wielded, and an unknown maneuver id is treated as any", () => {
    const r = assessWeaponUse({ maneuverId: "vitalArea:1", knownGroups: ["clubbingWeapons"], weapons: [{ name: "Rapier", baseName: "" }, { name: "Club", baseName: "" }] });
    expect(r).toMatchObject({ state: "ok", weaponName: "Club" });
    expect(assessWeaponUse({ maneuverId: "x:1", knownGroups: [], weapons: [sai] }).state).toBe("ok");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/martial-arts/weapon-use.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// PHBR15 ch.4 each maneuver's "Weapons Allowed" line as data, and the armed-use assessment. Pure.
// "(using shaft)" qualifiers in the book are not enforced; only group membership is.
import { weaponGroupIdsFor } from "./weapon-groups";

export type WeaponUse = "none" | "any" | readonly string[];

const CHAIN_ROPE_LASH = ["chainWeapons", "ropeWeapons", "lashWeapons"] as const;

export const MANEUVER_WEAPONS: Readonly<Record<string, WeaponUse>> = {
  "block:1": "any", "block:2": "any", "block:3": "any", "block:4": "any",
  "kick:1": "none", "kick:2": "none", "kick:3": "none",
  "strike:1": "any", "strike:2": "none", "strike:3": "none",
  "lock:1": [...CHAIN_ROPE_LASH, "axes", "clubbingWeapons", "flails", "karateWeapons", "picks", "sickles", "staves", "bladedPoles", "spears"],
  "lock:2": ["mediumBlades", "orientalBlades", "shortBlades", ...CHAIN_ROPE_LASH, "axes", "clubbingWeapons", "flails", "karateWeapons", "picks", "sickles", "staves", "spears"],
  "lock:3": [...CHAIN_ROPE_LASH, "clubbingWeapons", "karateWeapons", "staves", "spears"],
  "lock:4": [...CHAIN_ROPE_LASH],
  "push:1": ["clubbingWeapons", "staves", "bladedPoles", "poleSpears", "spears"],
  "push:2": "none", "push:3": "none",
  "throw:1": "any", "throw:2": "any", "throw:3": "none",
  "throw:4": [...CHAIN_ROPE_LASH, "staves", "bladedPoles", "poleSpears", "spears"],
  "vitalArea:1": ["clubbingWeapons"], "vitalArea:2": ["clubbingWeapons"], "vitalArea:3": ["clubbingWeapons"], "vitalArea:4": "none",
  "movement:1": "any", "movement:2": "any", "movement:3": "any", "movement:4": "any", "movement:5": "any", "movement:6": "none",
  "weapon:1": "any", "weapon:2": ["ropeWeapons"],
  "mental:1": "none", "mental:2": "none", "mental:3": "none", "mental:4": "none", "mental:5": "none", "mental:6": "none", "mental:7": "none",
};

/** +2 to hit when the matching weapon (by name or by group) is wielded and its group is learned. */
export const WEAPON_HIT_BONUS: Readonly<Record<string, { amount: number; names?: readonly string[]; groups?: readonly string[] }>> = {
  "block:1": { amount: 2, names: ["sai", "jitte"] },
  "block:2": { amount: 2, names: ["sai", "jitte"] },
  "lock:2": { amount: 2, names: ["sai", "jitte"] },
  "block:3": { amount: 2, groups: ["chainWeapons", "ropeWeapons"] },
};

export type WeaponUseState = "unarmed" | "ok" | "uncovered" | "notAllowed" | "needsStyleWeapon";

export interface WeaponUseAssessment {
  state: WeaponUseState;
  weaponName: string | null;
  /** the wielded weapon belongs to a group bought on the active style */
  covered: boolean;
  hitBonus: number;
}

export interface WieldedWeapon {
  name: string;
  /** the weapon item's base weapon name, tried before its own name */
  baseName?: string;
}

const outcome = (state: WeaponUseState, weaponName: string | null, covered = false, hitBonus = 0): WeaponUseAssessment => ({ state, weaponName, covered, hitBonus });

function bonusFor(maneuverId: string, weapon: WieldedWeapon, groups: readonly string[]): number {
  const def = WEAPON_HIT_BONUS[maneuverId];
  if (!def) return 0;
  const lower = [weapon.name, weapon.baseName ?? ""].map((n) => n.toLowerCase());
  const byName = (def.names ?? []).some((n) => lower.some((l) => l.split(/[^a-z]+/).includes(n)));
  const byGroup = (def.groups ?? []).some((g) => groups.includes(g));
  return byName || byGroup ? def.amount : 0;
}

/** How the equipped weapons relate to a maneuver on the active style: hints and the book's +2 bonuses, never damage. */
export function assessWeaponUse(input: { maneuverId: string; knownGroups: readonly string[]; weapons: readonly WieldedWeapon[] }): WeaponUseAssessment {
  const policy: WeaponUse = MANEUVER_WEAPONS[input.maneuverId] ?? "any";
  const known = new Set(input.knownGroups);
  const rows = input.weapons.map((w) => ({ weapon: w, groups: weaponGroupIdsFor(w.baseName ?? "", w.name) }));
  if (input.maneuverId === "weapon:1") {
    const style = rows.find((r) => r.groups.some((g) => known.has(g)));
    return style ? outcome("ok", style.weapon.name, true) : outcome("needsStyleWeapon", rows[0]?.weapon.name ?? null);
  }
  if (rows.length === 0) return outcome("unarmed", null);
  if (policy === "none") return outcome("notAllowed", rows[0].weapon.name);
  const permitted = policy === "any" ? null : policy;
  const inPermitted = (groups: string[]): boolean => permitted === null || groups.some((g) => permitted.includes(g));
  const usable = rows.find((r) => permitted === null || r.groups.some((g) => known.has(g) && permitted.includes(g)));
  if (!usable) {
    const wrongGroup = rows.find((r) => inPermitted(r.groups));
    return wrongGroup ? outcome("uncovered", wrongGroup.weapon.name) : outcome("notAllowed", rows[0].weapon.name);
  }
  const covered = usable.groups.some((g) => known.has(g));
  return outcome("ok", usable.weapon.name, covered, covered ? bonusFor(input.maneuverId, usable.weapon, usable.groups) : 0);
}
```

Add `export * from "./weapon-use";` to `src/core/martial-arts/index.ts`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/martial-arts`, `npm run typecheck`, and `npx vitest run --coverage tests/core/martial-arts` (confirm `weapon-use.ts` and `weapon-groups.ts` at 100% statements). Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(martial-arts): per-maneuver Weapons Allowed data and armed-use assessment (SP18 Plan D)"
```

---

### Task 4: Learn/unlearn glue, Features and Main UI, lang

**Files:**
- Modify: `src/sheets/character/martial-arts-actions.ts`, `src/sheets/character/sheet.ts`, `templates/actor/pc/partials/pc-feature-panels.hbs`, `templates/actor/pc/partials/pc-main-panels.hbs`, `lang/en.json`, `styles/actor/pc.scss`
- Test: `tests/templates/martial-maneuvers-bindings.test.ts` (extend), `tests/lang/martial-weapon-groups.test.ts` (new)

**Interfaces:**
- Consumes: Task 2 view rows (`s.weaponGroups`, `s.knownWeaponGroups` with `id`, `labelKey`, `state`, `reasonKey`), `groupLearnability`, `unlearnGroupUpdate`, `offeredGroupIds`.
- Produces: sheet actions `learnWeaponGroup` / `unlearnWeaponGroup` (dataset `itemId`, `groupId`); exported `learnWeaponGroup(actor, styleId, groupId)` / `unlearnWeaponGroup(actor, styleId, groupId)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lang/martial-weapon-groups.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WEAPON_GROUP_IDS } from "../../src/core/martial-arts";

const LANG = JSON.parse(readFileSync(path.resolve(__dirname, "..", "..", "lang", "en.json"), "utf8"));
const lookup = (key: string): unknown => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], LANG);

describe("weapon group labels", () => {
  it("every registry group has a label and the sheet strings exist", () => {
    for (const id of WEAPON_GROUP_IDS) expect(typeof lookup(`ADND2E.martialWeaponGroups.${id}`), id).toBe("string");
    for (const k of ["weaponGroups", "learnGroup", "unlearnGroup", "unlearnGroupConfirm", "needsStyleWeapon", "weaponGroupsKnown"])
      expect(typeof lookup(`ADND2E.sheet.martialArts.${k}`), k).toBe("string");
  });
});
```

Extend `tests/templates/martial-maneuvers-bindings.test.ts` (inside its top-level describe) with:

```ts
  it("weapon groups: Features has Learn/Unlearn actions the PC sheet registers; Main only lists known groups", () => {
    expect(FEATURES).toContain('data-action="learnWeaponGroup"');
    expect(FEATURES).toContain('data-action="unlearnWeaponGroup"');
    expect(MAIN).toContain("s.knownWeaponGroups");
    expect(MAIN).not.toContain("learnWeaponGroup");
    expect(SHEET).toMatch(/^\s+learnWeaponGroup: Adnd2eCharacterSheet\.#on/m);
    expect(SHEET).toMatch(/^\s+unlearnWeaponGroup: Adnd2eCharacterSheet\.#on/m);
    expect(NPC_SHEET).not.toContain("WeaponGroup");
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/lang/martial-weapon-groups.test.ts tests/templates/martial-maneuvers-bindings.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**

`lang/en.json` (inside `ADND2E`): add a sibling of `martialManeuvers`:

```json
"martialWeaponGroups": { "fencingBlades": "Fencing Blades", "longBlades": "Long Blades", "mediumBlades": "Medium Blades", "orientalBlades": "Oriental Blades", "shortBlades": "Short Blades", "chainWeapons": "Chain Weapons", "lashWeapons": "Lash Weapons", "ropeWeapons": "Rope Weapons", "axes": "Axes", "clubbingWeapons": "Clubbing Weapons", "flails": "Flails", "karateWeapons": "Karate Weapons", "picks": "Picks", "sickles": "Sickles", "staves": "Staves", "bladedPoles": "Bladed Poles", "poleSpears": "Pole Spears", "lances": "Lances", "spears": "Spears" },
```

and in `ADND2E.sheet.martialArts` (next to `passive`): `"weaponGroups": "Weapon groups"`, `"weaponGroupsKnown": "Weapon groups"`, `"learnGroup": "Learn"`, `"unlearnGroup": "Unlearn"`, `"unlearnGroupConfirm": "Unlearn the {name} weapon group? Its weapon proficiency slot is refunded."`, `"needsStyleWeapon": "Weapon Breaker needs you to wield a weapon from a weapon group you have learned on this style."`.

`src/sheets/character/martial-arts-actions.ts` - extend the import from `../../core/martial-arts` with `groupLearnability, offeredGroupIds, unlearnGroupUpdate`, add:

```ts
/** Buy a weapon tight group on an owned style: re-validated here, then 1 slot is spent. */
export async function learnWeaponGroup(actor: MartialArtsActor, styleId: string, groupId: string): Promise<void> {
  if (!martialArtsView(actor).visible) return;
  const item = [...actor.items].find((i) => i.type === "martialStyle" && i.id === styleId);
  if (!item?.update) return;
  const sys = item.system as {
    weaponGroups?: string[];
    knownManeuvers?: { id: string; level: number }[];
    knownWeaponGroups?: { id: string; level: number }[];
    slotsInvested?: number;
  };
  const level = characterLevel(actor);
  if (level < 1) return warn("ADND2E.sheet.martialArts.locked.noLevel");
  const knownGroups = sys.knownWeaponGroups ?? [];
  const verdict = groupLearnability({
    groupId,
    offered: offeredGroupIds(sys.weaponGroups ?? []),
    knownGroups,
    maneuversAtLevel: (sys.knownManeuvers ?? []).filter((k) => k.level === level).length,
    freeSlots: freeWeaponSlots(actor),
    level,
  });
  if (!verdict.ok) return warn(`ADND2E.sheet.martialArts.locked.${verdict.reason}`);
  await item.update({
    "system.knownWeaponGroups": [...knownGroups.map((g) => ({ id: g.id, level: g.level })), { id: groupId, level }],
    "system.slotsInvested": (sys.slotsInvested ?? 1) + 1,
  });
}

/** Unlearn a bought weapon group after a confirmation; the weapon proficiency slot is refunded. */
export async function unlearnWeaponGroup(actor: MartialArtsActor, styleId: string, groupId: string): Promise<void> {
  if (!martialArtsView(actor).visible) return;
  const item = [...actor.items].find((i) => i.type === "martialStyle" && i.id === styleId);
  if (!item?.update) return;
  const sys = item.system as { knownWeaponGroups?: { id: string; level: number }[]; slotsInvested?: number };
  const change = unlearnGroupUpdate({ known: sys.knownWeaponGroups ?? [], groupId, slotsInvested: sys.slotsInvested ?? 1 });
  if (!change) return;
  const confirmed = await themedConfirm({
    window: { title: game.i18n!.localize("ADND2E.sheet.martialArts.unlearnTitle") },
    content: `<p>${game.i18n!.format("ADND2E.sheet.martialArts.unlearnGroupConfirm", {
      name: foundry.utils.escapeHTML(game.i18n!.localize(`ADND2E.martialWeaponGroups.${groupId}`)),
    })}</p>`,
  } as never);
  if (confirmed !== true) return;
  await item.update({ "system.knownWeaponGroups": change.knownWeaponGroups, "system.slotsInvested": change.slotsInvested });
}
```

Also in the existing `learnManeuver`, add `knownWeaponGroups?: { id: string; level: number }[];` to its `sys` cast and pass `groupsAtLevel: (sys.knownWeaponGroups ?? []).filter((g) => g.level === level).length` to its `learnability(...)` call.

`src/sheets/character/sheet.ts`: import `learnWeaponGroup, unlearnWeaponGroup` from `./martial-arts-actions`; register next to `learnManeuver`:

```ts
      learnWeaponGroup: Adnd2eCharacterSheet.#onLearnWeaponGroup,
      unlearnWeaponGroup: Adnd2eCharacterSheet.#onUnlearnWeaponGroup,
```

and add handlers beside `#onUnlearnManeuver`:

```ts
  static async #onLearnWeaponGroup(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const styleId = target.dataset.itemId ?? "";
    const groupId = target.dataset.groupId ?? "";
    if (this.isEditable && styleId && groupId) await learnWeaponGroup(this.document as never, styleId, groupId);
  }

  static async #onUnlearnWeaponGroup(this: Adnd2eCharacterSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const styleId = target.dataset.itemId ?? "";
    const groupId = target.dataset.groupId ?? "";
    if (this.isEditable && styleId && groupId) await unlearnWeaponGroup(this.document as never, styleId, groupId);
  }
```

`templates/actor/pc/partials/pc-feature-panels.hbs` - inside the style row, after the closing `{{/if}}` of the `{{#if s.maneuvers.length}}` block (the `kit-powers` block) add:

```hbs
          {{#if s.weaponGroups.length}}
            <div class="kit-powers weapon-groups">
              <h5 class="kit-subhead">{{localize 'ADND2E.sheet.martialArts.weaponGroups'}}</h5>
              <div class="maneuver-list">
                {{#each s.weaponGroups as |g|}}
                  <div class="power-row{{#if (eq g.state 'locked')}} locked{{/if}}" data-group-id="{{g.id}}">
                    <span class="name">{{localize g.labelKey}}</span>
                    {{#if g.reasonKey}}<span class="effect">{{localize g.reasonKey}}</span>{{/if}}
                    {{#if (eq g.state 'known')}}
                      {{#if @root.adnd2e.lock.unlocked}}<button type="button" class="kit-small" data-action="unlearnWeaponGroup" data-item-id="{{s.id}}" data-group-id="{{g.id}}">{{localize 'ADND2E.sheet.martialArts.unlearnGroup'}}</button>{{/if}}
                    {{else if (eq g.state 'learnable')}}
                      <button type="button" class="kit-small" data-action="learnWeaponGroup" data-item-id="{{s.id}}" data-group-id="{{g.id}}">{{localize 'ADND2E.sheet.martialArts.learnGroup'}}</button>
                    {{/if}}
                  </div>
                {{/each}}
              </div>
            </div>
          {{/if}}
```

`templates/actor/pc/partials/pc-main-panels.hbs` - inside each style row after the `usableManeuvers` block add:

```hbs
            {{#if s.knownWeaponGroups.length}}
              <p class="hint style-weapons">{{localize 'ADND2E.sheet.martialArts.weaponGroupsKnown'}}: {{#each s.knownWeaponGroups as |g|}}{{localize g.labelKey}}{{#unless @last}}, {{/unless}}{{/each}}</p>
            {{/if}}
```

`styles/actor/pc.scss`: inside the `.adnd2e.pc-sheet .kit-martial-arts { ... }` block add `.style-weapons { flex: 0 0 100%; margin: 2px 0 0 18px; }`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/lang tests/templates tests/core/martial-arts`, `npm run typecheck`, `npx eslint src/sheets/character src/core/martial-arts`, and the scratch build check. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(martial-arts): buy and unlearn style weapon groups from the Features tab (SP18 Plan D)"
```

---

### Task 5: Armed maneuver use - hints, +2 bonuses, Weapon Breaker gate

**Files:**
- Modify: `src/core/martial-arts/card.ts`, `src/sheets/character/martial-arts-actions.ts`, `templates/chat/martial-arts-attack.hbs`, `lang/en.json`
- Test: `tests/core/martial-arts/card.test.ts`, `tests/templates/martial-maneuvers-bindings.test.ts`

**Interfaces:**
- Consumes: Task 3 `assessWeaponUse`, `WieldedWeapon`; Task 2 `StyleRow.knownWeaponGroups`.
- Produces: `ManeuverCardInput.weaponNote?: { state: "ok" | "uncovered" | "notAllowed"; weaponName: string } | null`; `ManeuverCardContext.weaponNoteKey: string` and `weaponName: string` (blank when none); `SkillCardContext` carries blanks.

- [ ] **Step 1: Write the failing tests**

Add to `tests/core/martial-arts/card.test.ts` (import `resolveManeuverAttack` and `buildManeuverCardContext` if not already imported there):

```ts
describe("weapon note (SP18 Plan D)", () => {
  const base = { thac0: 10, targetAc: 5, attackerArmorType: "none", opponentWeaponSize: null, situationalModifier: 0, targetArmorGroup: "none", styleDie: "1d4", level: 3, strengthAdj: 0 };
  const result = resolveManeuverAttack({ ...base, maneuverId: "vitalArea:1", naturalD20: 15 });
  const common = { actorName: "Bo", actorImg: "i.png", styleName: "Kung Fu", targetName: "Orc", result, damageTotal: 0 };
  it("an uncovered weapon posts the hint key and name", () => {
    const c = buildManeuverCardContext({ ...common, weaponNote: { state: "uncovered", weaponName: "Club" } });
    expect(c.weaponNoteKey).toBe("ADND2E.chat.martialArts.weapon.uncovered");
    expect(c.weaponName).toBe("Club");
  });
  it("an ok weapon shows the armed line; no note is blank", () => {
    expect(buildManeuverCardContext({ ...common, weaponNote: { state: "ok", weaponName: "Club" } }).weaponNoteKey).toBe("ADND2E.chat.martialArts.weapon.ok");
    const none = buildManeuverCardContext(common);
    expect(none.weaponNoteKey).toBe("");
    expect(none.weaponName).toBe("");
  });
});
```

Extend the bindings test with: `expect(CHAT).toContain("weaponNoteKey");`, `expect(ACTIONS).toContain("assessWeaponUse");`, `expect(ACTIONS).toContain("ADND2E.sheet.martialArts.needsStyleWeapon");`, `expect(ACTIONS).toContain("ADND2E.chat.martialArts.mod.weaponBonus");` (as one new `it`). The existing lang-key census test already scans `ACTIONS` for `ADND2E.(sheet|chat).martialArts.*` keys, so the new lang strings are validated there.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/martial-arts/card.test.ts tests/templates/martial-maneuvers-bindings.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**

`src/core/martial-arts/card.ts`:
- `ManeuverCardInput` add:

```ts
  /** how the wielded weapon relates to the maneuver (a hint only; damage is never replaced) */
  weaponNote?: { state: "ok" | "uncovered" | "notAllowed"; weaponName: string } | null;
```
- `ManeuverCardContext` add `weaponNoteKey: string; weaponName: string;`
- in `buildManeuverCardContext`'s returned object add:

```ts
    weaponNoteKey: input.weaponNote ? `ADND2E.chat.martialArts.weapon.${input.weaponNote.state}` : "",
    weaponName: input.weaponNote?.weaponName ?? "",
```
- in `buildSkillCardContext`'s `base` object add `weaponNoteKey: "", weaponName: "",`.

`templates/chat/martial-arts-attack.hbs`: after the `noStyleDie` hint line add:

```hbs
  {{#if weaponNoteKey}}<p class="hint">{{localize weaponNoteKey weapon=weaponName}}</p>{{/if}}
```

`lang/en.json`: in `ADND2E.chat.martialArts` add `"weapon": { "ok": "Armed with {weapon}.", "uncovered": "{weapon} is not in a weapon group you have learned for this style.", "notAllowed": "{weapon} cannot be used with this maneuver." }` and inside its `mod` object add `"weaponBonus": "Weapon bonus"`.

`src/sheets/character/martial-arts-actions.ts` - import `assessWeaponUse, type WieldedWeapon` from `../../core/martial-arts` and add:

```ts
/** The equipped melee weapons (a missing category counts as melee). */
function wieldedWeapons(actor: MartialArtsActor): WieldedWeapon[] {
  return [...actor.items]
    .filter((i) => i.type === "weapon" && i.system.equipped === true && i.system.category !== "ranged")
    .map((i) => ({ name: i.name, baseName: typeof i.system.baseWeaponName === "string" ? i.system.baseWeaponName : "" }));
}
```

In `useManeuver`, after the `def.kind === "skill"` block and before `const target = await resolveTarget();` add:

```ts
  const armed = assessWeaponUse({
    maneuverId,
    knownGroups: view.active.knownWeaponGroups.map((g) => g.id),
    weapons: wieldedWeapons(actor),
  });
  if (armed.state === "needsStyleWeapon") return warn("ADND2E.sheet.martialArts.needsStyleWeapon");
  const weaponRows = armed.hitBonus ? [{ labelKey: "ADND2E.chat.martialArts.mod.weaponBonus", amount: armed.hitBonus }] : [];
```

change the roll input `situationalModifier: cond.total` to `cond.total + armed.hitBonus`, change the context `situationalRows: cond.rows` to `situationalRows: [...cond.rows, ...weaponRows]`, and add to the `buildManeuverCardContext({...})` call:

```ts
    weaponNote:
      armed.state === "ok" || armed.state === "uncovered" || armed.state === "notAllowed"
        ? { state: armed.state, weaponName: armed.weaponName ?? "" }
        : null,
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core tests/templates tests/lang tests/sheets`, `npm run typecheck`, `npx eslint src tests`, scratch build check. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(martial-arts): armed maneuver hints, weapon +2 bonuses and the Weapon Breaker gate (SP18 Plan D)"
```

---

### Task 6: Gates, headless proof, README, checklist, PR

**Files:**
- Create: `.superpowers/proof/martial-d.proof.ts` (git-ignored)
- Modify: `README.md` (SP18 row only; CRLF)

- [ ] **Step 1: Headless proof** from `.superpowers/proof/martial-c.proof.ts` boilerplate (it already registers `localize`, `adnd2eSigned`, `and`). Assertions: (1) the real `MartialStyleItemModel.schema` cleans a style source without `knownWeaponGroups` to `[]` and two cleaned styles do not share the array instance; (2) for every file in `packs/martial-styles/_source`, `offeredGroupIds(system.weaponGroups)` is non-empty except Sumo (empty `weaponGroups`), and Kung Fu offers every group id; (3) learn then unlearn round-trips `slotsInvested` and the known list; (4) `assessWeaponUse` for `weapon:1` with Katana and `["orientalBlades"]` is ok, and with `[]` is `needsStyleWeapon`; (5) render `templates/chat/martial-arts-attack.hbs` for a `buildManeuverCardContext` with `weaponNote: { state: "uncovered", weaponName: "Club" }` and assert the localized hint and, with a `situationalRows` entry labelled `ADND2E.chat.martialArts.mod.weaponBonus`, the "Weapon bonus" breakdown row.
Run: `npx vitest run --config .superpowers/proof/vitest.proof.config.ts .superpowers/proof/martial-d.proof.ts`. Expected: PASS. A failing assertion that exposes a real defect is reported, not papered over.

- [ ] **Step 2: CI sequence** - `npm run lint`, `npm run typecheck`, `npm run test:coverage` (100% statements), then the scratch build check. Add missing tests rather than lowering anything.

- [ ] **Step 3: README SP18 row** - note Plan D complete (style weapon groups: buy a tight group per slot, per-maneuver Weapons Allowed hints, +2 sai/jitte/chain/rope bonuses, Weapon Breaker needs a style weapon); remaining: Mental Resistance saves and All-Around Sight rear-AC numbers. Verify `git diff --stat README.md` is a one-line change (CRLF preserved).

```bash
git add README.md
git commit -m "docs: SP18 Plan D style weapons complete (#86)"
```

- [ ] **Step 4: Rebuild the installed system and hand over the checklist** (only if Foundry is closed; state the branch name). Checklist (prerequisites stated; reset settings between checks):
1. **Setup:** Advanced Martial Arts ON, reload. A PC with a Fighter class (level 3+), a Jujutsu style set active, at least 2 free weapon slots, an equipped Katana +1 weapon item, and a Club weapon item.
2. **Features:** Jujutsu lists Weapon groups: Fencing Blades, Medium Blades, Oriental Blades. Learn Oriental Blades: free slots drop by 1; Unlearn shows only when unlocked; a third purchase this level (counting maneuvers) is refused with the level-cap message.
3. **Main:** Jujutsu shows "Weapon groups: Oriental Blades".
4. **Hints:** equip only the Club and use Locking Block (Clubbing Weapons allowed, group not bought): the card says the Club is not in a learned group. Equip only the Katana and use Pain Touch (clubbing only): "cannot be used with this maneuver". Basic Parry with the Katana shows "Armed with Katana +1."
5. **Bonus:** on a style that offers Karate Weapons learn it, equip a Sai: Basic Parry's breakdown shows Weapon bonus +2.
6. **Weapon Breaker:** with no weapon or an uncovered weapon Use warns it needs a style weapon; with the Katana and Oriental Blades learned it rolls.
7. **Unlearn:** unlock, Unlearn Oriental Blades, confirm: the slot is refunded; a freshly dropped style has none.
8. **Non-GM seat:** a player sees the Features learn/unlearn and the cards identically.
9. **Unchanged:** maneuvers with no weapon equipped post no weapon line and the same numbers as before.

- [ ] **Step 5: Push and open the PR (always push + PR, never ask)**

```bash
git push -u origin feat/sp18d-style-weapons
gh pr create --title "feat(martial-arts): SP18 Plan D - style weapon groups and armed maneuver use (#86)" --body "..."
```
Body: scope (group registry, buy/unlearn with the shared cap, per-maneuver Weapons Allowed data, hints, +2 bonuses, Weapon Breaker gate), "Part of #86 (Mental Resistance saves and All-Around Sight rear AC numbers remain)", rulings (book-faithful: weapon dice never replace damage; "(using shaft)" not enforced; shield +2 out of scope; name-based matching), the test plan and the checklist, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge; ask the user to hand-merge.

---

## Self-Review

**Spec coverage:** data field and fresh reset (Task 2); registry, matching, offered names incl. Kung Fu "any" (Task 1); purchase with the shared cap and refund (Tasks 2, 4); per-maneuver weapons, +2 bonuses and the Weapon Breaker gate (Tasks 3, 5); UI on Features and Main (Task 4); census, proof, CI, README, checklist, PR (Tasks 3, 6). Out-of-scope items (shaft enforcement, shield +2, Steel Cloth, Table 11, specialization on groups, missile groups) are not built.

**Type consistency:** `knownWeaponGroups: {id, level}[]` everywhere (data model, view input, learn/unlearn, actions); `WeaponUseAssessment.state` values match `weaponNote.state` plus `unarmed`/`needsStyleWeapon`, which Task 5 handles separately; view rows `WeaponGroupRow` fields (`id, labelKey, state, reasonKey`) match the templates.
