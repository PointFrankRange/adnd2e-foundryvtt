// Shared authored-schema fragment for `character` + `npc`, and the abstract
// TypeDataModel base for all three actor models. Foundry-layer; no logic.
import { htmlField } from "../common/fields";
import { ABILITY_KEYS, ALIGNMENTS, SPELL_SCHOOLS, SPHERE_NAMES } from "../item/choices";

const { StringField, NumberField, SchemaField, ArrayField } = foundry.data.fields;

function abilitiesSchema() {
  const entry = () =>
    new SchemaField({
      score: new NumberField({ required: true, integer: true, min: 1, initial: 10 }),
      exceptional: new NumberField({ required: true, nullable: true, integer: true, min: 1, max: 100, initial: null }),
    });
  return new SchemaField(Object.fromEntries(ABILITY_KEYS.map((k) => [k, entry()])));
}

export function actorCommonSchema(): foundry.data.fields.DataSchema {
  return {
    abilities: abilitiesSchema(),
    details: new SchemaField({
      alignment: new StringField({ required: true, blank: false, initial: "true-neutral", choices: ALIGNMENTS }),
      deity: new StringField({ required: true, blank: true, initial: "" }),
      kit: new StringField({ required: true, blank: true, initial: "" }),
      homeland: new StringField({ required: true, blank: true, initial: "" }),
      age: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      sex: new StringField({ required: true, blank: true, initial: "" }),
      height: new StringField({ required: true, blank: true, initial: "" }),
      weight: new StringField({ required: true, blank: true, initial: "" }),
      hairEyes: new StringField({ required: true, blank: true, initial: "" }),
      campaignNotes: htmlField(),
      gmNotes: htmlField(),
    }),
    attributes: new SchemaField({
      hp: new SchemaField({
        value: new NumberField({ required: true, integer: true, initial: 0 }),
        rolls: new ArrayField(new NumberField({ required: true, integer: true, min: 0 }), { required: true, initial: [] }),
        temp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        nonlethal: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
    }),
    currency: new SchemaField({
      pp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      gp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      ep: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      sp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      cp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    }),
    resources: new SchemaField({
      reputation: new StringField({ required: true, blank: true, initial: "" }),
      henchmen: new StringField({ required: true, blank: true, initial: "" }),
      followers: new StringField({ required: true, blank: true, initial: "" }),
    }),
    spellcasting: new SchemaField({
      wizard: new SchemaField({
        specialistSchool: new StringField({ required: true, nullable: true, initial: null, choices: SPELL_SCHOOLS }),
        opposedSchools: new ArrayField(new StringField({ required: true, blank: false, choices: SPELL_SCHOOLS }), { required: true, initial: [] }),
        spellbookItemIds: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
      }),
      priest: new SchemaField({
        sphereAccessOverride: new ArrayField(new StringField({ required: true, blank: false, choices: SPHERE_NAMES }), { required: true, nullable: true, initial: null }),
      }),
    }),
    biography: htmlField(),
    options: new SchemaField({
      combatAndTactics: new foundry.data.fields.ObjectField({ required: true, initial: {} }),
      skillsAndPowers: new foundry.data.fields.ObjectField({ required: true, initial: {} }),
      spellsAndMagic: new foundry.data.fields.ObjectField({ required: true, initial: {} }),
    }),
  };
}

export abstract class Adnd2eActorModel<
  Schema extends foundry.data.fields.DataSchema = foundry.data.fields.DataSchema,
> extends foundry.abstract.TypeDataModel<Schema, Actor.Implementation> {
  override prepareDerivedData(): void {
    // Subclasses override.
  }
}
