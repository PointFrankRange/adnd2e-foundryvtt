// PHB Table 35: SPECIALIST ATTACKS PER ROUND (p.52). Fighter weapon specialists
// only (gated by proficiencies/weapon.ts canWeaponSpecialize). Bow specialists
// gain no extra attacks, so there is no "bow" weapon class here.
import { assertLevel } from "../errors";

export type SpecialistWeaponClass =
  | "melee"
  | "light-crossbow"
  | "heavy-crossbow"
  | "thrown-dagger"
  | "thrown-dart"
  | "other-missile";

export interface AttackRate {
  attacks: number;
  rounds: number;
}

function rate(attacks: number, rounds: number): AttackRate {
  return { attacks, rounds };
}

// prettier-ignore
export const SPECIALIST_ATTACKS_PER_ROUND: Readonly<
  Record<"1-6" | "7-12" | "13+", Readonly<Record<SpecialistWeaponClass, AttackRate>>>
> = {
  "1-6":  { melee: rate(3, 2), "light-crossbow": rate(1, 1), "heavy-crossbow": rate(1, 2), "thrown-dagger": rate(3, 1), "thrown-dart": rate(4, 1), "other-missile": rate(3, 2) },
  "7-12": { melee: rate(2, 1), "light-crossbow": rate(3, 2), "heavy-crossbow": rate(1, 1), "thrown-dagger": rate(4, 1), "thrown-dart": rate(5, 1), "other-missile": rate(2, 1) },
  "13+":  { melee: rate(5, 2), "light-crossbow": rate(2, 1), "heavy-crossbow": rate(3, 2), "thrown-dagger": rate(5, 1), "thrown-dart": rate(6, 1), "other-missile": rate(5, 2) },
};

export function specialistAttacksPerRound(
  fighterLevel: number,
  weaponClass: SpecialistWeaponClass,
): AttackRate {
  assertLevel(fighterLevel, "fighter level");
  const band = fighterLevel <= 6 ? "1-6" : fighterLevel <= 12 ? "7-12" : "13+";
  return SPECIALIST_ATTACKS_PER_ROUND[band][weaponClass];
}
