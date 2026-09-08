/** Total carried weight of a stack: unit weight × quantity, junk input clamped to 0. */
export function totalWeight(input: { weight: number; quantity: number }): number {
  return Math.max(0, input.weight) * Math.max(0, input.quantity);
}
