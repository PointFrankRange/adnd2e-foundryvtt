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

  it("nested headings: removes orphaned parents when children are all claimed elsewhere", () => {
    const rows = [
      row("system.grp", { header: true }), row("system.grp.sub", { header: true }), row("system.grp.sub.x"),
    ];
    const r = applyLayout(rows, { strip: ["system.grp.sub.x"], panels: [] });
    expect(paths(r.strip.map((s) => s.row))).toEqual(["system.grp.sub.x"]);
    expect(r.trailing).toEqual([]); // no Other panel because no rows left after fixpoint removal
  });

  it("descriptionAfterPanel with a skipped empty panel earlier", () => {
    const r = applyLayout(ROWS, {
      descriptionAfterPanel: 1,
      panels: [
        { titleKey: "t.empty", paths: ["system.missing"] }, // skipped because empty
        { titleKey: "t.a", paths: ["system.a"] },              // layout index 1, rendered as panel index 0
        { titleKey: "t.b", paths: ["system.b"] },              // layout index 2, rendered as panel index 1
      ],
    });
    expect(r.leading.map((p) => p.titleKey)).toEqual(["t.a"]); // only t.a, because skipped panel doesn't count
    expect(r.trailing.map((p) => p.titleKey)).toEqual(["t.b", OTHER_TITLE_KEY]);
  });

  it("descriptionAfterPanel pointing at an empty panel does not crash", () => {
    const r = applyLayout(ROWS, {
      descriptionAfterPanel: 0,
      panels: [{ titleKey: "t.empty", paths: ["system.missing"] }],
    });
    expect(r.leading).toEqual([]);
    expect(r.trailing[0]!.titleKey).toBe(OTHER_TITLE_KEY);
  });

  it("descriptionAfterPanel beyond the panel count puts all rendered panels in leading", () => {
    const r = applyLayout(ROWS, {
      descriptionAfterPanel: 10,
      panels: [{ titleKey: "t.a", paths: ["system.a"] }, { titleKey: "t.b", paths: ["system.b"] }],
    });
    expect(r.leading.map((p) => p.titleKey)).toEqual(["t.a", "t.b"]);
    expect(r.trailing[0]!.titleKey).toBe(OTHER_TITLE_KEY);
  });

  it("negative descriptionAfterPanel behaves as no split (description stays above every panel)", () => {
    const r = applyLayout(ROWS, {
      descriptionAfterPanel: -1,
      panels: [{ titleKey: "t.a", paths: ["system.a"] }, { titleKey: "t.b", paths: ["system.b"] }],
    });
    expect(r.leading).toEqual([]);
    expect(r.trailing.map((p) => p.titleKey)).toEqual(["t.a", "t.b", OTHER_TITLE_KEY]);
  });

  it("a heading claimed after its children were taken by the strip still renders as the lone heading row", () => {
    const rows = [
      row("system.grp", { header: true }), row("system.grp.x"), row("system.grp.y"),
    ];
    const r = applyLayout(rows, {
      strip: ["system.grp.x", "system.grp.y"],
      panels: [{ titleKey: "t", paths: ["system.grp"] }],
    });
    expect(paths(r.strip.map((s) => s.row))).toEqual(["system.grp.x", "system.grp.y"]);
    expect(paths(r.trailing[0]!.rows)).toEqual(["system.grp"]); // the heading row remains
  });
});
