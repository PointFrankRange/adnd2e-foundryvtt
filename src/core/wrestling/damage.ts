// Wrestling damage is temporary: it lowers HP and is also tracked as nonlethal (the book's "temporary" damage).
export function temporaryDamage(
  hp: { value: number; nonlethal: number },
  amount: number,
): { value: number; nonlethal: number; unconscious: boolean } {
  const dealt = amount > 0 ? amount : 0;
  const value = hp.value - dealt;
  return { value, nonlethal: hp.nonlethal + dealt, unconscious: dealt > 0 && value <= 0 };
}
