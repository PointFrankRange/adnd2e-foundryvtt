import { rollPowerCheck, type PowerCheck } from "./check";

export const ATTACK_MODES = ["Mind Thrust", "Ego Whip", "Id Insinuation", "Psychic Crush", "Psionic Blast"] as const;
export const DEFENSE_MODES = ["Mind Blank", "Thought Shield", "Mental Barrier", "Intellect Fortress", "Tower of Iron Will"] as const;

const norm = (s: string): string => s.trim().toLowerCase();
const indexOfName = (list: readonly string[], name: string): number => list.findIndex((n) => norm(n) === norm(name));

export const isAttackMode = (name: string): boolean => indexOfName(ATTACK_MODES, name) >= 0;
export const isDefenseMode = (name: string): boolean => indexOfName(DEFENSE_MODES, name) >= 0;

/** PHBR5 Table 14 (p.26), rows in ATTACK_MODES order, columns in DEFENSE_MODES order. */
// prettier-ignore
const TABLE_14: readonly (readonly number[])[] = [
  [5, -2, -4, -4, -5],
  [5, 0, -3, -4, -3],
  [-3, 2, 4, -1, -3],
  [1, -3, -1, -3, -4],
  [2, 3, 0, -1, -2],
];

export function attackModifier(attack: string, defense: string | null): number {
  if (defense === null) return 0;
  const row = indexOfName(ATTACK_MODES, attack);
  const col = indexOfName(DEFENSE_MODES, defense);
  return row < 0 || col < 0 ? 0 : TABLE_14[row]![col]!;
}

export interface ContestResult {
  attackSuccess: boolean;
  winner: "attacker" | "defender";
  reason: "unopposed" | "attack-failed" | "automatic" | "attacker-only" | "higher" | "tie";
}

/** True when the contest cannot be settled without the defender's roll. */
export function needsDefenseRoll(attackRoll: number, attackScore: number, defenseScore: number | null): boolean {
  if (defenseScore === null) return false;
  return rollPowerCheck(attackRoll, attackScore).success && attackRoll <= defenseScore;
}

/** A psychic contest (PHBR5 p.22): higher successful roll wins; ties and double failures go to the defender; an attack roll above the defense score wins outright. */
export function resolveContest(i: { attackRoll: number; attackScore: number; defenseRoll: number | null; defenseScore: number | null }): ContestResult {
  const attack = rollPowerCheck(i.attackRoll, i.attackScore);
  if (!attack.success) return { attackSuccess: false, winner: "defender", reason: "attack-failed" };
  if (i.defenseScore === null) return { attackSuccess: true, winner: "attacker", reason: "unopposed" };
  if (i.attackRoll > i.defenseScore) return { attackSuccess: true, winner: "attacker", reason: "automatic" };
  if (i.defenseRoll === null) throw new Error("resolveContest: a defense roll is required");
  const defense = rollPowerCheck(i.defenseRoll, i.defenseScore);
  if (!defense.success) return { attackSuccess: true, winner: "attacker", reason: "attacker-only" };
  if (i.attackRoll > i.defenseRoll) return { attackSuccess: true, winner: "attacker", reason: "higher" };
  return { attackSuccess: true, winner: "defender", reason: i.attackRoll === i.defenseRoll ? "tie" : "higher" };
}

/** A maintained power in a contest (p.24): +1 to the score, and a failed check counts as a success of 1. */
export function maintainedCheck(roll: number, score: number): PowerCheck & { roll: number; score: number } {
  const boosted = score + 1;
  const check = rollPowerCheck(roll, boosted);
  if (check.success) return { ...check, roll, score: boosted };
  return { result: "minimum-success", success: true, special: false, roll: 1, score: boosted };
}

export interface AttackStep { roll: number; score: number }
export interface SeriesOutcome {
  steps: { made: boolean; result: ContestResult | null; defenseRoll: number | null }[];
  tangentsGained: number;
  fullContact: boolean;
  anySuccess: boolean;
}

export const FULL_CONTACT = 3;

/** Resolves an attack mode's one-two punch (p.25): each attack is a separate contest; after full contact no more attacks are made. */
export function resolveSeries(steps: readonly AttackStep[], defenseScore: number | null, defenseRolls: readonly (number | null)[], startingTangents: number): SeriesOutcome {
  let tangents = startingTangents;
  let gained = 0;
  let anySuccess = false;
  const out: SeriesOutcome["steps"] = [];
  steps.forEach((s, i) => {
    if (tangents >= FULL_CONTACT) {
      out.push({ made: false, result: null, defenseRoll: null });
      return;
    }
    const need = needsDefenseRoll(s.roll, s.score, defenseScore);
    const defenseRoll = need ? (defenseRolls[i] ?? null) : null;
    if (need && defenseRoll === null) throw new Error("resolveSeries: a defense roll is required");
    const result = resolveContest({ attackRoll: s.roll, attackScore: s.score, defenseRoll, defenseScore });
    if (result.attackSuccess) anySuccess = true;
    if (result.winner === "attacker") { tangents += 1; gained += 1; }
    out.push({ made: true, result, defenseRoll });
  });
  return { steps: out, tangentsGained: gained, fullContact: tangents >= FULL_CONTACT, anySuccess };
}

export interface Contact { target: string; name: string; tangents: number }

export const isFullContact = (c: Contact): boolean => c.tangents >= FULL_CONTACT;
export const tangentsOn = (contacts: readonly Contact[], target: string): number => contacts.find((c) => c.target === target)?.tangents ?? 0;

/** Attacking a different target breaks the partial tangents held on any other target (p.27); full contacts and the attacked target's own contact are kept. */
export function switchTarget(contacts: readonly Contact[], target: string): Contact[] {
  return contacts.filter((c) => c.target === target || isFullContact(c)).map((c) => ({ ...c }));
}

/** Adds tangents on one target (capped at full contact); partial tangents on any other target are broken (p.26-27), full contacts are kept. */
export function recordTangents(contacts: readonly Contact[], target: string, name: string, count: number): Contact[] {
  if (count <= 0) return contacts.map((c) => ({ ...c }));
  const kept = switchTarget(contacts, target);
  const mine = kept.find((c) => c.target === target);
  if (mine) mine.tangents = Math.min(FULL_CONTACT, mine.tangents + count);
  else kept.push({ target, name, tangents: Math.min(FULL_CONTACT, count) });
  return kept;
}

/** Breaks partial tangents (all, or only one target's); a full contact is never broken this way. */
export function breakTangents(contacts: readonly Contact[], target?: string): Contact[] {
  return contacts.filter((c) => isFullContact(c) || (target !== undefined && c.target !== target)).map((c) => ({ ...c }));
}

export const endContact = (contacts: readonly Contact[], target: string): Contact[] => contacts.filter((c) => c.target !== target).map((c) => ({ ...c }));

/** 1 PSP per round while any partial tangent is held; full contact is free (p.26-27). */
export const upkeepDue = (contacts: readonly Contact[]): number => (contacts.some((c) => c.tangents > 0 && !isFullContact(c)) ? 1 : 0);
