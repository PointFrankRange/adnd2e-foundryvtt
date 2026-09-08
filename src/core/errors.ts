import type { AbilityKey } from "./types";

export function assertAbilityScore(value: number, label: AbilityKey): void {
  if (!Number.isInteger(value) || value < 1 || value > 25) {
    throw new RangeError(`${label} ability score must be an integer in [1, 25], got ${value}`);
  }
}

export function assertLevel(value: number, label = "level"): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} must be an integer >= 1, got ${value}`);
  }
}

export function assertXp(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`experience points must be an integer >= 0, got ${value}`);
  }
}

export function assertD20(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new RangeError(`d20 roll must be an integer in [1, 20], got ${value}`);
  }
}
