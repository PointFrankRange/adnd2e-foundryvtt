export function assertAbilityScore(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 25) {
    throw new RangeError(`${label} ability score must be an integer in [1, 25], got ${value}`);
  }
}
