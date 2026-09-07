// PHB Table 3: CONSTITUTION (p.15; Appendix 8 p.245).
import { assertAbilityScore } from "../errors";
import type { ConstitutionModifiers } from "../types";

type Row = [number, number, number, number, number, string, number];

const BY_SCORE: Record<number, Row> = {
  1: [-3, -3, 25, 30, -2, "Nil", 1],
  2: [-2, -2, 30, 35, -1, "Nil", 1],
  3: [-2, -2, 35, 40, 0, "Nil", 1],
  4: [-1, -1, 40, 45, 0, "Nil", 1],
  5: [-1, -1, 45, 50, 0, "Nil", 1],
  6: [-1, -1, 50, 55, 0, "Nil", 1],
  7: [0, 0, 55, 60, 0, "Nil", 1],
  8: [0, 0, 60, 65, 0, "Nil", 1],
  9: [0, 0, 65, 70, 0, "Nil", 1],
  10: [0, 0, 70, 75, 0, "Nil", 1],
  11: [0, 0, 75, 80, 0, "Nil", 1],
  12: [0, 0, 80, 85, 0, "Nil", 1],
  13: [0, 0, 85, 90, 0, "Nil", 1],
  14: [0, 0, 88, 92, 0, "Nil", 1],
  15: [1, 1, 90, 94, 0, "Nil", 1],
  16: [2, 2, 95, 96, 0, "Nil", 1],
  17: [2, 3, 97, 98, 0, "Nil", 1],
  18: [2, 4, 99, 100, 0, "Nil", 1],
  19: [2, 5, 99, 100, 1, "Nil", 1],
  20: [2, 5, 99, 100, 1, "1/6 turns", 2],
  21: [2, 6, 99, 100, 2, "1/5 turns", 3],
  22: [2, 6, 99, 100, 2, "1/4 turns", 3],
  23: [2, 6, 99, 100, 3, "1/3 turns", 4],
  24: [2, 7, 99, 100, 3, "1/2 turns", 4],
  25: [2, 7, 100, 100, 4, "1/1 turn", 4],
};

export function constitution(score: number, isWarrior: boolean): ConstitutionModifiers {
  assertAbilityScore(score, "con");
  const [hpNon, hpWar, systemShock, resurrectionSurvival, poisonSave, regeneration, hitDieMinimumRoll] =
    BY_SCORE[score];
  return {
    hpAdjustment: isWarrior ? hpWar : hpNon,
    systemShock,
    resurrectionSurvival,
    poisonSave,
    regeneration,
    hitDieMinimumRoll,
  };
}
