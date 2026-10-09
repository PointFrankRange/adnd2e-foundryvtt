// Wrestling roll modifiers (C&T "Holds"). Pure.
export const SIZE_ORDER = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;
export type SizeKey = (typeof SIZE_ORDER)[number];

function sizeIndex(size: string | null | undefined): number {
  const i = SIZE_ORDER.indexOf((size ?? "medium") as SizeKey);
  return i === -1 ? SIZE_ORDER.indexOf("medium") : i;
}

/** +4 / -4 per size class of the INITIATOR (the side starting the opposed roll) versus the other side. */
export function sizeModifier(initiatorSize: string | null | undefined, otherSize: string | null | undefined): number {
  return 4 * (sizeIndex(initiatorSize) - sizeIndex(otherSize));
}

/** -1 against a defender normally immune to the attack, -2 against an unusually supple body. */
export function bodyModifier(t: { immune?: boolean; supple?: boolean }): number {
  return (t.immune ? -1 : 0) + (t.supple ? -2 : 0);
}

/** The AC a wrestler is attacked at: 10 regardless of worn armor, plus Dex defensive adjustment (AC-signed, negative = agile) minus magic protection. */
export function wrestlingDefenseAc(input: { dexDefensiveAdj: number; magicBonus: number }): number {
  return Math.min(10, Math.max(-10, 10 + input.dexDefensiveAdj - input.magicBonus));
}
