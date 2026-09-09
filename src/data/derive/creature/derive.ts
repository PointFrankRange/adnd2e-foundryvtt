import { thac0 } from "../../../core/classes/thac0";
import { saveBaseTarget } from "../../../core/saves";
import type { ClassGroup, SaveCategory } from "../../../core/types";
import type { CreatureDerived, CreatureSnapshot } from "./snapshot";

const CATEGORIES: readonly SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];

/** §5.3 — the derived values for a monster. Monsters state AC directly, so it is not here. */
export function deriveCreature(snapshot: CreatureSnapshot): CreatureDerived {
  const { hd } = snapshot;
  const perDie = Math.round((hd.dieType + 1) / 2);
  const hpMax = hd.fixedHp ?? Math.floor(hd.count * perDie + hd.bonus);

  const thac0Value =
    snapshot.thac0AsFighterLevel !== null
      ? thac0("warrior", snapshot.thac0AsFighterLevel)
      : snapshot.authoredThac0;

  const saves =
    snapshot.saveMode === "asClass" && snapshot.asClassSave.group !== ""
      ? asClassSaves(snapshot.asClassSave.group, snapshot.asClassSave.level)
      : snapshot.explicitSaves;

  return { hpMax, thac0: thac0Value, saves };
}

function asClassSaves(group: ClassGroup, level: number): Record<SaveCategory, number> {
  const out = {} as Record<SaveCategory, number>;
  for (const category of CATEGORIES) out[category] = saveBaseTarget(group, level, category);
  return out;
}
