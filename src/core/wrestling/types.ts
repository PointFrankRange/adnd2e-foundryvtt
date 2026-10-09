// Combat & Tactics wrestling (SP7e). Pure, Foundry-free.

/** free = no grapple; held = the book's "grappled"/"held" rung; locked = the top rung. */
export type GripRung = "free" | "held" | "locked";

export const LOCK_EFFECT_IDS = ["throw", "takedown", "slam", "press", "hammer", "manipulate", "carry"] as const;
export type LockEffectId = (typeof LOCK_EFFECT_IDS)[number];

/** The grapple state stored on BOTH actors' condition effects (`flags.adnd2e.grapple`); the two sides mirror each other. */
export interface GrappleRecord {
  /** shared by both sides' records */
  id: string;
  role: "holder" | "held";
  opponentUuid: string;
  opponentName: string;
  rung: "held" | "locked";
  /** active lock effects on the held character */
  locks: LockEffectId[];
  /** the lock most recently applied, for "hold on" repeats and press escalation */
  lastLock: LockEffectId | null;
  /** consecutive press count (0 when the last lock was not a press) */
  pressCount: number;
  /** a lock was won and the holder has not chosen its effect yet */
  lockPending: boolean;
}

const isString = (v: unknown): v is string => typeof v === "string" && v !== "";

/** A clean GrappleRecord, or null for anything malformed. The GM relay and the flag reader trust nothing else. */
export function parseGrappleRecord(raw: unknown): GrappleRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.id) || !isString(r.opponentUuid) || !isString(r.opponentName)) return null;
  if (r.role !== "holder" && r.role !== "held") return null;
  if (r.rung !== "held" && r.rung !== "locked") return null;
  if (!Array.isArray(r.locks) || !r.locks.every((l) => (LOCK_EFFECT_IDS as readonly unknown[]).includes(l))) return null;
  if (r.lastLock !== null && !(LOCK_EFFECT_IDS as readonly unknown[]).includes(r.lastLock)) return null;
  if (typeof r.pressCount !== "number" || !Number.isInteger(r.pressCount) || r.pressCount < 0 || r.pressCount > 50) return null;
  if (typeof r.lockPending !== "boolean") return null;
  return {
    id: r.id, role: r.role, opponentUuid: r.opponentUuid, opponentName: r.opponentName, rung: r.rung,
    locks: r.locks as LockEffectId[], lastLock: r.lastLock as LockEffectId | null, pressCount: r.pressCount, lockPending: r.lockPending,
  };
}
