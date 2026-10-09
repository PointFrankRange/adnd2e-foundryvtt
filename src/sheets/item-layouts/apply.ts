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
