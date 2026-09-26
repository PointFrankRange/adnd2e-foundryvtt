import { describe, expect, it } from "vitest";
import { lockState } from "../../../src/sheets/kit/lock";

describe("lockState", () => {
  it("only an editor can unlock, and only an editor is ever unlocked", () => {
    expect(lockState(true, false)).toEqual({ canUnlock: true, unlocked: false });
    expect(lockState(true, true)).toEqual({ canUnlock: true, unlocked: true });
    expect(lockState(false, true)).toEqual({ canUnlock: false, unlocked: false });
    expect(lockState(false, false)).toEqual({ canUnlock: false, unlocked: false });
  });
});
