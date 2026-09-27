# Sheet Redesign R2: Character NPC Sheet on the Kit (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Character NPC sheet (`npc` actor type) on the R1 parchment/maroon kit. It gets the same left column and header as the PC and four tabs: Main, Inventory, Spells and Journal. Then delete the pre-redesign character templates and styles, which nothing will use any more.

**Architecture:**
- The R1 PC templates become the shared source. PC-only buttons get a root-context flag, `pcActions`, which is `true` on the PC sheet and absent on the NPC sheet. The PC-only buttons are Award XP, dual-class, sub-ability seeding, thief-point allocation and traits.
- Panels that both sheets need are extracted into partials.
- The NPC sheet reuses the PC left column, header, tab strip, inventory and spells templates by path. It adds its own `main.hbs` and `journal.hbs`, composed from the shared partials.
- There is no pure-logic change. `buildCharacterSheetContext` is already shared and already produces every field needed.

**Tech Stack:** TypeScript, Handlebars/ApplicationV2 (Foundry v14.364), SCSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-26-adnd2e-sheet-redesign-design.md` §4.3. R1 plan: `docs/superpowers/plans/2026-09-26-adnd2e-sheet-redesign-r1.md`.

## User decisions (2026-09-27)
1. **PC-only actions stay PC-only.** The Character NPC sheet does NOT show Award XP, the dual-class toggle, thief-skill point allocate/deallocate, sub-ability seeding, or the traits panel (`removeTrait`), which is today's NPC behaviour. The NPC sheet still rejects trait drops.
2. **NPC tabs: Main · Inventory · Spells · Journal.**
   - **Main:** favorites, casting panel, attacks, armor + AC breakdown, and a proficiencies block covering weapon, non-weapon and thief rolls, with no allocation buttons.
   - **Journal:** an NPC panel (morale, XP value, disposition), then features, racial abilities, languages, resources, details, biography, campaign notes and GM notes.
   - The left column (portrait + abilities) and the header (Classes, vitals, Saving Throws card) are identical to the PC sheet.

## Global Constraints
- The **Foundry v14.364** source (`C:\Program Files\Foundry Virtual Tabletop\resources\app\{client,common}`) is authoritative. Never rely on fvtt-types.
- **No game-logic, data-model or pure-context change.** The only persisted data is the existing owner-written `flags.adnd2e.favorites`.
- **The PC sheet must look and behave exactly as it does after R1**, including the dev-world-tuned sizes: 1045×960, a 230px left column, a 465px classes panel and the saves card. Task 1 is a refactor with no PC change.
- **The Monster NPC (`creature`) sheet must render and behave exactly as before.** It uses the `adnd2e.item-controls` and `adnd2e.slot-table` partials. Those move to `templates/actor/shared/partials/` and keep their partial ids.
- **Nothing lost:** every current NPC binding (the list in Task 2) must exist in the new NPC template set, enforced by a test.
- **PC-only actions** (`awardXp`, `toggleDualClass`, `seedSubAbilities`, `allocateThiefSkillPoint`, `deallocateThiefSkillPoint`, `removeTrait`) are rendered only inside `{{#if @root.pcActions}}` gates. The NPC sheet never registers them, and they must never appear in `templates/actor/npc/**`.
- **Edit lock and favorites work on the NPC sheet exactly as on the PC:**
  - The sheet opens locked. The lock is per viewer and resets in `_onClose`.
  - Play inputs work while locked: HP, currency, equipped, item location, and every roll or cast.
  - Only owners see stars.
- **The NPC's own fields** (`system.npc.morale`, `system.npc.xpValue`, `system.npc.disposition`) are structural and shown as inputs only when unlocked; otherwise they're read-only text.
- **Templates compute nothing.** Root references inside `{{#each}}` and partials use `@root.`. All styles are scoped to `.adnd2e.pc-sheet`, use `--kit-*` tokens, and use no viewport media queries. The NPC sheet uses the `pc-sheet` class.
- Don't run `npm run format`, `prettier`, `npm install` or `npm update`, and don't touch package files.
  - Implementers never run `npm run build`. The controller builds at Task 5, after re-confirming Foundry is fully quit, including the tray: check with `tasklist | grep "Foundry Virtual"`.
  - Read vitest output through `tail` or a redirect, never `| grep`.
  - Working copies are CRLF.
- A whole-branch review is mandatory (Task 4). The dev-world check is GATED and covers light and dark mode, from a GM seat and a non-GM player seat (Task 5).

---

### Task 1: Shared-template refactor on the PC sheet (no visible change)

**Files:**
- Move (`git mv`): `templates/actor/character/partials/item-controls.hbs` → `templates/actor/shared/partials/item-controls.hbs`; `templates/actor/character/partials/slot-table.hbs` → `templates/actor/shared/partials/slot-table.hbs`
- Create: `templates/actor/pc/partials/pc-main-panels.hbs`, `pc-proficiency-panels.hbs`, `pc-feature-panels.hbs`, `pc-journal-panels.hbs`
- Modify: `templates/actor/pc/{main,proficiencies,features,journal,header,left}.hbs`, `src/sheets/handlebars.ts`, `src/sheets/character/sheet.ts`
- Create: `src/sheets/kit-actions.ts`
- Modify test: `tests/templates/pc-sheet-bindings.test.ts`

**Interfaces — Produces:**
- The partials `adnd2e.pc-main-panels`, `adnd2e.pc-proficiency-panels`, `adnd2e.pc-feature-panels` and `adnd2e.pc-journal-panels`. Each renders against the caller's root context.
- A root context flag `pcActions: boolean`, set to `true` by `Adnd2eCharacterSheet._prepareContext`.
- `toggleFavoriteFlag(actor: unknown, target: HTMLElement): Promise<void>` in `src/sheets/kit-actions.ts`.

- [ ] **Step 1: Move the two shared partials.**
  - `git mv` both files into `templates/actor/shared/partials/`.
  - In `src/sheets/handlebars.ts` `PARTIALS`, change their paths to `"actor/shared/partials/item-controls.hbs"` and `"actor/shared/partials/slot-table.hbs"`. The partial ids come from the file names, so they stay `adnd2e.item-controls` and `adnd2e.slot-table`, and the creature sheet is unaffected.
  - In `tests/templates/pc-sheet-bindings.test.ts`, change the `item-controls.hbs` read path to `templates/actor/shared/partials/item-controls.hbs`.
- [ ] **Step 2: Extract the panels into partials.** This is a cut-and-paste of the inner content: keep the markup byte-identical, including every `@root.`.
  - `pc-main-panels.hbs` holds everything *inside* `<section class="tab main …">` in `main.hbs`: the favorites panel, casting panel, attacks panel and armor panel. `main.hbs` becomes:
    ```hbs
    <section class="tab main{{#if tab.active}} active{{/if}}" data-group="{{tab.group}}" data-tab="{{tab.id}}">
      {{> adnd2e.pc-main-panels}}
    </section>
    ```
  - `pc-proficiency-panels.hbs` holds the inner content of `proficiencies.hbs` (the weapon, non-weapon and thief panels). `proficiencies.hbs` wraps `{{> adnd2e.pc-proficiency-panels}}` in its tab section the same way.
  - `pc-feature-panels.hbs` holds the inner content of `features.hbs` (features list, traits, racial, languages, resources), wrapped the same way.
  - `pc-journal-panels.hbs` holds the inner content of `journal.hbs` (details, biography, campaign notes, GM notes), wrapped the same way.
  - Register all four in `PARTIALS` (`"actor/pc/partials/pc-main-panels.hbs"`, and so on).
  - Partials without a hash inherit the caller's context. In a tab part that context is the root, so `tab`, `adnd2e`, `source`, `systemFields`, `proseDisabled` and `alignments` all resolve unchanged.
- [ ] **Step 3: Gate the PC-only actions on `@root.pcActions`.**
  - In `header.hbs`, wrap the `awardXp` button and the whole `dualClassToggle` block in `{{#if @root.pcActions}}…{{/if}}`. The dual-class block keeps its existing `{{#if adnd2e.lock.unlocked}}` gate inside.
  - In `left.hbs`, change the seed gate to `{{#if @root.pcActions}}{{#if adnd2e.lock.unlocked}}{{#if adnd2e.subAbilities.canSeed}}…{{/if}}{{/if}}{{/if}}`.
  - In `pc-proficiency-panels.hbs`, wrap the `deallocateThiefSkillPoint` and `allocateThiefSkillPoint` buttons in `{{#if @root.pcActions}}…{{/if}}`.
  - In `pc-feature-panels.hbs`, wrap the whole traits `section` in `{{#if @root.pcActions}}…{{/if}}`, outside its existing `{{#if adnd2e.traits.enabled}}`.
  - In `src/sheets/character/sheet.ts` `_prepareContext`, add `context.pcActions = true;` next to `context.proseDisabled`.
- [ ] **Step 4: Shared favorite-toggle glue.** Create `src/sheets/kit-actions.ts` with the body of `Adnd2eCharacterSheet.#onToggleFavorite`, so the NPC sheet can reuse it:
  ```typescript
  // Sheet-kit action glue shared by the PC and Character NPC sheets (sheet redesign R2).
  // Foundry-coupled (reads/writes actor flags) — verified in the dev world.
  import { SYSTEM_ID } from "../constants";
  import { normalizeFavorites, toggleFavoriteList, type FavoriteKind } from "./kit/favorites";

  /** ★ toggle: owner-only; `data-kind` + `data-id` on the clicked button. */
  export async function toggleFavoriteFlag(document: unknown, target: HTMLElement): Promise<void> {
    const actor = document as {
      isOwner: boolean;
      getFlag(scope: string, key: string): unknown;
      setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
    };
    const kind = target.dataset.kind as FavoriteKind | undefined;
    const id = target.dataset.id;
    if (!actor.isOwner || !kind || !id) return;
    const current = normalizeFavorites(actor.getFlag(SYSTEM_ID, "favorites"));
    await actor.setFlag(SYSTEM_ID, "favorites", toggleFavoriteList(current, { kind, id }));
  }
  ```
  Then change `#onToggleFavorite` in `character/sheet.ts` to `await toggleFavoriteFlag(this.document, target);`, and remove any imports that become unused.
- [ ] **Step 5: PC-only gating test.** Append this to `tests/templates/pc-sheet-bindings.test.ts`, keeping all existing tests:
  ```typescript
  const PC_ONLY_ACTIONS = ["awardXp", "toggleDualClass", "seedSubAbilities", "allocateThiefSkillPoint", "deallocateThiefSkillPoint", "removeTrait"];

  describe("PC-only actions (sheet redesign R2)", () => {
    it("every PC template that renders a PC-only action gates it on @root.pcActions", () => {
      for (const file of allHbs(PC_DIR)) {
        const text = readFileSync(file, "utf8");
        const used = PC_ONLY_ACTIONS.filter((a) => text.includes(`data-action="${a}"`));
        if (used.length) expect(text, `${file} renders ${used.join(", ")}`).toContain("@root.pcActions");
      }
    });
    it("the PC sheet sets pcActions", () => {
      expect(SHEET).toMatch(/context\.pcActions = true;/);
    });
  });
  ```
- [ ] **Step 6: Verify.**
  - Run `npx vitest run tests/templates tests/sheets` and confirm it passes.
  - Run `npm run typecheck`, `npm run lint` and `npm run test:coverage`; all must exit 0.
  - Run `npx sass --no-source-map styles/system.scss "$TEMP/adnd2e-check.css"`, confirm it's clean, then delete the output.
  - Check with `git diff --stat` that nothing under `templates/actor/creature/`, `templates/actor/npc/`, `src/sheets/npc/` or `src/sheets/creature/` changed.
  - Check with grep that no template other than the moved files references `actor/character/partials/item-controls` or `actor/character/partials/slot-table`.
- [ ] **Step 7: Commit:** `refactor(sheets): shared kit partials and pcActions gate for the NPC sheet`, followed by the trailer.

---

### Task 2: Character NPC sheet on the kit

**Files:**
- Create: `templates/actor/npc/main.hbs` (replacing the old file), `templates/actor/npc/journal.hbs`
- Delete: `templates/actor/npc/details.hbs`
- Modify: `src/sheets/npc/sheet.ts`, `lang/en.json`, `tests/lang/en-coverage.test.ts`
- Create test: `tests/templates/npc-sheet-bindings.test.ts`

**Interfaces — Consumes:** from Task 1, the partials `adnd2e.pc-main-panels`, `adnd2e.pc-proficiency-panels`, `adnd2e.pc-feature-panels` and `adnd2e.pc-journal-panels`, the `pcActions` gates, and `toggleFavoriteFlag`. From R1: `bindSheetKit`/`clearSheetKit` (`src/sheets/kit-dom.ts`) and the `buildCharacterSheetContext` inputs `unlocked?` / `favorites?`.

**The NPC nothing-lost list.** This is every binding in the CURRENT NPC template set: npc/main, npc/details, the character header and spells, and the character partials.
- `data-action`: `editImage`, `editItem`, `deleteItem`, `rollHp`, `takeAverageHp`, `rollSave`, `rollAttack`, `advanceWeaponMastery`, `rollNonweaponCheck`, `rollThiefSkill`, `restSpellcasting`, `learnSpell`, `memorizeSpell`, `forgetSpell`, `castSpell`, `completeCasting`, `disruptCasting`, `cancelCasting`.
- `name=`:
  - `name`, `system.details.alignment`
  - `system.npc.morale`, `system.npc.xpValue`, `system.npc.disposition`
  - `system.abilities.{{row.key}}.score`, `system.abilities.str.exceptional`
  - `system.attributes.hp.value`, `system.attributes.hp.temp`
  - `system.currency.pp`, `.gp`, `.ep`, `.sp`, `.cp`
  - `system.resources.reputation`, `.henchmen`, `.followers`
  - `system.details.{{field}}`, `system.biography`, `system.details.campaignNotes`, `system.details.gmNotes`
- `data-field`: `quantity`, `location`, `equipped`, `identified`.
- DOM contract: `.weapon-row` containing `.backstab-toggle` and `.maneuver-select`.

- [ ] **Step 1: Failing binding test.** Create `tests/templates/npc-sheet-bindings.test.ts`:
  ```typescript
  import { describe, expect, it } from "vitest";
  import { readdirSync, readFileSync, statSync } from "node:fs";
  import path from "node:path";

  const ROOT = path.resolve(__dirname, "..", "..");
  const TPL = path.join(ROOT, "templates");
  const SHEET = readFileSync(path.join(ROOT, "src", "sheets", "npc", "sheet.ts"), "utf8");

  function allHbs(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = path.join(dir, f);
      return statSync(p).isDirectory() ? allHbs(p) : p.endsWith(".hbs") ? [p] : [];
    });
  }

  // The NPC sheet's PARTS templates (parsed from sheet.ts) + every partial they can reach.
  const PART_FILES = [...SHEET.matchAll(/TEMPLATE_PATH\("(actor\/[a-z]+)", "([a-z-]+\.hbs)"\)/g)].map((m) =>
    path.join(TPL, ...m[1]!.split("/"), m[2]!),
  );
  const PARTIAL_FILES = [...allHbs(path.join(TPL, "actor", "pc", "partials")), ...allHbs(path.join(TPL, "actor", "shared", "partials"))];
  const FILES = [...PART_FILES, ...PARTIAL_FILES];
  const TEMPLATES = FILES.map((f) => readFileSync(f, "utf8")).join("\n");

  const NOTHING_LOST_ACTIONS = [
    "editImage", "editItem", "deleteItem", "rollHp", "takeAverageHp", "rollSave", "rollAttack", "advanceWeaponMastery",
    "rollNonweaponCheck", "rollThiefSkill", "restSpellcasting", "learnSpell", "memorizeSpell", "forgetSpell", "castSpell",
    "completeCasting", "disruptCasting", "cancelCasting",
  ];
  const NOTHING_LOST_NAMES = [
    'name="name"', 'name="system.details.alignment"', 'name="system.npc.morale"', 'name="system.npc.xpValue"',
    'name="system.npc.disposition"', 'name="system.abilities.{{row.key}}.score"', 'name="system.abilities.str.exceptional"',
    'name="system.attributes.hp.value"', 'name="system.attributes.hp.temp"', 'name="system.currency.pp"',
    'name="system.currency.gp"', 'name="system.currency.ep"', 'name="system.currency.sp"', 'name="system.currency.cp"',
    'name="system.resources.reputation"', 'name="system.resources.henchmen"', 'name="system.resources.followers"',
    'name="system.details.{{field}}"', 'name="system.biography"', 'name="system.details.campaignNotes"',
    'name="system.details.gmNotes"',
  ];
  const NOTHING_LOST_FIELDS = ['data-field="quantity"', 'data-field="location"', 'data-field="equipped"', 'data-field="identified"'];
  const PC_ONLY_ACTIONS = ["awardXp", "toggleDualClass", "seedSubAbilities", "allocateThiefSkillPoint", "deallocateThiefSkillPoint", "removeTrait"];
  const CORE_ACTIONS = new Set(["tab", "editImage"]);
  const registered = new Set([...SHEET.matchAll(/^\s+([a-zA-Z]+): Adnd2eNpcSheet\.#on/gm)].map((m) => m[1]!));

  describe("Character NPC sheet templates (sheet redesign R2)", () => {
    it("uses the kit part templates", () => {
      expect(PART_FILES.map((f) => path.relative(TPL, f).split(path.sep).join("/")).sort()).toEqual(
        ["actor/npc/journal.hbs", "actor/npc/main.hbs", "actor/pc/header.hbs", "actor/pc/inventory.hbs", "actor/pc/left.hbs", "actor/pc/spells.hbs", "actor/pc/tabs.hbs"],
      );
    });

    it("keep every pre-redesign NPC binding (nothing lost)", () => {
      for (const a of NOTHING_LOST_ACTIONS) expect(TEMPLATES, a).toContain(`data-action="${a}"`);
      for (const n of NOTHING_LOST_NAMES) expect(TEMPLATES, n).toContain(n);
      for (const f of NOTHING_LOST_FIELDS) expect(TEMPLATES, f).toContain(f);
      expect(TEMPLATES).toContain('class="weapon-row');
      expect(TEMPLATES).toContain('class="backstab-toggle"');
      expect(TEMPLATES).toContain('class="maneuver-select"');
    });

    it("every non-PC-only data-action is registered on the NPC sheet (or core); favorite actions too", () => {
      const used = new Set([...TEMPLATES.matchAll(/data-action="([a-zA-Z]+)"/g)].map((m) => m[1]!));
      for (const a of used) {
        if (PC_ONLY_ACTIONS.includes(a)) continue;
        expect(registered.has(a) || CORE_ACTIONS.has(a), a).toBe(true);
      }
      const favSrc = readFileSync(path.join(ROOT, "src", "sheets", "kit", "favorites.ts"), "utf8");
      const union = favSrc.match(/action:\s*([^;]+);/)![1]!;
      for (const m of union.matchAll(/"([a-zA-Z]+)"/g)) expect(registered.has(m[1]!), m[1]!).toBe(true);
      expect(registered.has("toggleLock") && registered.has("toggleFavorite")).toBe(true);
    });

    it("never registers or renders PC-only actions ungated", () => {
      for (const a of PC_ONLY_ACTIONS) expect(registered.has(a), a).toBe(false);
      for (const f of FILES) {
        const text = readFileSync(f, "utf8");
        const used = PC_ONLY_ACTIONS.filter((a) => text.includes(`data-action="${a}"`));
        if (!used.length) continue;
        expect(f.includes(`${path.sep}npc${path.sep}`), `${f} must not contain PC-only actions`).toBe(false);
        expect(text, `${f} renders ${used.join(", ")} ungated`).toContain("@root.pcActions");
      }
      expect(SHEET).not.toMatch(/pcActions\s*=\s*true/);
    });
  });
  ```
  Run it with a redirect and `tail`. It should FAIL.

- [ ] **Step 2: Templates.**

  `templates/actor/npc/main.hbs` replaces the old file entirely:
  ```hbs
  <section class="tab main{{#if tab.active}} active{{/if}}" data-group="{{tab.group}}" data-tab="{{tab.id}}">
    {{> adnd2e.pc-main-panels}}
    {{> adnd2e.pc-proficiency-panels}}
  </section>
  ```

  `templates/actor/npc/journal.hbs`:
  ```hbs
  <section class="tab journal{{#if tab.active}} active{{/if}}" data-group="{{tab.group}}" data-tab="{{tab.id}}">

    <section class="kit-panel npc-fields">
      <div class="kit-bar">{{localize 'ADND2E.sheet.npc.title'}}</div>
      <div class="kit-body detail-fields">
        <div class="detail-field">
          <span class="cap">{{localize 'ADND2E.sheet.npc.morale'}}</span>
          {{#if @root.adnd2e.lock.unlocked}}
            <input type="number" name="system.npc.morale" value="{{source.system.npc.morale}}">
          {{else}}
            <span class="val">{{source.system.npc.morale}}</span>
          {{/if}}
        </div>
        <div class="detail-field">
          <span class="cap">{{localize 'ADND2E.sheet.npc.xpValue'}}</span>
          {{#if @root.adnd2e.lock.unlocked}}
            <input type="number" name="system.npc.xpValue" value="{{source.system.npc.xpValue}}">
          {{else}}
            <span class="val">{{source.system.npc.xpValue}}</span>
          {{/if}}
        </div>
        <div class="detail-field">
          <span class="cap">{{localize 'ADND2E.sheet.npc.disposition'}}</span>
          {{#if @root.adnd2e.lock.unlocked}}
            <select name="system.npc.disposition">{{selectOptions dispositions selected=source.system.npc.disposition localize=true}}</select>
          {{else}}
            <span class="val">{{localize (lookup dispositions source.system.npc.disposition)}}</span>
          {{/if}}
        </div>
      </div>
    </section>

    {{> adnd2e.pc-feature-panels}}
    {{> adnd2e.pc-journal-panels}}

  </section>
  ```
  - `pc-feature-panels` hides its traits panel because `pcActions` is absent. That matches today's NPC sheet, which shows no traits.
  - Check `CONFIG.ADND2E.dispositions` values. If they are i18n keys, `localize (lookup …)` is correct. If `lookup` returns undefined for a null disposition, the locked text renders empty, which is fine.

  Delete `templates/actor/npc/details.hbs` with `git rm`. Its content now lives in pc/inventory.hbs plus npc/journal.hbs.

- [ ] **Step 3: Lang.** Add `"title": "NPC"` to the existing `ADND2E.sheet.npc` object, next to morale, xpValue and disposition. Add an assertion in `tests/lang/en-coverage.test.ts` that `ADND2E.sheet.npc.title` resolves.

- [ ] **Step 4: Wire the sheet** (`src/sheets/npc/sheet.ts`).
  - `DEFAULT_OPTIONS.classes` becomes `["adnd2e", "sheet", "actor", "pc-sheet", "npc-sheet"]`. Drop `"npc"` so the old `:is(.character, .npc)` styles no longer apply. `position` becomes `{ width: 1045, height: 960 }`.
  - Add these actions: `toggleLock: Adnd2eNpcSheet.#onToggleLock`, `toggleFavorite: Adnd2eNpcSheet.#onToggleFavorite`. Keep every existing action.
  - Replace `PARTS` and `TABS`, and delete the now-unused `T` helper:
    ```typescript
    static PARTS = {
      left: { template: TEMPLATE_PATH("actor/pc", "left.hbs") },
      header: { template: TEMPLATE_PATH("actor/pc", "header.hbs") },
      tabs: { template: TEMPLATE_PATH("actor/pc", "tabs.hbs") },
      main: { template: TEMPLATE_PATH("actor/npc", "main.hbs"), scrollable: [""] },
      inventory: { template: TEMPLATE_PATH("actor/pc", "inventory.hbs"), scrollable: [""] },
      spells: { template: TEMPLATE_PATH("actor/pc", "spells.hbs"), scrollable: [""] },
      journal: { template: TEMPLATE_PATH("actor/npc", "journal.hbs"), scrollable: [""] },
    };

    static TABS = {
      primary: {
        initial: "main",
        labelPrefix: "ADND2E.sheet.tabs",
        tabs: [
          { id: "main", icon: "fa-solid fa-user" },
          { id: "inventory", icon: "fa-solid fa-box-open" },
          { id: "spells", icon: "fa-solid fa-wand-sparkles" },
          { id: "journal", icon: "fa-solid fa-book" },
        ],
      },
    };
    ```
    Each template path must be written exactly as `TEMPLATE_PATH("actor/<dir>", "<file>.hbs")`, because the binding test parses them.
  - Add the instance field `#unlocked = false;` and the getter `get #sheetKitKey(): string { return \`npc-${(this.document as unknown as { id: string }).id}\`; }`.
  - In `_prepareContext`, add `context.proseDisabled = !this.isEditable || !this.#unlocked;`. Do NOT set `pcActions`.
  - In `#buildInput`, add `unlocked: this.#unlocked,` and `favorites: (this.document as unknown as { getFlag(scope: string, key: string): unknown }).getFlag(SYSTEM_ID, "favorites"),`. Import `SYSTEM_ID` from `../../constants`.
  - At the end of `_onRender`, add `bindSheetKit(this.element, this.#sheetKitKey);`. Import it from `../kit-dom`.
  - Add the override:
    ```typescript
    override _onClose(options: unknown): void {
      super._onClose(options);
      this.#unlocked = false;
      clearSheetKit(this.#sheetKitKey);
    }
    ```
    Also add `_onClose(options: unknown): void;` and `render(options?: unknown): Promise<unknown>;` to the `Base` member list if typecheck needs them. Copy the form `character/sheet.ts` uses.
  - Add the handlers:
    ```typescript
    static async #onToggleLock(this: Adnd2eNpcSheet): Promise<void> {
      if (!this.isEditable) return;
      this.#unlocked = !this.#unlocked;
      await this.render();
    }

    static async #onToggleFavorite(this: Adnd2eNpcSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
      await toggleFavoriteFlag(this.document, target);
    }
    ```
    Import `toggleFavoriteFlag` from `../kit-actions`.
  - Refresh the class header comment to describe the kit layout and the `pcActions` decision.
  - Leave `_onDropItem` (trait refusal plus the `slotsInvested` write) unchanged.

- [ ] **Step 5: Verify.**
  - Run `npx vitest run tests/templates tests/sheets tests/lang` and confirm it passes.
  - Run `npm run typecheck`, `npm run lint` and `npm run test:coverage`; all must exit 0.
  - Run the sass check.
  - With `git diff --stat`, confirm nothing changed under `templates/actor/creature/` or `src/sheets/creature/`, and that `styles/**` is untouched.
- [ ] **Step 6: Commit:** `feat(sheets): Character NPC sheet on the parchment kit — left column, header, four tabs, lock and favorites`, followed by the trailer.

---

### Task 3: Remove the pre-redesign character templates and styles

**Files:**
- Delete: `templates/actor/character/**` (after Task 1 only `header, main, combat, inventory, skills, spells, features, biography` and `partials/{ability-row,save-row,class-row,item-row,encumbrance-gauge}` remain), and `styles/actor/character.scss`.
- Modify: `src/sheets/handlebars.ts` (drop the five `actor/character/partials/*` entries), `styles/system.scss` (drop `@use "actor/character";`), `styles/actor/creature.scss` (only if its comment mentions the old scoping; update the comment, no rule changes).

- [ ] **Step 1: Prove nothing uses them.** Run `grep -rn "actor/character" src/ templates/ tests/ styles/`. Only the `handlebars.ts` entries and `system.scss` should match. Also run grep for the partial ids `adnd2e.ability-row`, `adnd2e.save-row`, `adnd2e.class-row`, `adnd2e.item-row` and `adnd2e.encumbrance-gauge` across `templates/`. There should be no matches outside `templates/actor/character/`. If anything else matches, STOP and report.
- [ ] **Step 2: Delete and unregister.** Run `git rm -r templates/actor/character styles/actor/character.scss`, then edit `handlebars.ts` and `system.scss` as listed.
  - Check `src/sheets/index.ts`. It keeps the full PC sheet selectable for `npc`. That uses the PC sheet class, not old templates, so nothing changes there.
  - Also check with grep that `.character`/`.npc` class selectors are no longer referenced in any remaining SCSS.
- [ ] **Step 3: Verify.**
  - Run `npx vitest run` and `npm run test:coverage`; all must pass.
  - Run `npm run typecheck` and `npm run lint`; both must exit 0.
  - Run the sass check.
  - Run `grep -rn "actor/character\|adnd2e\.\(ability-row\|save-row\|class-row\|item-row\|encumbrance-gauge\)" src templates styles tests`. It must return nothing.
- [ ] **Step 4: Commit:** `chore(sheets): remove the pre-redesign character templates and styles`, followed by the trailer.

---

### Task 4: Whole-branch review (MANDATORY)

Run this on the most capable model, over base..HEAD, with this plan, the spec and the following risk list:
- **Nothing lost (NPC):** the automated test passes, and a manual walk against the old NPC templates (from `git show <base>:templates/actor/npc/main.hbs`, `…/details.hbs`, `…/character/header.hbs`, `…/character/spells.hbs`, and the old partials) finds every visible datum and control, as follows.
  - Alignment, and the morale, XP value and disposition fields.
  - Abilities with mods and racial delta, exceptional STR, and HP value/temp.
  - AC, THAC0, movement, saves, and the class rows with HP roll and take-average.
  - Weapons with backstab and the maneuver picker, AC breakdown, armor, weapon and NWP proficiencies, and the thief skill rolls.
  - Containers and their contents, encumbrance, currency, and the features by source.
  - Racial abilities, languages, resources, details, biography, campaign notes, and GM notes (GM only).
  - Spell slots, known spells with learn/memorize/forget/cast, orphaned spells, rest, and the casting panel.
- **PC unchanged:** Task 1 must be a pure extraction.
  - Diff the rendered structure mentally: the panels appear in the same order, and the same classes, gates and `@root.` refs are used.
  - `pcActions` is true on the PC sheet, so every PC-only button still renders there.
  - PC sizes are unchanged.
- **PC-only discipline:** the NPC sheet registers none of the six PC-only actions. Every place they're rendered is gated on `@root.pcActions`. Nothing in `templates/actor/npc/**` contains them.
- **Lock and favorites on the NPC sheet:**
  - The sheet opens locked, and the lock resets on close (`_onClose` after `super`).
  - `toggleLock` does nothing unless `isEditable`.
  - Stars are owner-only, and the flag is written only by owners (`toggleFavoriteFlag` checks `isOwner`).
  - The NPC fields are unlock-only; play inputs work while locked.
  - `proseDisabled` is correct.
  - `#sheetKitKey` is namespaced `npc-` so it can't collide with a PC sheet's DOM state.
- **Monster NPC unaffected:**
  - `item-controls` and `slot-table` moved but kept their ids.
  - `templates/actor/creature/**`, `src/sheets/creature/**` and `styles/actor/creature.scss` rules are unchanged.
  - The creature sheet's class list never included `.character` or `.npc`, so removing `character.scss` does not affect it. Verify its classes in `src/sheets/creature/sheet.ts`.
- **Deletion completeness:** no dangling template path, partial id or SCSS `@use` remains, and the build can't fail on a missing file.
- **The full PC sheet selected for an `npc` actor** (the index.ts registration) still works, with `pcActions` true.
- Tests, typecheck and lint pass (re-run them).

Fix Critical and Important findings in one wave, then run a scoped re-review.

---

### Task 5: GATED dev-world check (light and dark mode, GM and player seat)

First confirm Foundry is fully quit, including the tray: `tasklist | grep -c "Foundry Virtual"` must print `0`. Then run `npm run build` and `npm run link`, and relaunch. You need a Character NPC with:
- a class and a race;
- weapons, one of them equipped;
- armor;
- a container with contents;
- spells (a caster);
- thief skills (a thief, or a multiclass thief).

Also have a PC and a Monster NPC ready.

- [ ] **Look:** the Character NPC sheet looks like the PC sheet: parchment, left column, header with Classes, vitals and the saves card, and four pill tabs. Check it in both light and dark mode.
- [ ] **PC-only actions absent:** the NPC sheet has no Award XP and no dual-class toggle. The Proficiencies block has no thief +/− buttons. There is no traits panel and no sub-ability Seed button.
- [ ] **Lock:**
  - The sheet opens locked. Unlocking shows the name, alignment, ability inputs, morale, XP value, disposition, details, resources, quantity, and ✎/🗑.
  - Close and reopen the sheet: it opens locked again.
- [ ] **Nothing lost:** walk the Task 4 list on the live sheet. Include:
  - rolling each save, attacking with backstab and with a maneuver, and rolling HP and take-average;
  - weapon mastery, an NWP check and a thief-skill roll;
  - rest, learn, memorize, forget and cast, plus casting begin/complete/disrupt/cancel in combat;
  - equip/unequip, location (while locked), quantity and identified (GM), and ✎/🗑;
  - currency, HP edits, and the biography, campaign notes and GM notes editors.
- [ ] **Item tables and favorites:** collapse and filter work, and so does expanding an item's stats. Star a weapon, a piece of gear, a spell and a thief skill: they appear on Main, and their buttons work.
- [ ] **PC unchanged:** spot-check the PC sheet. Award XP, dual-class, thief +/−, traits and Seed are all still present, and the layout and sizes are unchanged.
- [ ] **Monster NPC unchanged:** its gear list ✎/🗑 and spells (slot table) render and work.
- [ ] **Full PC sheet on an NPC:** switch a Character NPC to the full PC sheet through the sheet config. It renders, with the PC-only actions present.
- [ ] **Player seat:**
  - As the owning player, the lock, stars and play actions work.
  - As a non-owner observer, the sheet is read-only with no lock, stars or ✎/🗑.
- [ ] Report PASS/FAIL via `AskUserQuestion`.

## After this plan lands
Push + PR (standing default). Then run Plan R3, which puts the Monster NPC sheet on the kit per spec §4.4.
