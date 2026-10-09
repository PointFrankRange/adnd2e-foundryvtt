import { describe, expect, it } from "vitest";
import { buildItemEffectsView, type ItemEffectRecord } from "../../../src/sheets/effects/item-view";

const rec = (over: Partial<ItemEffectRecord> = {}): ItemEffectRecord => ({
  id: "e1", name: "+1 to hit", img: "icons/svg/aura.svg",
  disabled: false, transfer: true, suppressWhenUnequipped: true,
  suppressed: false, durationLabel: "",
  ...over,
});

describe("buildItemEffectsView", () => {
  it("is empty with no records but still offers create when editable", () => {
    const view = buildItemEffectsView([], true);
    expect(view.rows).toEqual([]);
    expect(view.isEmpty).toBe(true);
    expect(view.canCreate).toBe(true);
  });

  it("an editable sheet gives every row all four controls, in input order", () => {
    const view = buildItemEffectsView([rec({ id: "a" }), rec({ id: "b" })], true);
    expect(view.isEmpty).toBe(false);
    expect(view.rows.map((r) => r.id)).toEqual(["a", "b"]);
    for (const r of view.rows) {
      expect(r).toMatchObject({ canToggle: true, canEdit: true, canDelete: true, canTransfer: true });
    }
  });

  it("a non-editable sheet shows the list with no controls and no create", () => {
    const view = buildItemEffectsView([rec()], false);
    expect(view.canCreate).toBe(false);
    expect(view.rows[0]).toMatchObject({ canToggle: false, canEdit: false, canDelete: false, canTransfer: false });
    expect(view.isEmpty).toBe(false);
  });

  it("passes every record field through unchanged", () => {
    const record = rec({
      id: "x", name: "Flame", img: "i.svg", disabled: true, transfer: false,
      suppressWhenUnequipped: false, suppressed: true, durationLabel: "3 rounds",
    });
    expect(buildItemEffectsView([record], true).rows[0]).toMatchObject(record);
  });
});
