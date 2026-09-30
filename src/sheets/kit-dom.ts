// DOM behaviour for the sheet kit (sheet redesign R1): collapsible item-table
// sections (state per viewer in localStorage), the client-side filter box, and
// click-to-expand item summaries (state per open sheet, surviving a
// re-render — see `expandedRows`). No document writes. Foundry-free DOM glue,
// dev-world verified.

const key = (sheetKey: string, section: string): string => `adnd2e.collapsed.${sheetKey}.${section}`;

function readCollapsed(sheetKey: string, section: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key(sheetKey, section)) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(sheetKey: string, section: string, collapsed: boolean): void {
  try {
    globalThis.localStorage?.setItem(key(sheetKey, section), collapsed ? "1" : "0");
  } catch {
    // storage unavailable (private mode, blocked site data) — collapse just isn't remembered
  }
}

/** Dev-world fix 8: the filter box's typed text, keyed by `${sheetKey}:${filterId}`,
 *  so it survives the DOM being rebuilt on every re-render (the PC sheet's form has
 *  `submitOnChange: true` and no submit button, so a plain Enter keypress in ANY
 *  text field — including this one — natively submits the form via implicit
 *  submission unless something stops it; and ApplicationV2 re-renders the whole
 *  part on every document update regardless of what triggered it). A module-level
 *  Map, not localStorage: this is per-open-sheet state, not a durable preference,
 *  and must NOT survive a close (see `clearSheetKit`). */
const filterText = new Map<string, string>();

function filterKey(sheetKey: string, filterId: string): string {
  return `${sheetKey}:${filterId}`;
}

/** Applies `q` (already trimmed + lowercased) to every `[data-kit-name]` row inside
 *  `scope`, then hides any `[data-kit-section]` left with zero visible rows —
 *  re-run both on input AND right after a re-render so a persisted filter's row/
 *  section visibility is restored along with the input's value. */
function applyFilter(scope: HTMLElement, q: string): void {
  for (const row of Array.from(scope.querySelectorAll<HTMLElement>("[data-kit-name]"))) {
    row.hidden = q !== "" && !(row.dataset.kitName ?? "").toLowerCase().includes(q);
  }
  for (const section of Array.from(scope.querySelectorAll<HTMLElement>("[data-kit-section]"))) {
    const rows = Array.from(section.querySelectorAll<HTMLElement>("[data-kit-name]"));
    section.hidden = q !== "" && rows.every((row) => row.hidden);
  }
}

/** Which item rows are expanded, per sheet — same rationale and lifecycle as
 *  `filterText` above (a re-render rebuilds the row DOM from scratch with no
 *  memory of which rows were expanded, so this must be restored after every
 *  render; per-open-sheet state, not a durable preference, cleared on close). */
const expandedRows = new Map<string, Set<string>>();

/** Drops a sheet's persisted filter text and expanded-row state when its
 *  sheet closes — otherwise these module-level maps would leak an entry per
 *  closed sheet for the rest of the client session. Call from the sheet's
 *  `_onClose` with the SAME `sheetKey` passed to `bindSheetKit`. */
export function clearSheetKit(sheetKey: string): void {
  const prefix = `${sheetKey}:`;
  for (const k of Array.from(filterText.keys())) {
    if (k.startsWith(prefix)) filterText.delete(k);
  }
  expandedRows.delete(sheetKey);
}

export function bindSheetKit(root: HTMLElement, sheetKey: string): void {
  // NodeListOf isn't iterable under this project's tsconfig lib set (no
  // "DOM.Iterable") — Array.from, same as sheet.ts's own querySelectorAll use.
  for (const section of Array.from(root.querySelectorAll<HTMLElement>("[data-kit-section]"))) {
    const id = section.dataset.kitSection ?? "";
    if (readCollapsed(sheetKey, id)) section.classList.add("collapsed");
    section.querySelector<HTMLElement>("[data-kit-section-toggle]")?.addEventListener("click", (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest("button, input, select, a")) return;
      writeCollapsed(sheetKey, id, section.classList.toggle("collapsed"));
    });
  }
  for (const input of Array.from(root.querySelectorAll<HTMLInputElement>("input[data-kit-filter]"))) {
    // A non-owner observer's sheet renders read-only: DocumentSheetV2's own
    // _onRender (which our _onRender's `super` call runs before this) blanket-
    // disables every element in `form.elements` via `_toggleDisabled(true)`
    // whenever `!isEditable` (client/applications/api/document-sheet.mjs) —
    // this filter box writes nothing (it's excluded from form submission
    // below) and reads the actor a viewer can already see, so it should stay
    // usable regardless of edit permission.
    input.disabled = false;
    const filterId = input.dataset.kitFilter ?? "";
    const scope = root.querySelector<HTMLElement>(`[data-kit-filter-scope="${filterId}"]`);
    if (!scope) continue;
    const fKey = filterKey(sheetKey, filterId);

    // Restore this filter across the re-render that just happened: the
    // template has no memory of what was typed, so both the input's value
    // and every row/section's visibility need re-applying here.
    const persisted = filterText.get(fKey) ?? "";
    input.value = persisted;
    applyFilter(scope, persisted);

    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      filterText.set(fKey, q);
      applyFilter(scope, q);
    });
    // the filter is not a form field: keep its keystrokes out of submitOnChange
    input.addEventListener("change", (event: Event) => event.stopPropagation());
    // Enter in this field would otherwise natively (implicitly) submit the PC
    // sheet's form — it has `submitOnChange: true` and no submit button, so
    // ApplicationV2's _onSubmitForm runs and the sheet re-renders, which reads
    // as "the filter does nothing" to a user who just typed and hit Enter.
    input.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter") event.preventDefault();
    });
  }
  const expanded = expandedRows.get(sheetKey) ?? new Set<string>();
  expandedRows.set(sheetKey, expanded);
  for (const row of Array.from(root.querySelectorAll<HTMLElement>("[data-kit-row]"))) {
    const itemId = row.dataset.itemId;
    if (itemId && expanded.has(itemId)) row.classList.add("expanded");
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-kit-expand]"))) {
    el.addEventListener("click", () => {
      const row = el.closest<HTMLElement>("[data-kit-row]");
      if (!row) return;
      const itemId = row.dataset.itemId;
      const isExpanded = row.classList.toggle("expanded");
      if (!itemId) return;
      if (isExpanded) expanded.add(itemId);
      else expanded.delete(itemId);
    });
  }
}
