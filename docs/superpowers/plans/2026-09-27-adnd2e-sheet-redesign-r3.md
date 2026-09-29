# Sheet Redesign R3: Monster NPC Sheet on the Kit (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Monster NPC sheet (the `creature` actor type) on the R1 parchment/maroon kit, shaped like the PC and Character NPC sheets, with tabs Stat Block · Gear · Spells · Notes and an edit lock. Replace the old creature styles.

**Architecture:**
- Pure changes: `buildCreatureSheetContext` gains `lock` (the kit's `lockState`) and `gearSections`.
- The sheet gets its own part templates in `templates/actor/creature/`, built from kit classes. It reuses `pc/tabs.hbs` and the shared `adnd2e.item-controls`.
- Lock and DOM-kit wiring mirror the PC and NPC sheets.
- No data-model or roll-logic change.

**Tech Stack:** TypeScript, Handlebars/ApplicationV2 (Foundry v14.364), SCSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-26-adnd2e-sheet-redesign-design.md` §4.4. See also R1 and R2 plans in `docs/superpowers/plans/`.

## User decisions (2026-09-27)
1. **Match the PC header, not spec §4.4's all-left layout.**
   - The **left column** holds the portrait and a compact stat list: HD, Size, Intelligence, Morale, Magic Resistance and a Movement summary. Their authoring inputs appear only when unlocked.
   - The **header** holds:
     - the name and lock;
     - a size · alignment line;
     - the vitals boxes (HP, AC, THAC0, Move) on the left;
     - the **Saving Throws card** on the right, the same card as on the PC.
2. **No favorites on Monster NPCs.** No ★ and no Favorites panel. The `flags.adnd2e.favorites` flag is never read or written here.
3. **Tabs:**
   - **Stat Block:** stat-block attacks, weapon attacks, special attacks and special defenses, plus an unlock-only "Stat authoring" panel with the THAC0 authoring fields and saves authoring.
   - **Gear:** item tables.
   - **Spells**
   - **Notes:** treasure type, number appearing, XP value and description.

## Global Constraints
- **Foundry v14.364** source (`C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}`) is authoritative. Do not rely on fvtt-types.
- **No data-model or roll-logic change.** Every roll and action keeps its handler: `rollAttack`, `rollWeaponAttack`, `rollSave`, `castMonsterSpell`, `addAttack`, `deleteAttack`, `toggleEquipped`, `editItem`, `deleteItem`. `_onDropItem` (the `monsterDropVerdict` guard) stays unchanged.
- **Leave the PC and Character NPC sheets unchanged.** Do not edit `templates/actor/pc/**`, `templates/actor/npc/**`, `src/sheets/character/**`, `src/sheets/npc/**`, `styles/actor/pc.scss`, `styles/kit/**` or `styles/theme/**`, except where a task explicitly lists one of them.
- **Nothing lost:** every current creature binding must exist in the new creature template set, enforced by a test. The list is in Task 2.
- **Edit lock:**
  - The sheet opens locked. The lock is per viewer, never persisted, and resets in `_onClose`, which is required because v14 caches sheet instances.
  - **Play inputs** stay active while locked: HP value, the equipped checkbox, and every roll/cast.
  - **Unlock-only:** name, size, alignment, AC value, HD fields, fixed HP, THAC0 value and as-fighter-level, movement modes, intelligence, morale, MR, the attack-row inputs with add/delete, saves authoring, treasure type, number appearing, XP value, ✎/🗑, and the enabled prose editors (`disabled=proseDisabled`).
  - A non-editor never sees the lock or ✎/🗑.
- **Prose editors:** use the kit's `.kit-body.pc-editor` wrapper so the R2-fixed sizing applies. Never set `display` on `<prose-mirror>` or `min-height` on `.editor-content`; size only through `--min-height`.
- **Templates compute nothing.** Inside `{{#each}}` and partials, reach root values through `@root.`. All styles are scoped under `.adnd2e.pc-sheet.creature-sheet`, use `--kit-*` tokens, and use no viewport media queries. The sheet's classes are `["adnd2e","sheet","actor","pc-sheet","creature-sheet"]`.
- **Pure zone:** `src/sheets/creature/{context,context-types}.ts` stay at 100% line, statement and function coverage.
- **Commands:** do not run `npm run format`, prettier, `npm install` or `npm update`, and do not touch package files. Implementers never run `npm run build`; the controller builds at Task 4 after re-confirming Foundry is fully quit (`tasklist | grep -c "Foundry Virtual"` prints 0). Read vitest output through `tail` or a redirect, never `| grep`. Working copies are CRLF.
- **Reviews and checks:** the whole-branch review is mandatory (Task 3). The dev-world check is GATED and covers light and dark mode, a GM seat and a non-GM player seat (Task 4). It must include actually typing in each prose editor.

---

### Task 1: Pure context — lock state and gear sections

**Files:** Modify `src/sheets/creature/context-types.ts`, `src/sheets/creature/context.ts`, `tests/sheets/creature/context.test.ts`.

**Interfaces:**
- Consumes `lockState(editable, unlocked): LockState` from `src/sheets/kit/lock.ts`.
- Produces:
  - `CreatureSheetInput.unlocked?: boolean`
  - `CreatureSheetContext.lock: LockState`
  - `CreatureSheetContext.gearSections: CreatureGearSection[]`
  - `export interface CreatureGearSection { id: "weapons" | "armor" | "equipment"; labelKey: string; rows: CreatureSheetContext["gear"] }`

- [ ] **Step 1: Failing tests.** Append to `tests/sheets/creature/context.test.ts`, using its existing `input()` factory:
  ```typescript
  describe("buildCreatureSheetContext — sheet redesign R3", () => {
    const gear: CreatureGearView[] = [
      { id: "w1", name: "Spear", img: "", type: "weapon", quantity: 1, equipped: true, weapon: { category: "melee", magicBonus: 0, damageVsSM: "1d6", damageVsL: "1d8" } },
      { id: "a1", name: "Hide", img: "", type: "armor", quantity: 1, equipped: true },
      { id: "e1", name: "Sack", img: "", type: "equipment", quantity: 2, equipped: false },
      { id: "e2", name: "Coins", img: "", type: "equipment", quantity: 1, equipped: false },
    ];

    it("is locked by default; only an editor can unlock", () => {
      expect(buildCreatureSheetContext(input()).lock).toEqual({ canUnlock: true, unlocked: false });
      expect(buildCreatureSheetContext(input({ unlocked: true })).lock).toEqual({ canUnlock: true, unlocked: true });
      const viewer = input({ unlocked: true, perms: { isGM: false, isOwner: false, editable: false } });
      expect(buildCreatureSheetContext(viewer).lock).toEqual({ canUnlock: false, unlocked: false });
    });

    it("groups gear into weapons / armor / equipment sections in that order, keeping empty sections", () => {
      const c = buildCreatureSheetContext(input({ gear }));
      expect(c.gearSections.map((s) => [s.id, s.labelKey, s.rows.map((r) => r.id)])).toEqual([
        ["weapons", "ADND2E.sheet.kit.sections.weapons", ["w1"]],
        ["armor", "ADND2E.sheet.kit.sections.armor", ["a1"]],
        ["equipment", "ADND2E.sheet.kit.sections.equipment", ["e1", "e2"]],
      ]);
      const empty = buildCreatureSheetContext(input());
      expect(empty.gearSections.map((s) => [s.id, s.rows.length])).toEqual([["weapons", 0], ["armor", 0], ["equipment", 0]]);
    });
  });
  ```
  Add the imports `CreatureGearView` if they aren't already present. Run with a redirect and `tail` → FAIL.
- [ ] **Step 2: Implement.**
  - **context-types.ts:** add `unlocked?: boolean;` to `CreatureSheetInput` with the doc comment `/** sheet redesign R3: the viewer's unlock state (never persisted) */`. Add `lock: LockState;` and `gearSections: CreatureGearSection[];` to `CreatureSheetContext`. Add and export the `CreatureGearSection` interface. Import `LockState` from `../kit/lock`.
  - **context.ts:** compute `const gear = (input.gear ?? []).map(...)`, the existing mapping, once. Reuse it for both `gear` and `gearSections`:
    ```typescript
    const GEAR_SECTIONS = [
      ["weapons", "weapon"],
      ["armor", "armor"],
      ["equipment", "equipment"],
    ] as const;
    // …inside buildCreatureSheetContext:
    gearSections: GEAR_SECTIONS.map(([id, type]) => ({
      id,
      labelKey: `ADND2E.sheet.kit.sections.${id}`,
      rows: gear.filter((g) => g.type === type),
    })),
    lock: lockState(input.perms.editable, input.unlocked === true),
    ```
    Keep every existing field unchanged.
- [ ] **Step 3: Verify.** `npx vitest run tests/sheets/creature` passes. `npm run typecheck`, `npm run lint` and `npm run test:coverage` all exit 0, with the creature context files at 100%.
- [ ] **Step 4: Commit:** `feat(sheets): creature sheet context — lock state and gear sections`, plus the trailer.

---

### Task 2: Monster NPC templates, sheet wiring, styles and the binding test

**Files:**
- Create: `templates/actor/creature/{left,header,statblock,gear,spells,notes}.hbs`
- Delete: `templates/actor/creature/sheet.hbs`
- Modify: `src/sheets/creature/sheet.ts`, `lang/en.json`, `tests/lang/en-coverage.test.ts`
- Replace the contents of `styles/actor/creature.scss`
- Create test: `tests/templates/creature-sheet-bindings.test.ts`

**Interfaces:**
- Consumes from Task 1: `adnd2e.lock` and `adnd2e.gearSections`.
- Consumes from R1/R2: `bindSheetKit` / `clearSheetKit` (`src/sheets/kit-dom.ts`), the `adnd2e.item-controls` partial, the `adnd2eOrDash` and `adnd2eSigned` helpers, `pc/tabs.hbs`, and the kit classes (`kit-bar`, `kit-panel`, `kit-body`, `kit-stat`, `kit-big`, `kit-table`, `kit-head`, `kit-row`, `kit-cells`, `kit-name`, `kit-empty`, `kit-filter`, `kit-lock`, `kit-roll`, `kit-small`, `kit-subhead`, `pc-left`, `pc-header`, `pc-title-row`, `pc-name`, `pc-class-line`, `pc-top`, `pc-top-left`, `pc-vitals`, `pc-saves-card`, `pc-save-row`, `pc-save-label`, `pc-save-value`, `kit-save-roll`, `detail-fields`, `detail-field`, `pc-editor`).

**The creature nothing-lost list** (every binding in the CURRENT `templates/actor/creature/sheet.hbs`):
- `data-action`: `editImage`, `rollAttack`, `deleteAttack`, `addAttack`, `rollWeaponAttack`, `toggleEquipped`, `editItem`, `deleteItem`, `castMonsterSpell`, `rollSave`.
- `name=`:
  - Identity: `name`, `system.details.size`, `system.details.alignment`
  - Vitals: `system.attributes.ac.value`, `system.hd.count`, `system.hd.dieType`, `system.hd.bonus`, `system.hd.fixedHp`, `system.attributes.hp.value`, `system.attributes.thac0.value`, `system.attributes.thac0.asFighterLevel`
  - Movement: `system.attributes.movement.land`, `.burrow`, `.climb`, `.fly`, `.swim`, `.flyManeuverability`
  - Attack rows: `system.attacks.{{@index}}.name`, `.count`, `.damage`, `.type`, `.special`, `.thac0Override`
  - Saves: `system.saves.mode`, `system.saves.explicit.{{row.category}}`, `system.saves.asClass.group`, `system.saves.asClass.level`
  - Details: `system.details.intelligence`, `.morale`, `.magicResistance`, `.treasureType`, `.numberAppearing`, `.xpValue`, `.specialAttacks`, `.specialDefenses`, `.description`

- [ ] **Step 1: Failing binding test.** Create `tests/templates/creature-sheet-bindings.test.ts`:
  ```typescript
  import { describe, expect, it } from "vitest";
  import { existsSync, readFileSync } from "node:fs";
  import path from "node:path";

  const ROOT = path.resolve(__dirname, "..", "..");
  const TPL = path.join(ROOT, "templates");
  const SHEET = readFileSync(path.join(ROOT, "src", "sheets", "creature", "sheet.ts"), "utf8");

  const PART_FILES = [...SHEET.matchAll(/TEMPLATE_PATH\("(actor\/[a-z]+)", "([a-z-]+\.hbs)"\)/g)].map((m) =>
    path.join(TPL, ...m[1]!.split("/"), m[2]!),
  );
  // follow {{> adnd2e.<name>}} includes transitively (pc/partials, then shared/partials)
  function reach(files: string[]): string[] {
    const seen = new Set(files);
    const queue = [...files];
    while (queue.length) {
      const text = readFileSync(queue.shift()!, "utf8");
      for (const m of text.matchAll(/\{\{>\s*adnd2e\.([a-z-]+)/g)) {
        const hit = [path.join(TPL, "actor", "pc", "partials", `${m[1]}.hbs`), path.join(TPL, "actor", "shared", "partials", `${m[1]}.hbs`)].find(existsSync);
        if (!hit) throw new Error(`unresolved partial adnd2e.${m[1]}`);
        if (!seen.has(hit)) { seen.add(hit); queue.push(hit); }
      }
    }
    return [...seen];
  }
  const FILES = reach(PART_FILES);
  const TEMPLATES = FILES.map((f) => readFileSync(f, "utf8")).join("\n");

  const NOTHING_LOST_ACTIONS = ["editImage", "rollAttack", "deleteAttack", "addAttack", "rollWeaponAttack", "toggleEquipped", "editItem", "deleteItem", "castMonsterSpell", "rollSave"];
  const NOTHING_LOST_NAMES = [
    "name", "system.details.size", "system.details.alignment", "system.attributes.ac.value", "system.hd.count", "system.hd.dieType",
    "system.hd.bonus", "system.hd.fixedHp", "system.attributes.hp.value", "system.attributes.thac0.value", "system.attributes.thac0.asFighterLevel",
    "system.attributes.movement.land", "system.attributes.movement.burrow", "system.attributes.movement.climb", "system.attributes.movement.fly",
    "system.attributes.movement.swim", "system.attributes.movement.flyManeuverability",
    "system.attacks.{{@index}}.name", "system.attacks.{{@index}}.count", "system.attacks.{{@index}}.damage", "system.attacks.{{@index}}.type",
    "system.attacks.{{@index}}.special", "system.attacks.{{@index}}.thac0Override",
    "system.saves.mode", "system.saves.explicit.{{row.category}}", "system.saves.asClass.group", "system.saves.asClass.level",
    "system.details.intelligence", "system.details.morale", "system.details.magicResistance", "system.details.treasureType",
    "system.details.numberAppearing", "system.details.xpValue", "system.details.specialAttacks", "system.details.specialDefenses", "system.details.description",
  ].map((n) => `name="${n}"`);
  const CORE_ACTIONS = new Set(["tab", "editImage"]);
  const registered = new Set([...SHEET.matchAll(/^\s+([a-zA-Z]+): Adnd2eCreatureSheet\.#on/gm)].map((m) => m[1]!));

  describe("Monster NPC sheet templates (sheet redesign R3)", () => {
    it("uses the kit part templates", () => {
      expect(PART_FILES.map((f) => path.relative(TPL, f).split(path.sep).join("/")).sort()).toEqual([
        "actor/creature/gear.hbs", "actor/creature/header.hbs", "actor/creature/left.hbs", "actor/creature/notes.hbs",
        "actor/creature/spells.hbs", "actor/creature/statblock.hbs", "actor/pc/tabs.hbs",
      ]);
    });

    it("keep every pre-redesign creature binding (nothing lost)", () => {
      for (const a of NOTHING_LOST_ACTIONS) expect(TEMPLATES, a).toContain(`data-action="${a}"`);
      for (const n of NOTHING_LOST_NAMES) expect(TEMPLATES, n).toContain(n);
    });

    it("every data-action is registered on the creature sheet (or core); lock is wired; no favorites", () => {
      const used = new Set([...TEMPLATES.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!));
      for (const a of used) expect(registered.has(a) || CORE_ACTIONS.has(a), a).toBe(true);
      expect(registered.has("toggleLock")).toBe(true);
      expect(TEMPLATES).not.toContain("toggleFavorite");
      expect(registered.has("toggleFavorite")).toBe(false);
    });
  });
  ```
  Run with a redirect and `tail`. Expect FAIL.

- [ ] **Step 2: Lang.**
  - Add `"statBlock": "Stat Block"`, `"gear": "Gear"` and `"notes": "Notes"` to `ADND2E.sheet.tabs`.
  - Add these to `ADND2E.sheet.creature`: `"statAuthoring": "Stat authoring"`, `"size": "Size"`, `"movementModes": "Movement modes"`, `"stats": "Stats"`. Before adding any of them, check that `ADND2E.sheet.creature` doesn't already have the key.
  - Assert every new key resolves in `tests/lang/en-coverage.test.ts`.

- [ ] **Step 3: Templates.** Create each file exactly as below.

  `templates/actor/creature/left.hbs`:
  ```hbs
  <aside class="pc-left">
    <img class="portrait" src="{{adnd2e.identity.img}}" data-action="editImage" data-edit="img" alt="{{adnd2e.identity.name}}">
    <section class="kit-panel creature-stats">
      <div class="kit-bar">{{localize 'ADND2E.sheet.creature.stats'}}</div>
      <div class="kit-body detail-fields">
        <div class="detail-field">
          <span class="cap">{{localize 'ADND2E.sheet.creature.hd'}}</span>
          {{#if adnd2e.lock.unlocked}}
            <span class="val"><input type="number" name="system.hd.count" value="{{source.system.hd.count}}"> d<input type="number" name="system.hd.dieType" value="{{source.system.hd.dieType}}"> + <input type="number" name="system.hd.bonus" value="{{source.system.hd.bonus}}"></span>
          {{else}}
            <span class="val">{{source.system.hd.count}}d{{source.system.hd.dieType}}{{#if source.system.hd.bonus}} {{adnd2eSigned source.system.hd.bonus}}{{/if}}</span>
          {{/if}}
        </div>
        <div class="detail-field">
          <span class="cap">{{localize 'ADND2E.sheet.creature.fixedHp'}}</span>
          {{#if adnd2e.lock.unlocked}}
            <input type="number" name="system.hd.fixedHp" value="{{source.system.hd.fixedHp}}">
          {{else}}
            <span class="val">{{adnd2eOrDash source.system.hd.fixedHp}}</span>
          {{/if}}
        </div>
        <div class="detail-field">
          <span class="cap">{{localize 'ADND2E.sheet.creature.size'}}</span>
          {{#if adnd2e.lock.unlocked}}
            <select name="system.details.size">{{selectOptions sizes selected=source.system.details.size localize=true}}</select>
          {{else}}
            <span class="val">{{localize (lookup sizes source.system.details.size)}}</span>
          {{/if}}
        </div>
        <div class="detail-field">
          <span class="cap">{{localize 'ADND2E.sheet.creature.intelligence'}}</span>
          {{#if adnd2e.lock.unlocked}}
            <input type="text" name="system.details.intelligence" value="{{source.system.details.intelligence}}">
          {{else}}
            <span class="val">{{adnd2eOrDash source.system.details.intelligence}}</span>
          {{/if}}
        </div>
        <div class="detail-field">
          <span class="cap">{{localize 'ADND2E.sheet.creature.morale'}}</span>
          {{#if adnd2e.lock.unlocked}}
            <input type="number" name="system.details.morale" value="{{source.system.details.morale}}">
          {{else}}
            <span class="val">{{adnd2eOrDash source.system.details.morale}}</span>
          {{/if}}
        </div>
        <div class="detail-field">
          <span class="cap">{{localize 'ADND2E.sheet.creature.magicResistance'}}</span>
          {{#if adnd2e.lock.unlocked}}
            <span class="val"><input type="number" name="system.details.magicResistance" value="{{source.system.details.magicResistance}}">%</span>
          {{else}}
            <span class="val">{{adnd2eOrDash source.system.details.magicResistance}}%</span>
          {{/if}}
        </div>
        <div class="detail-field detail-field-wide">
          <span class="cap">{{localize 'ADND2E.sheet.vitals.movement'}}</span>
          <span class="val">{{adnd2e.vitals.movementSummary}}</span>
        </div>
      </div>
    </section>
    {{#if adnd2e.lock.unlocked}}
      <section class="kit-panel creature-movement">
        <div class="kit-bar">{{localize 'ADND2E.sheet.creature.movementModes'}}</div>
        <div class="kit-body detail-fields">
          <label class="detail-field"><span class="cap">{{localize 'ADND2E.movementModes.land'}}</span><input type="number" name="system.attributes.movement.land" value="{{source.system.attributes.movement.land}}"></label>
          <label class="detail-field"><span class="cap">{{localize 'ADND2E.movementModes.burrow'}}</span><input type="number" name="system.attributes.movement.burrow" value="{{source.system.attributes.movement.burrow}}"></label>
          <label class="detail-field"><span class="cap">{{localize 'ADND2E.movementModes.climb'}}</span><input type="number" name="system.attributes.movement.climb" value="{{source.system.attributes.movement.climb}}"></label>
          <label class="detail-field"><span class="cap">{{localize 'ADND2E.movementModes.fly'}}</span><input type="number" name="system.attributes.movement.fly" value="{{source.system.attributes.movement.fly}}"></label>
          <label class="detail-field"><span class="cap">{{localize 'ADND2E.movementModes.swim'}}</span><input type="number" name="system.attributes.movement.swim" value="{{source.system.attributes.movement.swim}}"></label>
          <label class="detail-field"><span class="cap">{{localize 'ADND2E.sheet.creature.flyManeuverability'}}</span><input type="text" name="system.attributes.movement.flyManeuverability" value="{{source.system.attributes.movement.flyManeuverability}}"></label>
        </div>
      </section>
    {{/if}}
  </aside>
  ```

  `templates/actor/creature/header.hbs`:
  ```hbs
  <header class="pc-header">
    <div class="pc-title-row">
      {{#if adnd2e.lock.unlocked}}
        <input type="text" class="pc-name" name="name" value="{{adnd2e.identity.name}}">
      {{else}}
        <h1 class="pc-name">{{adnd2e.identity.name}}</h1>
      {{/if}}
      {{#if adnd2e.lock.canUnlock}}
        <button type="button" class="kit-lock" data-action="toggleLock" title="{{#if adnd2e.lock.unlocked}}{{localize 'ADND2E.sheet.kit.unlock'}}{{else}}{{localize 'ADND2E.sheet.kit.lock'}}{{/if}}">
          <i class="fa-solid {{#if adnd2e.lock.unlocked}}fa-lock-open{{else}}fa-lock{{/if}}" inert></i>
        </button>
      {{/if}}
    </div>
    <div class="pc-class-line">
      <span class="size">{{localize (lookup sizes source.system.details.size)}}</span>
      {{#if adnd2e.lock.unlocked}}
        <select name="system.details.alignment">{{selectOptions alignments selected=source.system.details.alignment localize=true}}</select>
      {{else}}
        <span class="alignment">{{localize (lookup alignments source.system.details.alignment)}}</span>
      {{/if}}
    </div>
    <div class="pc-top">
      <div class="pc-top-left">
        <div class="pc-vitals">
          <div class="kit-stat"><div class="kit-bar">{{localize 'ADND2E.sheet.vitals.hp'}}</div>
            <span class="kit-big"><input type="number" name="system.attributes.hp.value" value="{{source.system.attributes.hp.value}}"> / {{adnd2e.vitals.hp.max}}</span></div>
          <div class="kit-stat"><div class="kit-bar">{{localize 'ADND2E.sheet.vitals.ac'}}</div>
            <span class="kit-big">{{#if adnd2e.lock.unlocked}}<input type="number" name="system.attributes.ac.value" value="{{source.system.attributes.ac.value}}">{{else}}{{adnd2e.vitals.ac}}{{/if}}</span></div>
          <div class="kit-stat"><div class="kit-bar">{{localize 'ADND2E.sheet.vitals.thac0'}}</div><span class="kit-big">{{adnd2e.vitals.thac0}}</span></div>
          <div class="kit-stat"><div class="kit-bar">{{localize 'ADND2E.sheet.vitals.movement'}}</div><span class="kit-big" title="{{adnd2e.vitals.movementSummary}}">{{source.system.attributes.movement.land}}</span></div>
        </div>
      </div>
      <section class="kit-panel pc-saves-card">
        <div class="kit-bar">{{localize 'ADND2E.sheet.vitals.saves'}}</div>
        <div class="kit-body">
          {{#each adnd2e.saves as |row|}}
            <div class="pc-save-row" data-save="{{row.category}}">
              <span class="pc-save-label">{{localize row.label}}</span>
              <span class="pc-save-value">{{row.target}}</span>
              <button type="button" class="kit-roll kit-save-roll" data-action="rollSave" data-save="{{row.category}}" title="{{localize 'ADND2E.sheet.combat.rollSave'}}"><i class="fa-solid fa-dice-d20" inert></i></button>
            </div>
          {{/each}}
        </div>
      </section>
    </div>
  </header>
  ```

  `templates/actor/creature/statblock.hbs`:
  ```hbs
  <section class="tab statblock{{#if tab.active}} active{{/if}}" data-group="{{tab.group}}" data-tab="{{tab.id}}">

    <section class="kit-panel creature-attacks">
      <div class="kit-bar">{{localize 'ADND2E.sheet.creature.attacks'}}
        {{#if adnd2e.lock.unlocked}}<button type="button" class="kit-small" data-action="addAttack" style="margin-left:auto">{{localize 'ADND2E.sheet.creature.addAttack'}}</button>{{/if}}
      </div>
      <div class="kit-body">
        {{#if adnd2e.lock.unlocked}}
          <div class="attack-row attack-row-header">
            <span>{{localize 'ADND2E.sheet.creature.attackName'}}</span>
            <span>{{localize 'ADND2E.sheet.creature.attackCount'}}</span>
            <span>{{localize 'ADND2E.sheet.creature.attackDamage'}}</span>
            <span>{{localize 'ADND2E.sheet.creature.attackType'}}</span>
            <span>{{localize 'ADND2E.sheet.creature.attackSpecial'}}</span>
            <span>{{localize 'ADND2E.sheet.creature.attackThac0Override'}}</span>
          </div>
          {{#each source.system.attacks as |a|}}
            <div class="attack-row">
              <input type="text" name="system.attacks.{{@index}}.name" value="{{a.name}}">
              <input type="number" name="system.attacks.{{@index}}.count" value="{{a.count}}" min="1">
              <input type="text" name="system.attacks.{{@index}}.damage" value="{{a.damage}}">
              <select name="system.attacks.{{@index}}.type">{{selectOptions @root.attackTypes selected=a.type localize=true}}</select>
              <input type="text" name="system.attacks.{{@index}}.special" value="{{a.special}}">
              <input type="number" name="system.attacks.{{@index}}.thac0Override" value="{{a.thac0Override}}">
              <button type="button" class="kit-roll" data-action="rollAttack" data-attack-index="{{@index}}">{{localize 'ADND2E.sheet.combat.rollAttack'}}</button>
              <button type="button" class="kit-small" data-action="deleteAttack" data-attack-index="{{@index}}">{{localize 'ADND2E.sheet.creature.deleteAttack'}}</button>
            </div>
          {{else}}
            <p class="kit-empty">{{localize 'ADND2E.sheet.creature.noAttacks'}}</p>
          {{/each}}
        {{else}}
          {{#each adnd2e.attacks as |a|}}
            <div class="attack-line">
              <span class="name">{{a.name}}</span>
              <span class="count">×{{a.count}}</span>
              <span class="damage">{{a.damage}}</span>
              <span class="type">{{localize (concat 'ADND2E.attackTypes.' a.type)}}</span>
              {{#if a.special}}<span class="special">{{a.special}}</span>{{/if}}
              <button type="button" class="kit-roll" data-action="rollAttack" data-attack-index="{{a.index}}">{{localize 'ADND2E.sheet.combat.rollAttack'}}</button>
            </div>
          {{else}}
            <p class="kit-empty">{{localize 'ADND2E.sheet.creature.noAttacks'}}</p>
          {{/each}}
        {{/if}}
        {{#if adnd2e.weaponAttacks.length}}
          <h4 class="kit-subhead">{{localize 'ADND2E.sheet.creature.weaponAttacks'}}</h4>
          {{#each adnd2e.weaponAttacks as |wa|}}
            <div class="attack-line weapon-attack" data-item-id="{{wa.id}}">
              <span class="name">{{wa.name}}</span>
              <span class="damage">{{wa.damage}}</span>
              <span class="type">{{localize (concat 'ADND2E.attackTypes.' wa.type)}}</span>
              <button type="button" class="kit-roll" data-action="rollWeaponAttack" data-item-id="{{wa.id}}">{{localize 'ADND2E.sheet.combat.rollAttack'}}</button>
            </div>
          {{/each}}
        {{/if}}
      </div>
    </section>

    <section class="kit-panel">
      <div class="kit-bar">{{localize 'ADND2E.sheet.creature.specialAttacks'}}</div>
      <div class="kit-body pc-editor">
        {{formInput systemFields.details.fields.specialAttacks value=source.system.details.specialAttacks name="system.details.specialAttacks" disabled=proseDisabled}}
      </div>
    </section>

    <section class="kit-panel">
      <div class="kit-bar">{{localize 'ADND2E.sheet.creature.specialDefenses'}}</div>
      <div class="kit-body pc-editor">
        {{formInput systemFields.details.fields.specialDefenses value=source.system.details.specialDefenses name="system.details.specialDefenses" disabled=proseDisabled}}
      </div>
    </section>

    {{#if adnd2e.lock.unlocked}}
      <section class="kit-panel creature-authoring">
        <div class="kit-bar">{{localize 'ADND2E.sheet.creature.statAuthoring'}}</div>
        <div class="kit-body detail-fields">
          <label class="detail-field"><span class="cap">{{localize 'ADND2E.sheet.vitals.thac0'}}</span><input type="number" name="system.attributes.thac0.value" value="{{source.system.attributes.thac0.value}}"></label>
          <label class="detail-field"><span class="cap">{{localize 'ADND2E.sheet.creature.thac0AsFighterLevel'}}</span><input type="number" name="system.attributes.thac0.asFighterLevel" value="{{source.system.attributes.thac0.asFighterLevel}}"></label>
          <label class="detail-field"><span class="cap">{{localize 'ADND2E.sheet.creature.saveMode'}}</span><select name="system.saves.mode">{{selectOptions saveModes selected=source.system.saves.mode localize=true}}</select></label>
          {{#each adnd2e.saves as |row|}}
            <label class="detail-field"><span class="cap">{{localize row.label}}</span><input type="number" name="system.saves.explicit.{{row.category}}" value="{{lookup @root.source.system.saves.explicit row.category}}"></label>
          {{/each}}
          <label class="detail-field"><span class="cap">{{localize 'ADND2E.sheet.creature.saveClassGroup'}}</span><select name="system.saves.asClass.group">{{selectOptions classGroups selected=source.system.saves.asClass.group localize=true blank=""}}</select></label>
          <label class="detail-field"><span class="cap">{{localize 'ADND2E.sheet.creature.saveClassLevel'}}</span><input type="number" name="system.saves.asClass.level" value="{{source.system.saves.asClass.level}}" min="1"></label>
        </div>
      </section>
    {{/if}}

  </section>
  ```
  If `ADND2E.attackTypes.melee` or `ADND2E.attackTypes.ranged` don't exist, check with a quick `node -e` over lang/en.json and use whatever `CONFIG.ADND2E.attackTypes` maps to. Put the same key on both locked and weapon rows (the old template already used `concat 'ADND2E.attackTypes.' wa.type`).

  `templates/actor/creature/gear.hbs`:
  ```hbs
  <section class="tab gear{{#if tab.active}} active{{/if}}" data-group="{{tab.group}}" data-tab="{{tab.id}}">
    <input type="text" class="kit-filter" data-kit-filter="gear" placeholder="{{localize 'ADND2E.sheet.kit.filter'}}">
    <div data-kit-filter-scope="gear">
      {{#each adnd2e.gearSections as |section|}}
        <section class="kit-table" data-kit-section="{{section.id}}" style="--kit-cols: 1fr 60px 90px auto">
          <div class="kit-bar" data-kit-section-toggle><span class="kit-caret"></span>{{localize section.labelKey}} ({{section.rows.length}})</div>
          <div class="kit-rows">
            <div class="kit-head"><span>{{localize 'ADND2E.sheet.kit.cols.name'}}</span><span>{{localize 'ADND2E.sheet.kit.cols.qty'}}</span><span>{{localize 'ADND2E.sheet.kit.cols.equipped'}}</span><span></span></div>
            {{#each section.rows as |g|}}
              <div class="kit-row" data-kit-row data-kit-name="{{g.name}}" data-item-id="{{g.id}}">
                <div class="kit-cells">
                  <span class="kit-name">{{#if g.img}}<img src="{{g.img}}" alt="">{{/if}}{{g.name}}</span>
                  <span>×{{g.quantity}}</span>
                  <span><input type="checkbox" data-action="toggleEquipped" data-item-id="{{g.id}}" {{checked g.equipped}}{{#unless @root.editable}} disabled{{/unless}}></span>
                  <span class="kit-row-actions">{{#if @root.adnd2e.lock.unlocked}}{{> adnd2e.item-controls id=g.id deletable=true}}{{/if}}</span>
                </div>
              </div>
            {{else}}
              <p class="kit-empty">{{localize 'ADND2E.sheet.creature.noGear'}}</p>
            {{/each}}
          </div>
        </section>
      {{/each}}
    </div>
  </section>
  ```

  `templates/actor/creature/spells.hbs`:
  ```hbs
  <section class="tab spells{{#if tab.active}} active{{/if}}" data-group="{{tab.group}}" data-tab="{{tab.id}}">
    <section class="kit-panel">
      <div class="kit-bar">{{localize 'ADND2E.sheet.creature.spells'}}</div>
      <div class="kit-body">
        {{#each adnd2e.spells as |grp|}}
          <h4 class="kit-subhead">{{localize 'ADND2E.sheet.spells.level' level=grp.level}}</h4>
          {{#each grp.items as |s|}}
            <div class="spell-row" data-item-id="{{s.id}}">
              <span class="name">{{s.name}}</span>
              <button type="button" class="kit-roll" data-action="castMonsterSpell" data-item-id="{{s.id}}">{{localize 'ADND2E.sheet.creature.cast'}}</button>
              {{#if @root.adnd2e.lock.unlocked}}{{> adnd2e.item-controls id=s.id deletable=true}}{{/if}}
            </div>
          {{/each}}
        {{else}}
          <p class="kit-empty">{{localize 'ADND2E.sheet.creature.noSpells'}}</p>
        {{/each}}
      </div>
    </section>
  </section>
  ```

  `templates/actor/creature/notes.hbs`:
  ```hbs
  <section class="tab notes{{#if tab.active}} active{{/if}}" data-group="{{tab.group}}" data-tab="{{tab.id}}">
    <section class="kit-panel">
      <div class="kit-bar">{{localize 'ADND2E.sheet.kit.details'}}</div>
      <div class="kit-body detail-fields">
        <div class="detail-field">
          <span class="cap">{{localize 'ADND2E.sheet.creature.treasureType'}}</span>
          {{#if adnd2e.lock.unlocked}}<input type="text" name="system.details.treasureType" value="{{source.system.details.treasureType}}">{{else}}<span class="val">{{adnd2eOrDash source.system.details.treasureType}}</span>{{/if}}
        </div>
        <div class="detail-field">
          <span class="cap">{{localize 'ADND2E.sheet.creature.numberAppearing'}}</span>
          {{#if adnd2e.lock.unlocked}}<input type="text" name="system.details.numberAppearing" value="{{source.system.details.numberAppearing}}">{{else}}<span class="val">{{adnd2eOrDash source.system.details.numberAppearing}}</span>{{/if}}
        </div>
        <div class="detail-field">
          <span class="cap">{{localize 'ADND2E.sheet.creature.xpValue'}}</span>
          {{#if adnd2e.lock.unlocked}}<input type="number" name="system.details.xpValue" value="{{source.system.details.xpValue}}">{{else}}<span class="val">{{adnd2eOrDash source.system.details.xpValue}}</span>{{/if}}
        </div>
      </div>
    </section>
    <section class="kit-panel">
      <div class="kit-bar">{{localize 'ADND2E.sheet.creature.description'}}</div>
      <div class="kit-body pc-editor">
        {{formInput systemFields.details.fields.description value=source.system.details.description name="system.details.description" disabled=proseDisabled}}
      </div>
    </section>
  </section>
  ```

  Delete `templates/actor/creature/sheet.hbs` with `git rm`.

- [ ] **Step 4: Sheet wiring** (`src/sheets/creature/sheet.ts`).
  - Set `classes` to `["adnd2e", "sheet", "actor", "pc-sheet", "creature-sheet"]` and `position` to `{ width: 1045, height: 960 }`. Replace the old size comment with one line saying the size matches the PC/NPC kit sheets.
  - Add `toggleLock: Adnd2eCreatureSheet.#onToggleLock` to `actions` and keep every existing action.
  - Replace `PARTS`, add `TABS`, delete the `T` helper, and add `_preparePartContext` exactly as in `src/sheets/npc/sheet.ts`, which sets `ctx.tab` from `ctx.tabs`:
    ```typescript
    static PARTS = {
      left: { template: TEMPLATE_PATH("actor/creature", "left.hbs") },
      header: { template: TEMPLATE_PATH("actor/creature", "header.hbs") },
      tabs: { template: TEMPLATE_PATH("actor/pc", "tabs.hbs") },
      statblock: { template: TEMPLATE_PATH("actor/creature", "statblock.hbs"), scrollable: [""] },
      gear: { template: TEMPLATE_PATH("actor/creature", "gear.hbs"), scrollable: [""] },
      spells: { template: TEMPLATE_PATH("actor/creature", "spells.hbs"), scrollable: [""] },
      notes: { template: TEMPLATE_PATH("actor/creature", "notes.hbs"), scrollable: [""] },
    };

    static TABS = {
      primary: {
        initial: "statblock",
        labelPrefix: "ADND2E.sheet.tabs",
        tabs: [
          { id: "statblock", label: "ADND2E.sheet.tabs.statBlock", icon: "fa-solid fa-dragon" },
          { id: "gear", icon: "fa-solid fa-box-open" },
          { id: "spells", icon: "fa-solid fa-wand-sparkles" },
          { id: "notes", icon: "fa-solid fa-book" },
        ],
      },
    };
    ```
    Tab ids must be lowercase because the `data-tab` part names are. `statblock` gets an explicit `label` since its i18n key is camelCase. Check v14 `_prepareTabs` in `client/applications/api/application.mjs` to confirm an explicit `label` overrides `labelPrefix`. If it doesn't, rename the lang key to `ADND2E.sheet.tabs.statblock` and drop the `label`.
  - Add `_preparePartContext(partId, context, options)` and `_onClose(options): void` to the `Base` member list. Add `render(options?: unknown): Promise<unknown>` too, if typecheck needs it.
  - Add the field `#unlocked = false;` and the getter `get #sheetKitKey(): string { return \`creature-${(this.document as unknown as { id: string }).id}\`; }`.
  - In `_prepareContext`, add `context.proseDisabled = !this.isEditable || !this.#unlocked;`. In `#buildInput`, add `unlocked: this.#unlocked,`.
  - Add the overrides:
    ```typescript
    override async _onRender(context: unknown, options: unknown): Promise<void> {
      await super._onRender(context, options);
      bindSheetKit(this.element, this.#sheetKitKey);
    }

    override _onClose(options: unknown): void {
      super._onClose(options);
      this.#unlocked = false;
      clearSheetKit(this.#sheetKitKey);
    }

    static async #onToggleLock(this: Adnd2eCreatureSheet): Promise<void> {
      if (!this.isEditable) return;
      this.#unlocked = !this.#unlocked;
      await this.render();
    }
    ```
    Import `bindSheetKit` and `clearSheetKit` from `../kit-dom`.
  - Guard the authoring handlers on `isEditable`: `#onAddAttack` and `#onDeleteAttack` should return early when `!this.isEditable`, matching `#onToggleEquipped`.
  - Refresh the class header comment. It is no longer a single page: describe the kit layout with 4 tabs and a lock.

- [ ] **Step 5: Styles.** Replace ALL of `styles/actor/creature.scss` with kit-scoped rules. Keep `@use "actor/creature";` in system.scss.
  ```scss
  // Monster NPC sheet on the parchment kit (sheet redesign R3). Layout, bars,
  // tables, header and saves card come from styles/kit + styles/actor/pc.scss
  // (the sheet carries the `pc-sheet` class); only creature-specific rows here.
  .adnd2e.pc-sheet.creature-sheet {
    .attack-row {
      display: grid;
      grid-template-columns: minmax(0, 2fr) 3.5rem minmax(0, 1.5fr) 6rem minmax(0, 2fr) 4.5rem auto auto;
      gap: 4px;
      align-items: center;
      padding: 2px 0;
      border-bottom: 1px solid var(--kit-row-rule);
      input, select { width: 100%; min-width: 0; }
    }
    .attack-row-header { font-size: 11px; font-weight: 700; color: var(--kit-muted); }
    .attack-line, .spell-row {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      padding: 3px 4px; border-bottom: 1px solid var(--kit-row-rule);
      .name { flex: 1 1 auto; min-width: 0; font-weight: 700; }
      .special { color: var(--kit-muted); font-size: 12px; }
    }
    .creature-stats .detail-field-wide { grid-column: 1 / -1; }
    .creature-stats input[type="number"] { width: 48px; }
  }
  ```

- [ ] **Step 6: Verify.**
  - `npx vitest run tests/templates tests/sheets tests/lang` passes.
  - `npm run typecheck`, `npm run lint` and `npm run test:coverage` all exit 0.
  - Run the sass check: `npx sass --no-source-map styles/system.scss "$TEMP/adnd2e-check.css"`, then delete the output file.
  - Check `git diff --stat`: nothing changed under `templates/actor/pc/`, `templates/actor/npc/`, `src/sheets/character/`, `src/sheets/npc/`, `styles/kit/`, `styles/theme/` or `styles/actor/pc.scss`.
- [ ] **Step 7: Commit:** `feat(sheets): Monster NPC sheet on the parchment kit — header, stat list, four tabs and edit lock`, followed by the trailer.

---

### Task 3: Whole-branch review (MANDATORY)

Run on the most capable model over base..HEAD, with this plan, the spec and this risk list:
- **Nothing lost:** the automated test passes. Also walk the old `git show <base>:templates/actor/creature/sheet.hbs` by hand, checking every visible datum and control:
  - identity: name, size, alignment
  - vitals: AC, HD (count, die, bonus), fixed HP, HP value/max, THAC0 (authored and effective), as-fighter-level, the movement summary and all six movement inputs
  - attacks: every stat-block attack field, add/delete/roll, and weapon attacks with roll
  - gear: name, quantity, equipped toggle, ✎/🗑
  - spells by level: cast, ✎/🗑
  - saves: roll per category, plus saves authoring (mode, explicit values, class group and level)
  - details: intelligence, morale, MR, treasure type, number appearing, XP value
  - the three prose fields
- **Lock:**
  - The sheet opens locked and resets on close (`super` is called first).
  - `toggleLock` does nothing unless the sheet is editable.
  - Every unlock-only input from the Global Constraints list is gated, and every play input stays available.
  - `add`/`deleteAttack` are guarded on `isEditable`.
  - `proseDisabled` is correct.
  - A non-editor sees no lock and no ✎/🗑.
- **Monster data correctness:**
  - The locked attack view indexes rolls by `a.index` from the pure context, which must equal the source array index.
  - The HP input binds `source`, not a derived value.
  - AC shows the authored value, and the effective THAC0 shows derived.
  - Check each against `src/data/actor/creature.ts` to see what `system.attributes.thac0.value` means after derivation.
- **Tabs:** v14 `_prepareTabs`/`_preparePartContext` gives each tab part its `tab`, the `statblock` label resolves, and `tabs.hbs` highlights the active tab.
- **PC and Character NPC unaffected:** check the untouched paths. `pc/tabs.hbs` is reused read-only.
- **Styles:** the old `.adnd2e.sheet.creature` rules are gone, the new ones are scoped `.adnd2e.pc-sheet.creature-sheet`, and there are no viewport media queries. Prose editors use `.pc-editor` and never override `display` or `min-height` on prose-mirror internals.
- Re-run tests, typecheck and lint; all must pass.

Make one fix wave for Critical and Important findings, then a scoped re-review.

---

### Task 4: GATED dev-world check (light and dark mode, GM and player seat)

First confirm Foundry is fully quit (`tasklist | grep -c "Foundry Virtual"` prints 0). Then `npm run build`, `npm run link`, and relaunch.

Use a Monster NPC with:
- stat-block attacks;
- an equipped weapon and other gear;
- a spell;
- some movement modes;
- saves set to "as class" on one monster and "explicit" on another.

- [ ] **Look:** the sheet has the parchment kit, a left column (portrait plus the stat list), a header (name, size · alignment, the HP/AC/THAC0/Move boxes and the Saving Throws card), and the tabs Stat Block · Gear · Spells · Notes. Check it in light and dark mode.
- [ ] **Lock:**
  - It opens locked, showing read-only stats, attack lines and gear. There are no ✎/🗑, no Add Attack and no authoring panel.
  - Unlock it. Every authoring input appears: name, alignment, AC, HD, fixed HP, size, intelligence, morale, MR, the movement modes panel, the attack rows with Add/Delete, the THAC0 and saves authoring panel, and treasure / number appearing / XP.
  - Close and reopen: it is locked again.
- [ ] **Nothing lost:**
  - Roll each save and each stat-block attack, both locked and unlocked.
  - Roll a weapon attack.
  - Toggle equipped while locked.
  - Cast a spell.
  - Use ✎/🗑 on gear and on a spell.
  - Add and delete an attack.
  - Edit HP while locked.
  - Change the saves mode, and check that the card values update.
  - Change movement, and check that the summary updates.
- [ ] **Prose editors:** unlocked, TYPE in Special Attacks, Special Defenses and Description. The text must persist after closing and reopening. Locked, they must be read-only. In dark mode the toolbar must be readable.
- [ ] **Gear tab:** sections collapse, the filter narrows rows, and the filter survives an equip toggle.
- [ ] **Drops:** dropping a class or trait is rejected with a toast. Dropping a weapon, armor, equipment or spell is accepted.
- [ ] **PC and Character NPC unchanged:** spot-check both sheets.
- [ ] **Player seat:**
  - An owning player can use the lock and every play action.
  - A non-owner observer gets a read-only sheet with no lock and no ✎/🗑.
- [ ] Report PASS/FAIL via `AskUserQuestion`.

## After this plan lands
Push and open a PR (the standing default). That completes the sheet redesign, R1–R3. Add any leftover follow-ups to the README backlog.
