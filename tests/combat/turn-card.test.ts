import { describe, expect, it } from "vitest";
import { buildTurnCardContext } from "../../src/combat/turn-card";

describe("buildTurnCardContext", () => {
  it("labels each row's status and carries the roll", () => {
    const ctx = buildTurnCardContext({
      actorName: "Gorus",
      actorImg: "gorus.png",
      naturalD20: 12,
      level: 7,
      cap: 9,
      bonusCap: 5,
      rows: [
        { name: "Skeleton", img: "s.png", status: "destroyed" },
        { name: "Spectre", img: "p.png", status: "fail" },
      ],
    });
    expect(ctx.formula).toBe("1d20");
    expect(ctx.naturalD20).toBe(12);
    expect(ctx.level).toBe(7);
    expect(ctx.rows.map((r) => r.statusLabel)).toEqual(["ADND2E.chat.turn.status.destroyed", "ADND2E.chat.turn.status.fail"]);
  });
});
