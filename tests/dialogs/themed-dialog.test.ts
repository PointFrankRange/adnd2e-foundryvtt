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
