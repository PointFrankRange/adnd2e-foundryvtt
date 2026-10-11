# Theming: System Dialogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all 14 system DialogV2 dialogs the sheet look (parchment/leather body, maroon title bar, themed inputs, filled primary and outlined secondary buttons) through one shared helper, and keep it that way with a guard test.

**Architecture:** A pure `withDialogTheme(options)` (new `src/dialogs/themed-dialog.ts`, in the coverage gate) adds the window classes `adnd2e` and `adnd2e-dialog`. Thin Foundry wrappers `themedPrompt`/`themedConfirm` (`src/dialogs/themed-dialog-foundry.ts`) call `DialogV2.prompt`/`.confirm` with the themed options; all call sites switch to them. A guard test fails on any other direct `DialogV2.prompt/confirm/wait`. A new `styles/dialog/_dialog.scss` plus the existing theme tokens style the classed dialogs.

**Tech Stack:** TypeScript, Foundry VTT v14 `DialogV2` (an `ApplicationV2`), SCSS, vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-adnd2e-theming-dialogs-design.md`

## Global Constraints

- Only our own dialogs are themed: the classes are added solely by the wrappers. Foundry's and other modules' dialogs are never touched, and no global `.dialog` restyle.
- The 14 call sites to convert (all currently `foundry.applications.api.DialogV2.prompt(` or `.confirm(`): `src/combat/initiative-modifier-dialog.ts` (prompt), `src/relay/relay-handler.ts` (confirm), `src/sheets/character/combat-rolls.ts` (prompt ~308 and confirm ~493), `src/sheets/character/free-magick-dialog.ts` (prompt x2), `src/sheets/character/psionic-wild.ts` (confirm ~101, prompt ~120), `src/sheets/character/recover-dialog.ts` (prompt), `src/sheets/character/sheet.ts` (prompt ~963), `src/sheets/creature/combat-rolls.ts` (prompt ~191), `src/sheets/effects-actions.ts`, `src/sheets/item-effects-actions.ts` and `src/sheets/item-row-actions.ts` (confirm each). No change to any dialog's content, labels, buttons or behavior; existing `as never` casts stay.
- Wrapper signatures and return types must match `DialogV2.prompt` / `DialogV2.confirm` so existing call sites need only the function name and an import changed (callers rely on inference such as `const value = await …prompt({ ok: { callback: … => number } })` and `typeof value !== "number"`). Preferred typing: `export const themedPrompt: typeof foundry.applications.api.DialogV2.prompt = (config) => foundry.applications.api.DialogV2.prompt(withDialogTheme(config as never) as never)` (same for confirm); if fvtt-types rejects that, cast the arrow with `as typeof …` rather than loosening call sites.
- Styles: no `!important`, no bare core `.disabled` class; system.css is unlayered so it beats core's layered rules. Primary buttons are keyed on `data-action="ok"` and `"yes"` (core's defaults); other footer buttons are outlines. `DialogV2.confirm` defaults focus to "No" — leave that behavior alone.
- The Combat Tracker context-menu entry and the settings sections UI are out of scope.
- Before opening a PR: `npm run lint`, `npm run typecheck` (includes the Foundry-free `tsconfig.core.json`), `npm run test:coverage` (100% statements), `npx vite build`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 1: The pure `withDialogTheme` builder

**Files:**
- Create: `src/dialogs/themed-dialog.ts`
- Create: `tests/dialogs/themed-dialog.test.ts`
- Modify: `vitest.config.ts` (add `"src/dialogs/themed-dialog.ts",` to the coverage `include`, next to `"src/sheets/effects/**/*.ts",`)

**Interfaces:**
- Produces (exported from `src/dialogs/themed-dialog.ts`):
  ```ts
  export const DIALOG_CLASSES: readonly ["adnd2e", "adnd2e-dialog"];
  export function withDialogTheme<T extends { classes?: readonly string[] }>(options: T): T & { classes: string[] };
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/dialogs/themed-dialog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DIALOG_CLASSES, withDialogTheme } from "../../src/dialogs/themed-dialog";

describe("withDialogTheme", () => {
  it("adds the system dialog classes when the options have none", () => {
    expect(withDialogTheme({ content: "x" }).classes).toEqual([...DIALOG_CLASSES]);
  });

  it("keeps the caller's classes first and appends ours", () => {
    expect(withDialogTheme({ classes: ["mine", "other"] }).classes).toEqual(["mine", "other", "adnd2e", "adnd2e-dialog"]);
  });

  it("never duplicates a class the caller already supplied", () => {
    expect(withDialogTheme({ classes: ["adnd2e", "mine"] }).classes).toEqual(["adnd2e", "mine", "adnd2e-dialog"]);
  });

  it("passes every other property through untouched", () => {
    const options = { window: { title: "T" }, content: "<p>hi</p>", ok: { label: "Go" } };
    const out = withDialogTheme(options);
    expect(out.window).toBe(options.window);
    expect(out.content).toBe(options.content);
    expect(out.ok).toBe(options.ok);
  });

  it("does not mutate its argument and is idempotent", () => {
    const options = { classes: ["mine"] as readonly string[] };
    const once = withDialogTheme(options);
    expect(options.classes).toEqual(["mine"]);
    expect(withDialogTheme(once).classes).toEqual(once.classes);
  });

  it("the class list is the two system dialog classes", () => {
    expect([...DIALOG_CLASSES]).toEqual(["adnd2e", "adnd2e-dialog"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/dialogs/themed-dialog.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/dialogs/themed-dialog.ts`:

```ts
// Pure options builder for the system's themed DialogV2 dialogs (#150). No Foundry imports — the Foundry-coupled
// wrappers live in src/dialogs/themed-dialog-foundry.ts. The window classes below are what styles/dialog/_dialog.scss
// (and the shared theme tokens) key on; only our own dialogs ever get them.

export const DIALOG_CLASSES = ["adnd2e", "adnd2e-dialog"] as const;

/** The dialog options with the system dialog classes added after any classes the caller set. Pure: never mutates. */
export function withDialogTheme<T extends { classes?: readonly string[] }>(options: T): T & { classes: string[] } {
  const own = options.classes ?? [];
  return { ...options, classes: [...own, ...DIALOG_CLASSES.filter((c) => !own.includes(c))] };
}
```

- [ ] **Step 4: Run to verify pass, then gates and commit**

Run: `npx vitest run tests/dialogs/themed-dialog.test.ts && npm run typecheck && npm run lint && npm run test:coverage`
Expected: PASS; 100% statements.

```bash
git add src/dialogs/themed-dialog.ts tests/dialogs/themed-dialog.test.ts vitest.config.ts
git commit -m "feat(dialogs): pure withDialogTheme options builder (#150)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The Foundry wrappers, the 14 call sites, and the guard test

**Files:**
- Create: `src/dialogs/themed-dialog-foundry.ts`
- Create: `tests/dialogs/dialog-theme-guard.test.ts`
- Modify: the 11 files listed in Global Constraints (each call site)

**Interfaces:**
- Consumes: Task 1 `withDialogTheme`.
- Produces: `themedPrompt` and `themedConfirm` exported from `src/dialogs/themed-dialog-foundry.ts`, with the same call signatures as `DialogV2.prompt` / `DialogV2.confirm`.

Read each of the 11 files around its call before editing (some `as never` casts and the surrounding generic inference matter).

- [ ] **Step 1: Write the failing guard test**

Create `tests/dialogs/dialog-theme-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..", "..", "src");
const WRAPPER = path.join(SRC, "dialogs", "themed-dialog-foundry.ts");

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === "types" ? [] : tsFiles(p);
    return p.endsWith(".ts") && !p.endsWith(".d.ts") ? [p] : [];
  });
}

/** Source with block and line comments removed, so prose mentioning a pattern is not a call. */
function code(file: string): string {
  return readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("dialog theming guard (#150)", () => {
  it("no file other than the wrapper calls DialogV2.prompt, .confirm or .wait directly", () => {
    const offenders = tsFiles(SRC)
      .filter((f) => f !== WRAPPER)
      .filter((f) => /DialogV2\s*\.\s*(prompt|confirm|wait)\s*\(/.test(code(f)))
      .map((f) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });

  it("the wrapper themes every dialog it opens", () => {
    const wrapper = code(WRAPPER);
    expect(wrapper).toContain("withDialogTheme");
    expect(wrapper).toMatch(/DialogV2\s*\.\s*prompt\s*\(/);
    expect(wrapper).toMatch(/DialogV2\s*\.\s*confirm\s*\(/);
  });

  it("the 14 known call sites import the wrappers", () => {
    const importers = tsFiles(SRC)
      .filter((f) => f !== WRAPPER)
      .filter((f) => /themedPrompt|themedConfirm/.test(code(f)))
      .map((f) => path.relative(SRC, f).replace(/\\/g, "/"))
      .sort();
    expect(importers).toEqual(
      [
        "combat/initiative-modifier-dialog.ts",
        "relay/relay-handler.ts",
        "sheets/character/combat-rolls.ts",
        "sheets/character/free-magick-dialog.ts",
        "sheets/character/psionic-wild.ts",
        "sheets/character/recover-dialog.ts",
        "sheets/character/sheet.ts",
        "sheets/creature/combat-rolls.ts",
        "sheets/effects-actions.ts",
        "sheets/item-effects-actions.ts",
        "sheets/item-row-actions.ts",
      ].sort(),
    );
  });
});
```

Run: `npx vitest run tests/dialogs/dialog-theme-guard.test.ts` → FAIL (wrapper file missing; offenders present).

- [ ] **Step 2: The wrappers**

Create `src/dialogs/themed-dialog-foundry.ts`:

```ts
// Themed DialogV2 wrappers (#150). Foundry-coupled; the only place in src/ allowed to call DialogV2.prompt/confirm
// directly (tests/dialogs/dialog-theme-guard.test.ts enforces that). They add the system dialog classes so
// styles/dialog/_dialog.scss themes our own dialogs and nothing else.
import { withDialogTheme } from "./themed-dialog";

/** DialogV2.prompt with the system dialog theme. Same signature and result as the core call. */
export const themedPrompt: typeof foundry.applications.api.DialogV2.prompt = (config) =>
  foundry.applications.api.DialogV2.prompt(withDialogTheme(config as never) as never);

/** DialogV2.confirm with the system dialog theme. Same signature and result as the core call. */
export const themedConfirm: typeof foundry.applications.api.DialogV2.confirm = (config) =>
  foundry.applications.api.DialogV2.confirm(withDialogTheme(config as never) as never);
```
(If fvtt-types rejects the contextually-typed arrow, change each to `((config: unknown) => …) as typeof foundry.applications.api.DialogV2.prompt` / `.confirm`. Keep the exported types equal to the core ones.)

- [ ] **Step 3: Convert the 14 call sites**

In each listed file add `import { themedConfirm, themedPrompt } from "<relative path>/dialogs/themed-dialog-foundry";` (only the names that file uses; the relative path from `src/sheets/character/` is `../../dialogs/themed-dialog-foundry`, from `src/sheets/` is `../dialogs/themed-dialog-foundry`, from `src/combat/` and `src/relay/` is `../dialogs/themed-dialog-foundry`) and replace `foundry.applications.api.DialogV2.prompt(` with `themedPrompt(` and `foundry.applications.api.DialogV2.confirm(` with `themedConfirm(`. Make no other change (content, labels, callbacks, casts all stay). Update only code; leave the explanatory comments that mention `DialogV2.prompt` as they are (the guard strips comments).

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/dialogs && npm run typecheck && npm run lint && npx vitest run`
Expected: PASS. Typecheck is the real check that every call site's inferred types survive; if any call site's inference breaks, fix the wrapper typing (not the call site).

- [ ] **Step 5: Commit**

```bash
git add src/dialogs/themed-dialog-foundry.ts tests/dialogs/dialog-theme-guard.test.ts src/combat/initiative-modifier-dialog.ts src/relay/relay-handler.ts src/sheets/character/combat-rolls.ts src/sheets/character/free-magick-dialog.ts src/sheets/character/psionic-wild.ts src/sheets/character/recover-dialog.ts src/sheets/character/sheet.ts src/sheets/creature/combat-rolls.ts src/sheets/effects-actions.ts src/sheets/item-effects-actions.ts src/sheets/item-row-actions.ts
git commit -m "feat(dialogs): themed prompt/confirm wrappers and all 14 call sites (#150)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The dialog stylesheet and theme tokens

**Files:**
- Create: `styles/dialog/_dialog.scss`
- Modify: `styles/theme/_tokens.scss` (add `.adnd2e.adnd2e-dialog` to the light block and to the dark block's selector lists)
- Modify: `styles/system.scss` (add `@use "dialog/dialog";` after `@use "chat/chat";`)
- Create: `tests/styles/dialog-theme.test.ts`

**Interfaces:**
- Produces: styling for any `DialogV2` whose app element has `adnd2e adnd2e-dialog` classes, in light and dark.

Read `styles/theme/_tokens.scss` (light block `.adnd2e.pc-sheet, .adnd2e.sheet.raw-field-sheet { … }`; dark block `body.theme-dark …, … .theme-dark { … }`) and `styles/chat/_chat.scss` (the button rule is the model for the footer buttons) first.

- [ ] **Step 1: Write the failing test**

Create `tests/styles/dialog-theme.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const TOKENS = readFileSync(path.join(ROOT, "styles", "theme", "_tokens.scss"), "utf8");
const DIALOG = readFileSync(path.join(ROOT, "styles", "dialog", "_dialog.scss"), "utf8");
const SYSTEM = readFileSync(path.join(ROOT, "styles", "system.scss"), "utf8");

describe("dialog theme (#150)", () => {
  it("is loaded from system.scss", () => {
    expect(SYSTEM).toContain("dialog/dialog");
  });
  it("the shared token blocks cover the dialog in both themes, keyed to the app element", () => {
    expect(TOKENS).toContain(".adnd2e.adnd2e-dialog");
    expect(TOKENS).toContain("body.theme-dark .adnd2e.adnd2e-dialog");
    expect(TOKENS).toContain(".adnd2e.adnd2e-dialog.theme-dark");
  });
  it("styles the title bar, form fields and footer buttons", () => {
    expect(DIALOG).toContain(".window-header");
    expect(DIALOG).toContain(".form-footer");
    expect(DIALOG).toContain('[data-action="ok"]');
    expect(DIALOG).toContain('[data-action="yes"]');
    expect(DIALOG).toContain(":disabled");
  });
  it("only ever targets our own dialog class, never every core dialog", () => {
    expect(DIALOG).toContain(".adnd2e.adnd2e-dialog");
    expect(DIALOG).not.toMatch(/(^|\n)\s*\.dialog\b/);
  });
  it("uses no !important and never core's bare .disabled class", () => {
    expect(DIALOG).not.toContain("!important");
    expect(DIALOG).not.toMatch(/\.disabled\b/);
  });
});
```

Run: `npx vitest run tests/styles/dialog-theme.test.ts` → FAIL.

- [ ] **Step 2: Tokens**

In `styles/theme/_tokens.scss` change the light selector list to `.adnd2e.pc-sheet,\n.adnd2e.sheet.raw-field-sheet,\n.adnd2e.adnd2e-dialog {` and the dark selector list to add `body.theme-dark .adnd2e.adnd2e-dialog,` and `.adnd2e.adnd2e-dialog.theme-dark,` (keep the existing entries and the declarations unchanged).

- [ ] **Step 3: The stylesheet**

Create `styles/dialog/_dialog.scss`:

```scss
// System dialogs (#150 part 2). Only dialogs opened through src/dialogs/themed-dialog-foundry.ts carry the
// `adnd2e adnd2e-dialog` classes, so core's and other modules' dialogs are never restyled. Tokens come from
// styles/theme/_tokens.scss (keyed to this app element). system.css is unlayered, so these rules beat core's layered
// ones without !important. DialogV2 structure: <dialog class="application dialog …"> → .window-header, .window-content >
// form.dialog-form > .dialog-content + footer.form-footer (buttons carry data-action="ok"|"yes"|"no"|…).
.adnd2e.adnd2e-dialog {
  background-color: var(--kit-bg);
  background-image: var(--kit-bg-image);
  color: var(--kit-ink);
  border: 1px solid var(--kit-maroon);

  .window-header {
    background: var(--kit-maroon);
    color: var(--kit-maroon-ink);
    border-bottom: 0;

    .window-title, button, .header-control { color: inherit; }
  }

  .window-content {
    background: transparent;
    color: inherit;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
  }

  p { color: inherit; }

  input[type="text"], input[type="number"], select, textarea {
    background: var(--kit-field-bg);
    color: var(--kit-field-ink);
    border: 1px solid var(--kit-field-border);
    border-radius: 2px;
  }

  // footer buttons: the affirmative action is filled maroon, everything else an outline
  .form-footer button {
    min-height: 0;
    font-family: inherit;
    font-size: 12px;
    line-height: 1.5;
    padding: 2px 12px;
    background: transparent;
    color: var(--kit-accent-ink);
    border: 1px solid var(--kit-maroon);
    border-radius: 3px;
    cursor: pointer;

    &:hover:not(:disabled) { background: var(--kit-maroon); color: var(--kit-maroon-ink); }
    &:disabled { opacity: .5; cursor: default; }

    &[data-action="ok"], &[data-action="yes"] {
      background: var(--kit-maroon);
      color: var(--kit-maroon-ink);
    }
    &[data-action="ok"]:hover:not(:disabled), &[data-action="yes"]:hover:not(:disabled) { filter: brightness(1.15); }
  }
}
```

- [ ] **Step 4: Load it**

In `styles/system.scss` add `@use "dialog/dialog";` after `@use "chat/chat";`.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run tests/styles && npx vite build --outDir <scratchpad>/build-dialog`, then grep the compiled `system.css` for `.adnd2e.adnd2e-dialog`, `body.theme-dark .adnd2e.adnd2e-dialog` and `[data-action=ok]`/`[data-action=yes]` forms; then `npm run typecheck && npm run lint && npx vitest run`.
Expected: all pass; the build compiles.

```bash
git add styles/dialog/_dialog.scss styles/theme/_tokens.scss styles/system.scss tests/styles/dialog-theme.test.ts
git commit -m "feat(theme): parchment and leather system dialogs with a maroon title bar (#150)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Gates, compiled-CSS proof, and the manual checklist

**Files:**
- Modify: `README.md` only if it describes dialog or theming scope (`grep -n -i "dialog\|theme" README.md`); otherwise skip.

- [ ] **Step 1: Full CI sequence**

Run: `npm run lint && npm run typecheck && npm run test:coverage && npx vite build --outDir "<scratchpad>/build-final"`
Expected: green; 100% statement coverage; build succeeds.

- [ ] **Step 2: Compiled-CSS proof**

From the compiled `system.css`, report: (1) token blocks for `.adnd2e.adnd2e-dialog` in light and under `body.theme-dark`; (2) the footer button rules incl. the `ok`/`yes` filled forms and `:disabled`; (3) no rule that targets a bare `.dialog` or `dialog` element without `.adnd2e-dialog` among the new rules; (4) `!important` count in the whole file (expect 0); (5) the `[data-action="ok"]` attribute selectors survived compilation. Also verify with a headless read (node) of Foundry's DialogV2 source (`C:/Program Files/Foundry Virtual Tabletop/resources/app/client/applications/api/dialog.mjs` and `application.mjs`) that an app `options.classes` array is MERGED with `DEFAULT_OPTIONS.classes` (`["dialog"]`) and not replaced, and that `confirm` and `prompt` pass `...config` through to the constructor; report the lines. Say what is proven and not (actual colours and layout, the non-GM seat, the `<dialog>` element backdrop).

- [ ] **Step 3: README (only if needed) and commit**

If the grep finds an outdated statement, update it and commit `docs: themed dialogs (#150)`; otherwise no commit.

- [ ] **Step 4: Manual dev-world checklist (the controller hands this to the user)**

Prerequisites: Foundry closed, `npm run build`, relaunch. A PC with a Fighter class and a weapon; a wizard with a spell and free magick available (spell-points rule on if needed); a psionicist if available; a Monster NPC with an attack; an effect on an item; combat running. Run once in Foundry's light theme and once in dark. Reset any setting you change.
1. **Manual AC:** make an attack with nothing targeted (PC and Monster NPC): a parchment/leather dialog with a maroon title bar, a themed number box, and a filled maroon OK button.
2. **Award XP** (the "Award XP" button on the PC sheet): same look.
3. **Initiative modifier:** open the combat tracker, right-click a combatant, choose the modifier entry.
4. **Free magick** (memorize and cast pickers) and **Recover** (rest/fatigue) dialogs, and the **wild talent** test and its confirm.
5. **Confirms:** delete an owned item, delete a custom effect on an actor, delete an effect on an item, and (as a player applying damage to a token they don't own with the relay approval setting on) the GM's approval confirm. The Yes button is filled maroon, No is an outline, and "No" is focused by default (Enter cancels).
6. A disabled button (if any dialog shows one) looks dimmed; hover fills the outlined buttons.
7. Foundry's own dialogs (delete a token, or the Configure Settings window) look exactly as before.
8. The PC sheet, item sheets and chat cards look as before (no regression).
9. From a non-GM seat repeat 1, 2 and 5.
```

---

## Self-Review

- **Spec coverage:** §1 pure builder (idempotent, non-mutating, preserves classes) → Task 1; §2 wrappers + all 14 call sites → Task 2; §3 guard test (and the importer list) → Task 2; §4 styles (tokens for light/dark keyed to the app element, maroon title bar, form fields, filled/outlined buttons, disabled, no `!important`/`.disabled`) → Task 3; §5 out of scope respected; Testing: unit + guard + style census (Tasks 1-3), gates and compiled-CSS proof incl. the `classes` merge check (Task 4), manual checklist (Task 4).
- **Spec risk addressed:** "`classes` merging must not drop core's `dialog` class" is verified in Task 4 Step 2 from Foundry's source and in the dev-world checklist item 7.
- **Placeholders:** none; code is complete. The wrapper typing has a stated fallback.
- **Consistency:** `DIALOG_CLASSES` / `withDialogTheme` (Task 1) are what the wrapper (Task 2) imports; the classes `adnd2e` / `adnd2e-dialog` are what Task 3's tokens and stylesheet key on; the guard test's importer list matches the 11 files in Global Constraints.
