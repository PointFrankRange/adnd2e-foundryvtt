// Reusable SchemaField fragments and field factories. Foundry-layer (uses
// `foundry.data.fields`); no logic — pure field construction.
const { StringField, NumberField, SchemaField, HTMLField } = foundry.data.fields;

/** Rich-text field, empty by default. Used for descriptions and GM notes. */
export function htmlField(): InstanceType<typeof HTMLField> {
  return new HTMLField({ required: true, blank: true, initial: "" });
}

/** A required, trimmed free-text identifier / name-like string. */
export function identifierField(): InstanceType<typeof StringField> {
  return new StringField({ required: true, blank: true, trim: true, initial: "" });
}

/** `{ value, currency }` money sub-object (PHB coin denominations). */
export function currencySchema(): InstanceType<typeof SchemaField> {
  return new SchemaField({
    value: new NumberField({ required: true, min: 0, initial: 0 }),
    currency: new StringField({
      required: true,
      blank: false,
      initial: "gp",
      choices: ["pp", "gp", "ep", "sp", "cp"],
    }),
  });
}
