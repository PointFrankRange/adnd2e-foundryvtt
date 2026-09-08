// The shared "physical item" schema fragment (spec §5.4): things a weapon,
// armor, or equipment item all carry. Spread into each of those schemas.
import { currencySchema } from "./fields";

const { StringField, NumberField, BooleanField } = foundry.data.fields;

export function physicalItemSchema(): Record<string, foundry.data.fields.DataField.Any> {
  return {
    quantity: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
    weight: new NumberField({ required: true, min: 0, initial: 0 }),
    cost: currencySchema(),
    location: new StringField({ required: true, blank: true, initial: "" }),
    identified: new BooleanField({ required: true, initial: true }),
    equipped: new BooleanField({ required: true, initial: false }),
    magicBonus: new NumberField({ required: true, integer: true, initial: 0 }),
  };
}
