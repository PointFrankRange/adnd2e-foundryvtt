import { describe, expect, it } from "vitest";
import { spellDeletionUpdate } from "../../src/magic/spell-cleanup";

const m = (spellItemId: string, spellLevel = 1, expended = false) => ({ spellItemId, spellLevel, expended });

function system(over: {
  spellbook?: string[];
  wizard?: ReturnType<typeof m>[];
  priest?: ReturnType<typeof m>[];
  casting?: { spellItemId: string } | null;
} = {}) {
  return {
    spellcasting: {
      wizard: { spellbookItemIds: over.spellbook ?? [], memorized: over.wizard ?? [] },
      priest: { memorized: over.priest ?? [] },
    },
    options: { spellsAndMagic: { casting: over.casting ?? null } },
  };
}

describe("spellDeletionUpdate", () => {
  it("is empty when the deleted spell appears nowhere", () => {
    expect(spellDeletionUpdate(system({ spellbook: ["a"], wizard: [m("a")], priest: [m("b")] }), "z")).toEqual({});
  });

  it("removes the spell from the wizard spellbook", () => {
    expect(spellDeletionUpdate(system({ spellbook: ["a", "z", "b"] }), "z")).toEqual({
      "system.spellcasting.wizard.spellbookItemIds": ["a", "b"],
    });
  });

  it("removes every memorized copy from the wizard list and keeps the rest", () => {
    expect(spellDeletionUpdate(system({ wizard: [m("a"), m("z", 1, true), m("z", 2)] }), "z")).toEqual({
      "system.spellcasting.wizard.memorized": [m("a")],
    });
  });

  it("removes memorized copies from the priest list", () => {
    expect(spellDeletionUpdate(system({ priest: [m("z"), m("c", 3)] }), "z")).toEqual({
      "system.spellcasting.priest.memorized": [m("c", 3)],
    });
  });

  it("clears an in-progress cast of that spell, but not a cast of another spell", () => {
    expect(spellDeletionUpdate(system({ casting: { spellItemId: "z" } }), "z")).toEqual({
      "system.options.spellsAndMagic.casting": null,
    });
    expect(spellDeletionUpdate(system({ casting: { spellItemId: "a" } }), "z")).toEqual({});
  });

  it("combines every change into one update", () => {
    expect(
      spellDeletionUpdate(
        system({ spellbook: ["z"], wizard: [m("z")], priest: [m("z")], casting: { spellItemId: "z" } }),
        "z",
      ),
    ).toEqual({
      "system.spellcasting.wizard.spellbookItemIds": [],
      "system.spellcasting.wizard.memorized": [],
      "system.spellcasting.priest.memorized": [],
      "system.options.spellsAndMagic.casting": null,
    });
  });

  it("tolerates a system with no options block (e.g. data from before Sub-project 9)", () => {
    const s = system({ spellbook: ["z"] }) as { options?: unknown };
    delete s.options;
    expect(spellDeletionUpdate(s as never, "z")).toEqual({ "system.spellcasting.wizard.spellbookItemIds": [] });
  });

  it("an actor with no spellcasting block returns {}", () => {
    expect(spellDeletionUpdate({} as never, "z")).toEqual({});
  });
});
