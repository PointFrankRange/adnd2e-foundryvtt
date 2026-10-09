import { describe, expect, it } from "vitest";
import { buildEffectsView, type EffectRecord } from "../../../src/sheets/effects/view";

const rec = (over: Partial<EffectRecord> = {}): EffectRecord => ({
  id: "e1", name: "Bless", img: "icons/svg/aura.svg",
  disabled: false, suppressed: false,
  isCondition: false, conditionId: null,
  durationLabel: "", source: null,
  ...over,
});

describe("buildEffectsView", () => {
  it("groups conditions, custom and item effects in that order and omits empty groups", () => {
    const view = buildEffectsView(
      [
        rec({ id: "i", name: "Ring", source: { id: "it1", name: "Ring of Protection" } }),
        rec({ id: "c", name: "Custom" }),
        rec({ id: "s", name: "Stunned", isCondition: true, conditionId: "stunned" }),
      ],
      true,
    );
    expect(view.groups.map((g) => g.key)).toEqual(["conditions", "custom", "items"]);
    expect(view.groups.map((g) => g.labelKey)).toEqual([
      "ADND2E.sheet.effects.groups.conditions",
      "ADND2E.sheet.effects.groups.custom",
      "ADND2E.sheet.effects.groups.items",
    ]);
    const onlyCustom = buildEffectsView([rec()], true);
    expect(onlyCustom.groups.map((g) => g.key)).toEqual(["custom"]);
    expect(onlyCustom.isEmpty).toBe(false);
  });

  it("is empty with no records, but still offers create when editable", () => {
    const view = buildEffectsView([], true);
    expect(view.groups).toEqual([]);
    expect(view.isEmpty).toBe(true);
    expect(view.canCreate).toBe(true);
  });

  it("an effect on an item is From items even if it is flagged as a condition", () => {
    const view = buildEffectsView(
      [rec({ isCondition: true, conditionId: "held", source: { id: "it1", name: "Net" } })],
      true,
    );
    expect(view.groups.map((g) => g.key)).toEqual(["items"]);
  });

  it("custom rows get toggle/edit/delete; conditions only remove; item rows only open-source", () => {
    const view = buildEffectsView(
      [
        rec({ id: "c" }),
        rec({ id: "s", isCondition: true, conditionId: "stunned" }),
        rec({ id: "i", source: { id: "it1", name: "Ring" } }),
      ],
      true,
    );
    const row = (id: string) => view.groups.flatMap((g) => g.rows).find((r) => r.id === id)!;
    expect(row("c")).toMatchObject({ canToggle: true, canEdit: true, canDelete: true, canRemove: false, canOpenSource: false });
    expect(row("s")).toMatchObject({ canToggle: false, canEdit: false, canDelete: false, canRemove: true, canOpenSource: false });
    expect(row("i")).toMatchObject({
      canToggle: false, canEdit: false, canDelete: false, canRemove: false, canOpenSource: true,
      sourceId: "it1", sourceName: "Ring",
    });
  });

  it("a non-editable sheet hides every mutating control but keeps open-source", () => {
    const view = buildEffectsView(
      [
        rec({ id: "c" }),
        rec({ id: "s", isCondition: true, conditionId: "stunned" }),
        rec({ id: "i", source: { id: "it1", name: "Ring" } }),
      ],
      false,
    );
    expect(view.canCreate).toBe(false);
    const rows = view.groups.flatMap((g) => g.rows);
    for (const r of rows) {
      expect(r.canToggle || r.canEdit || r.canDelete || r.canRemove).toBe(false);
    }
    expect(rows.find((r) => r.id === "i")!.canOpenSource).toBe(true);
  });

  it("passes disabled, suppressed, duration label and image through", () => {
    const view = buildEffectsView(
      [rec({ disabled: true, suppressed: true, durationLabel: "3 rounds", img: "x.svg" })],
      true,
    );
    expect(view.groups[0]!.rows[0]).toMatchObject({
      disabled: true, suppressed: true, durationLabel: "3 rounds", img: "x.svg", sourceId: "", sourceName: "",
    });
  });
});
