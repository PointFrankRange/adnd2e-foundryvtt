# Theming: Active Effect Sheet, Raw Actor Sheet and Chat Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Active Effect sheet and the raw actor fallback sheet the same parchment/dark-leather look as the item sheet, and style all fifteen chat cards in the parchment card with a maroon header bar (mockup direction A), in both Foundry themes.

**Architecture:** Stylesheet-only. The sheet theme tokens and kit rules widen from `.adnd2e.raw-field-sheet.item` to `.adnd2e.raw-field-sheet` (all three sheets share `templates/sheets/raw-fields.hbs`). A new `styles/chat/_chat.scss` defines its own tokens on `.adnd2e.chat-card` (chat messages render outside any sheet window) and styles the shared chat-card class vocabulary. Census tests keep the scopes and the class vocabulary honest.

**Tech Stack:** SCSS (compiled by `npx vite build`), Handlebars templates (unchanged), vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-adnd2e-theming-sheets-chat-design.md`

## Global Constraints

- Stylesheet-only: no change to any `.hbs` template or any TypeScript behavior. (The only non-SCSS files touched are tests.)
- Plan ruling on the spec's "item-specific rules stay scoped": every rule in the widened blocks is keyed to template classes that only exist where they are rendered (`raw-*`, `kit-*`, `form-group`), and the actor sheets are separately scoped under `.pc-sheet`; so widen ALL `.raw-field-sheet.item` selectors in `_tokens.scss` and `_kit.scss` to `.raw-field-sheet`, including the layout block and the multiselect rule. The `item` CSS class on the item sheet class stays (harmless).
- Colours (light / dark), from the approved mockup, defined as tokens on `.adnd2e.chat-card` with a `body.theme-dark .adnd2e.chat-card, .adnd2e.chat-card.theme-dark` override (the same switch the sheet tokens use):
  - card background `#e6d3a3` / `#2a211b`; card border and header `#7a0a0a` / `#8c1c1c`; header ink `#ffffff` / `#f6ecd6`; ink `#1a1208` / `#eee3cc`; muted `#5a3e14` / `#c7b08a`; row rule `#d8c7a0` / `#4a3b31`;
  - hit/success `#1f5a1f` / `#8fd18f`; miss/fail/failure/rejected `#8a1010` / `#ef8a7a`; crit `#8a5a00` / `#f0c060`; fumble `#6b2a10` / `#e0987a`;
  - button outline/ink `#7a0a0a` / `#e39a7a`; lost-notice header `#5a0808` / `#a02424`.
- Do not use Foundry core's bare `.disabled` class in any new rule.
- Foundry's own roll cards (dice result and tooltip under a system card) keep their default look; no `!important` unless a rule demonstrably loses to a core rule (say so in a comment if used).
- Dialogs, the Combat Tracker additions and the settings sections UI are out of scope.
- Before opening a PR: `npm run lint`, `npm run typecheck` (includes the Foundry-free `tsconfig.core.json`), `npm run test:coverage` (100% statements), `npx vite build`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 1: Widen the sheet theme scope to the effect and raw actor sheets

**Files:**
- Modify: `styles/theme/_tokens.scss`
- Modify: `styles/kit/_kit.scss`
- Create: `tests/styles/theme-scope.test.ts`

**Interfaces:**
- Produces: the theme tokens and kit rules apply under `.adnd2e.raw-field-sheet` (item, Active Effect and raw actor sheets). No runtime interface.

Read `styles/theme/_tokens.scss` and `styles/kit/_kit.scss` in full first (selectors are at `_tokens.scss` lines ~7-8 and ~28-31, `_kit.scss` lines ~3-4, ~176 and ~243; line numbers drift). The base selector list is `.adnd2e.pc-sheet, .adnd2e.raw-field-sheet.item`.

- [ ] **Step 1: Write the failing test**

Create `tests/styles/theme-scope.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const TOKENS = readFileSync(path.join(ROOT, "styles", "theme", "_tokens.scss"), "utf8");
const KIT = readFileSync(path.join(ROOT, "styles", "kit", "_kit.scss"), "utf8");

describe("sheet theme scope (#150)", () => {
  it("theme tokens apply to every raw-field sheet (item, active effect, raw actor), not just items", () => {
    expect(TOKENS).toContain(".adnd2e.raw-field-sheet");
    expect(TOKENS).not.toContain(".raw-field-sheet.item");
  });
  it("kit rules apply to every raw-field sheet", () => {
    expect(KIT).toContain(".adnd2e.raw-field-sheet");
    expect(KIT).not.toContain(".raw-field-sheet.item");
  });
  it("keeps the dark-mode token switch for both the body class and the app class", () => {
    expect(TOKENS).toContain("body.theme-dark .adnd2e.raw-field-sheet");
    expect(TOKENS).toContain(".adnd2e.raw-field-sheet.theme-dark");
  });
  it("the name field stretches outside the item sheet (flex rule is in the unscoped block)", () => {
    expect(KIT).toMatch(/input\.raw-name\s*\{[^}]*flex:\s*1/);
  });
});
```

Run: `npx vitest run tests/styles/theme-scope.test.ts`
Expected: FAIL (the scopes still say `.raw-field-sheet.item`).

- [ ] **Step 2: Widen the selectors**

In both files replace every occurrence of `.adnd2e.raw-field-sheet.item` with `.adnd2e.raw-field-sheet` — including the dark-mode forms `body.theme-dark .adnd2e.raw-field-sheet.item` → `body.theme-dark .adnd2e.raw-field-sheet` and `.adnd2e.raw-field-sheet.item.theme-dark` → `.adnd2e.raw-field-sheet.theme-dark`, and the header comments at the top of `_kit.scss` ("(.raw-field-sheet.item — the .item class keeps the actor fallback out)" must be rewritten to say all raw-field sheets share the kit). Then:

1. `_kit.scss` now has two separate `.adnd2e.raw-field-sheet { … }` blocks (the portrait/title-row block added in PR #149 and the widened layout block). Merge the portrait/title-row rules into the single widened layout block if that is straightforward; otherwise leave them as two blocks (both are valid) — but there must be no duplicated declarations with conflicting values.
2. In the widened block, make sure `input.raw-name` carries `flex: 1; min-width: 0;` (it already does inside the old `.item` block; after widening it applies everywhere, so the name field stretches on the effect sheet).
3. Read each rule in the widened blocks once and confirm none targets an element that only exists on actor sheets (they are keyed to `raw-*`, `kit-*`, `form-group`; `.pc-sheet` rules in `styles/actor/*.scss` are untouched).

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/styles && npx vite build --outDir "$TMPDIR/adnd2e-build-check" ; grep -c "raw-field-sheet.item" "$TMPDIR/adnd2e-build-check"/*.css`
(Use the scratchpad directory instead of `$TMPDIR` if `$TMPDIR` is unset.) Expected: the test passes, the build compiles, and the compiled CSS contains no `.raw-field-sheet.item` selector. Then `npm run typecheck && npm run lint`.

- [ ] **Step 4: Commit**

```bash
git add styles/theme/_tokens.scss styles/kit/_kit.scss tests/styles/theme-scope.test.ts
git commit -m "feat(theme): apply the sheet theme to the active effect and raw actor sheets (#150)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The chat card stylesheet

**Files:**
- Create: `styles/chat/_chat.scss`
- Modify: `styles/system.scss` (add `@use "chat/chat";` beside the other `@use` lines)
- Create: `tests/styles/chat-classes.test.ts`

**Interfaces:**
- Produces: `.adnd2e.chat-card` styling for all fifteen chat-card templates in both themes.

Read `templates/chat/*.hbs` (all fifteen) and `styles/system.scss` first.

- [ ] **Step 1: Write the failing census test**

Create `tests/styles/chat-classes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const CHAT_DIR = path.join(ROOT, "templates", "chat");
const CSS = readFileSync(path.join(ROOT, "styles", "chat", "_chat.scss"), "utf8");
const SYSTEM = readFileSync(path.join(ROOT, "styles", "system.scss"), "utf8");

/** Class tokens used by a chat template, after stripping every Handlebars expression. */
function classTokens(source: string): { root: string[]; rest: string[] } {
  const stripped = source.replace(/\{\{[^}]*\}\}/g, " ");
  const attrs = [...stripped.matchAll(/class="([^"]*)"/g)].map((m) => m[1]!.split(/\s+/).filter(Boolean));
  const [first = [], ...others] = attrs;
  return { root: first, rest: others.flat() };
}

/** Plain paragraphs and labels that deliberately carry no rule of their own (they inherit the card ink). */
const NO_RULE = new Set(["check", "powers", "maneuver", "name", "chance", "crit-line"]);

describe("chat card stylesheet (#150)", () => {
  it("is loaded from system.scss", () => {
    expect(SYSTEM).toContain("chat/chat");
  });

  const files = readdirSync(CHAT_DIR).filter((f) => f.endsWith(".hbs"));
  it("finds all fifteen chat templates", () => {
    expect(files.length).toBe(15);
  });

  for (const file of files) {
    it(`every class used by ${file} has a rule in _chat.scss (or is a documented plain label)`, () => {
      const { root, rest } = classTokens(readFileSync(path.join(CHAT_DIR, file), "utf8"));
      expect(root).toContain("chat-card");
      // the root's own card-name token (e.g. "attack-roll") needs no rule; a root modifier such as "lost" does
      const rootModifiers = root.filter((t) => !["adnd2e", "chat-card"].includes(t)).slice(1);
      for (const token of [...rootModifiers, ...rest]) {
        if (NO_RULE.has(token)) continue;
        expect(CSS, `${file}: .${token}`).toContain(`.${token}`);
      }
    });
  }

  it("defines the colour tokens for both themes", () => {
    expect(CSS).toContain(".adnd2e.chat-card");
    expect(CSS).toMatch(/body\.theme-dark \.adnd2e\.chat-card/);
    for (const t of ["--chat-bg", "--chat-head", "--chat-hit", "--chat-miss", "--chat-crit", "--chat-fumble"]) {
      expect(CSS, t).toContain(t);
    }
  });

  it("never uses core's bare .disabled class", () => {
    expect(CSS).not.toMatch(/\.disabled\b/);
  });
});
```

Run: `npx vitest run tests/styles/chat-classes.test.ts` → FAIL (`_chat.scss` does not exist).

- [ ] **Step 2: Write the stylesheet**

Create `styles/chat/_chat.scss`:

```scss
// Chat cards (#150). Chat messages render in the sidebar, outside any sheet window where the kit tokens live, so the
// cards define their own tokens (the sheet palette: parchment / dark leather, maroon header bar). Dark mode follows the
// same switch the sheet tokens use (body.theme-dark, or .theme-dark on the element). Class vocabulary = templates/chat/*.hbs.
.adnd2e.chat-card {
  --chat-bg: #e6d3a3;
  --chat-border: #7a0a0a;
  --chat-head: #7a0a0a;
  --chat-head-ink: #ffffff;
  --chat-alert-head: #5a0808;
  --chat-ink: #1a1208;
  --chat-muted: #5a3e14;
  --chat-rule: #d8c7a0;
  --chat-hit: #1f5a1f;
  --chat-miss: #8a1010;
  --chat-crit: #8a5a00;
  --chat-fumble: #6b2a10;
  --chat-btn: #7a0a0a;
}

body.theme-dark .adnd2e.chat-card,
.adnd2e.chat-card.theme-dark {
  --chat-bg: #2a211b;
  --chat-border: #8c1c1c;
  --chat-head: #8c1c1c;
  --chat-head-ink: #f6ecd6;
  --chat-alert-head: #a02424;
  --chat-ink: #eee3cc;
  --chat-muted: #c7b08a;
  --chat-rule: #4a3b31;
  --chat-hit: #8fd18f;
  --chat-miss: #ef8a7a;
  --chat-crit: #f0c060;
  --chat-fumble: #e0987a;
  --chat-btn: #e39a7a;
}

.adnd2e.chat-card {
  background: var(--chat-bg);
  color: var(--chat-ink);
  border: 1px solid var(--chat-border);
  border-radius: 4px;
  overflow: hidden;
  font-size: 13px;

  // the maroon title bar: portrait + title
  > header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: var(--chat-head);
    color: var(--chat-head-ink);

    img { width: 26px; height: 26px; border: 0; border-radius: 3px; flex: none; object-fit: cover; }
    h3 {
      margin: 0; border: 0; min-width: 0;
      font-size: 13px; font-weight: 700; color: inherit;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
  }
  &.lost > header { background: var(--chat-alert-head); }

  // body spacing
  > :not(header) { margin-left: 8px; margin-right: 8px; }
  > header + * { margin-top: 6px; }
  > :last-child { margin-bottom: 8px; }
  p { margin-top: 4px; margin-bottom: 4px; }

  // lines
  .formula, .cost, .hint, .detail, .scope { color: var(--chat-muted); }
  .hint { font-style: italic; }
  .headline { font-weight: 700; }
  .target { font-weight: 700; }
  .param strong, .tangents strong { color: var(--chat-muted); }
  .rung, .damage { font-weight: 700; }
  .step { border-top: 1px solid var(--chat-rule); padding-top: 2px; }

  // outcomes
  .result { font-weight: 700; }
  .result.hit, .result.success { color: var(--chat-hit); }
  .result.miss, .result.fail, .result.failure, .result.rejected { color: var(--chat-miss); }
  .crit, .backstab { color: var(--chat-crit); font-weight: 700; }
  .fumble { color: var(--chat-fumble); font-weight: 700; }
  .dire, .loss { color: var(--chat-miss); font-weight: 700; }

  // lists: modifier breakdown, spell details, turn-undead rows
  .modifiers, .spell-details, .turn-results {
    list-style: none;
    margin-top: 2px; margin-bottom: 2px; padding: 0;
    font-size: 11px; color: var(--chat-muted);
  }
  .turn-results li { display: flex; align-items: center; gap: 6px; padding: 2px 0; border-bottom: 1px solid var(--chat-rule); }
  .turn-results li img { width: 24px; height: 24px; border: 0; border-radius: 3px; flex: none; }
  .turn-results .status-turned, .turn-results .status-destroyed { color: var(--chat-hit); font-weight: 700; }
  .turn-results .status-fail, .turn-results .status-unaffected, .turn-results .status-cannot { color: var(--chat-miss); }
  .turn-results .status-notUndead, .turn-results .status-untagged { opacity: .6; }

  // buttons inside a card (Roll Damage, Apply, Roll Defense, ...)
  button {
    width: auto; height: auto; margin-top: 4px;
    padding: 2px 10px; line-height: 1.5;
    background: transparent; color: var(--chat-btn);
    border: 1px solid var(--chat-btn); border-radius: 3px;
    cursor: pointer;
    &:hover { background: var(--chat-btn); color: var(--chat-bg); }
  }
}
```
(Check the stylesheet against the census test; if a class in a template has no rule and is not in the test's `NO_RULE` set, either add a rule here or — if it is a plain label — add it to `NO_RULE` in the test with a one-line reason in the plan report. `crit-line` in `NO_RULE` is a spare; remove it if no template uses it.)

- [ ] **Step 3: Load it**

In `styles/system.scss`, add `@use "chat/chat";` next to the existing `@use` lines (after `@use "actor/pc";`).

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/styles && npx vite build --outDir "$TMPDIR/adnd2e-build-check"` then confirm the compiled `system.css` contains `.adnd2e.chat-card` and `--chat-hit` (`grep -c`). Then `npm run typecheck && npm run lint && npx vitest run`.
Expected: all pass; the build compiles.

- [ ] **Step 5: Commit**

```bash
git add styles/chat/_chat.scss styles/system.scss tests/styles/chat-classes.test.ts
git commit -m "feat(theme): parchment chat cards with a maroon header bar, light and dark (#150)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Gates, compiled-CSS proof, and the manual checklist

**Files:**
- Modify: `README.md` only if it describes the theming scope (`grep -n -i "theme\|parchment\|dark" README.md`); otherwise skip.
- Scratch (not committed): the compiled CSS output of `npx vite build --outDir <scratchpad>/build`.

- [ ] **Step 1: Full CI sequence**

Run: `npm run lint && npm run typecheck && npm run test:coverage && npx vite build --outDir "<scratchpad>/build"`
Expected: all green; 100% statement coverage; the build succeeds.

- [ ] **Step 2: Compiled-CSS proof**

Inspect the compiled `system.css` in `<scratchpad>/build` and report:
1. no occurrence of `.raw-field-sheet.item` in a token or kit selector (a `.item` may still appear in an item-only compound selector if any exists — list them);
2. the dark-mode token block exists for `body.theme-dark .adnd2e.raw-field-sheet` and for `body.theme-dark .adnd2e.chat-card`;
3. the chat card rules for `.result.hit`, `.result.miss`, `.crit`, `.fumble` and `.status-turned` are present, and every one of the 15 template names appears nowhere as a selector that would style only one card by accident (confirm the card-name tokens are not used as selectors);
4. the rule count and file size delta against `master`'s build is plausible (a few KB).
Report what was proven and what was not (actual colours, contrast and layout in Foundry, the non-GM seat, Foundry's own roll card rendering).

- [ ] **Step 3: README (only if needed) and commit**

If the grep finds an outdated statement, update it and commit `docs: sheet and chat theming (#150)`; otherwise no commit.

- [ ] **Step 4: Manual dev-world checklist (the controller hands this to the user)**

Prerequisites: Foundry closed, `npm run build`, relaunch. A PC with a Fighter class, an equipped weapon and a target token; a wizard PC with a spell; a psionicist and a cleric (turn undead) if available; wrestling on for the contest card. Run once in Foundry's light theme and once in its dark theme (Settings → Core → Interface → colour scheme). Reset any setting you change.
1. **Effect editor:** open a weapon, create an effect (+ New effect). The editor window is parchment/leather with maroon panels, the name field stretches full width, the `Changes` box, condition id, checkboxes and school tag are readable.
2. **Raw actor sheet:** on an actor, use the sheet picker (configure sheet) to choose "Raw Fields (Actor)": it is themed like the item sheet and its fields are readable in both themes.
3. **Attack card:** roll an attack that hits — a parchment card with a maroon header bar (portrait + title), a muted formula line, a green "Hit" result, a modifier list, and a maroon-outline Roll Damage button. A miss shows a red result. Force a natural 20 (see the force-dice recipe memory) for a gold critical line and a natural 1 for the fumble line.
4. **Damage card** (Roll Damage): gold crit/backstab line when present, Apply button styled.
5. **Save, thief skill and nonweapon check cards:** green success / red failure.
6. **Spell:** a cast card (spell-details list, formula, Apply button) and a casting notice; a lost spell (disrupt a cast) gets the dark-red header.
7. **Wrestling contest, psionic contest and power use, wild talent, turn undead (rows coloured: turned/destroyed green, failed/unaffected red, not-undead faded), learn spell, kit power:** each card reads cleanly with the same header bar.
8. Confirm Foundry's own dice result and tooltip under a card are untouched, the PC, NPC, monster and item sheets look exactly as before (no regression), and the dark-theme chat cards are leather with light text.
9. From a non-GM player seat, repeat 3 and 1/2 (the sheet picker may be GM-only).
```

---

## Self-Review

- **Spec coverage:** §1 widen the sheet scope incl. `raw-name` stretch → Task 1 (plus the plan ruling to widen all rules because they are class-keyed to the shared template; the spec allowed a more specific `.item` block for item-only rules, the plan chooses none because no rule leaks); §2 chat stylesheet with its own tokens, `body.theme-dark` override, header bar, result/status colours, buttons, card-specific extras (lost header, turn-undead rows, dire/loss, step/tangents) → Task 2; §3 out of scope respected; Testing: scope test and class-census test (Tasks 1-2), `.disabled` guard (Task 2 test), vite build and compiled-CSS proof, manual checklist in both themes (Task 3).
- **Placeholders:** none; the SCSS and tests are complete. Task 1 Step 2 is a mechanical search-and-replace plus a read-through, with the exact strings to change.
- **Consistency:** the colour table in Global Constraints matches the tokens in Task 2's SCSS; the test's token names (`--chat-bg`, `--chat-head`, `--chat-hit`, `--chat-miss`, `--chat-crit`, `--chat-fumble`) exist in the stylesheet; the census derives the class vocabulary from the real templates, so it cannot drift.
