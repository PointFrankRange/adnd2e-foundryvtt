import { thac0 } from "../../../core/classes/thac0";
import { saveBaseTarget } from "../../../core/saves";
import type { ClassGroup, SaveCategory } from "../../../core/types";
import type { CreatureDerived, CreatureSnapshot } from "./snapshot";

const CATEGORIES: readonly SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];
const CLASS_GROUPS: readonly ClassGroup[] = ["warrior", "wizard", "priest", "rogue"];

/** §5.3 — the derived values for a monster. Monsters state AC directly, so it is not here. */
export function deriveCreature(snapshot: CreatureSnapshot): CreatureDerived {
  const { hd } = snapshot;
  const perDie = Math.round((hd.dieType + 1) / 2);
  const hpMax = hd.fixedHp ?? Math.floor(hd.count * perDie + hd.bonus);

  const thac0Value =
    snapshot.thac0AsFighterLevel !== null
      ? thac0("warrior", snapshot.thac0AsFighterLevel)
      : snapshot.authoredThac0;

  // Guard against a non-group `group` value (imported JSON, an old actor, a
  // migration gap): fall back to the authored explicit numbers rather than
  // throwing inside saveBaseTarget.
  const g = snapshot.asClassSave.group;
  const saves =
    snapshot.saveMode === "asClass" && isClassGroup(g)
      ? asClassSaves(g, snapshot.asClassSave.level)
      : { ...snapshot.explicitSaves };

  return { hpMax, thac0: thac0Value, saves };
}

function isClassGroup(g: string): g is ClassGroup {
  return (CLASS_GROUPS as readonly string[]).includes(g);
}

function asClassSaves(group: ClassGroup, level: number): Record<SaveCategory, number> {
  const out = {} as Record<SaveCategory, number>;
  for (const category of CATEGORIES) out[category] = saveBaseTarget(group, level, category);
  return out;
}
