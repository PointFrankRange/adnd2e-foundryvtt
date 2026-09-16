import type { ClassGroup, SaveCategory } from "../../core/types";

export interface CreatureAttackEntry {
  name: string;
  count: number;
  damage: string;
  thac0Override: number | null;
  type: "melee" | "ranged";
  special: string;
}

export interface CreatureSheetInput {
  name: string;
  img: string;
  hd: { count: number; dieType: number; bonus: number };
  attributes: {
    hp: { value: number; max: number };
    ac: { value: number };
    thac0: { value: number };
    movement: { land: number; burrow: number; climb: number; fly: number; swim: number; flyManeuverability: string };
  };
  attacks: CreatureAttackEntry[];
  saves: {
    mode: "explicit" | "asClass";
    explicit: Record<SaveCategory, number>;
    /** already-derived by deriveCreature — this is what the sheet always displays,
     *  regardless of `mode` (mode only matters to prepareDerivedData's own computation). */
    effective: Record<SaveCategory, number>;
  };
  details: {
    size: string;
    alignment: string;
    intelligence: string;
    morale: number;
    magicResistance: number;
    treasureType: string;
    numberAppearing: string;
    xpValue: number | null;
    specialAttacks: string;
    specialDefenses: string;
    description: string;
  };
  perms: { isGM: boolean; isOwner: boolean; editable: boolean };
}

export interface CreatureSheetContext {
  identity: { name: string; img: string };
  vitals: {
    hp: { value: number; max: number };
    ac: number;
    thac0: number;
    /** e.g. "12, climb 3, fly 18 (C)" — zero-value modes omitted, land always first (unlabeled) */
    movementSummary: string;
  };
  attacks: { index: number; name: string; count: number; damage: string; type: "melee" | "ranged"; special: string }[];
  saves: { category: SaveCategory; label: string; target: number }[];
  details: {
    size: string;
    alignment: string;
    intelligence: string;
    morale: number;
    magicResistance: number;
    treasureType: string;
    numberAppearing: string;
    xpValue: number | null;
    specialAttacks: string;
    specialDefenses: string;
    description: string;
  };
  perms: { isGM: boolean; isOwner: boolean; editable: boolean };
}

// re-exported so context.ts doesn't need a second import line for a type it only forwards
export type { ClassGroup };
