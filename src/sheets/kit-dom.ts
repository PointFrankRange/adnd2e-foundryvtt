// DOM behaviour for the sheet kit (sheet redesign R1): collapsible item-table
// sections (state per viewer in localStorage), the client-side filter box, and
// click-to-expand item summaries. No document writes. Foundry-free DOM glue,
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
    const scope = root.querySelector<HTMLElement>(`[data-kit-filter-scope="${input.dataset.kitFilter}"]`);
    if (!scope) continue;
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      for (const row of Array.from(scope.querySelectorAll<HTMLElement>("[data-kit-name]"))) {
        row.hidden = q !== "" && !(row.dataset.kitName ?? "").toLowerCase().includes(q);
      }
    });
    // the filter is not a form field: keep its keystrokes out of submitOnChange
    input.addEventListener("change", (event: Event) => event.stopPropagation());
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-kit-expand]"))) {
    el.addEventListener("click", () => el.closest("[data-kit-row]")?.classList.toggle("expanded"));
  }
}
