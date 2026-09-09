// Shared authored-schema fragment for `character` + `npc`, and the abstract
// TypeDataModel base for all three actor models. Foundry-layer; no logic.
import { htmlField } from "../common/fields";
import { ABILITY_KEYS, ALIGNMENTS, CLASS_IDS, ENCUMBRANCE_CATEGORIES, WIZARD_SCHOOLS, SPHERE_NAMES } from "../item/choices";
import { applyRacialDeltas } from "../../core/abilities";
import type { AbilityScores, Race } from "../../core/types";
import { deriveCharacter } from "../derive/character";
import { getOptionalRules } from "../../settings";
import { snapshotActor } from "./snapshot";

const { StringField, NumberField, BooleanField, SchemaField, ArrayField, ObjectField } = foundry.data.fields;

function abilitiesSchema() {
  const entry = () =>
    new SchemaField({
      score: new NumberField({ required: true, integer: true, min: 1, initial: 10 }),
      exceptional: new NumberField({ required: true, nullable: true, integer: true, min: 1, max: 100, initial: null }),
    });
  return new SchemaField(Object.fromEntries(ABILITY_KEYS.map((k) => [k, entry()])));
}

/** One `memorized` sub-object: an embedded `spell` item id + the slot level it occupies. */
function memorizedSchema() {
  return new ArrayField(
    new SchemaField({
      spellItemId: new StringField({ required: true, blank: false }),
      spellLevel: new NumberField({ required: true, integer: true, min: 1, max: 9 }),
    }),
    { required: true, initial: [] },
  );
}

/** A derived save target sub-object; initials are safe pre-derive values. */
function saveEntrySchema() {
  return new SchemaField({
    target: new NumberField({ required: true, integer: true, initial: 20 }),
    rollModifier: new NumberField({ required: true, integer: true, initial: 0 }),
    effectiveTarget: new NumberField({ required: true, integer: true, initial: 20 }),
  });
}

/** A derived proficiency-slot tally; initials are safe pre-derive values. */
function proficiencyBlockSchema() {
  return new SchemaField({
    total: new NumberField({ required: true, integer: true, initial: 0 }),
    spent: new NumberField({ required: true, integer: true, initial: 0 }),
    available: new NumberField({ required: true, integer: true, initial: 0 }),
  });
}

/** Derived THAC0 by attack mode; initials are safe pre-derive values. */
function thac0Schema() {
  return new SchemaField({
    base: new NumberField({ required: true, integer: true, initial: 20 }),
    melee: new NumberField({ required: true, integer: true, initial: 20 }),
    ranged: new NumberField({ required: true, integer: true, initial: 20 }),
  });
}

/** Derived armor class by situation; initials are safe pre-derive values. */
function acSchema() {
  return new SchemaField({
    normal: new NumberField({ required: true, integer: true, initial: 10 }),
    rearAttack: new NumberField({ required: true, integer: true, initial: 10 }),
    surprised: new NumberField({ required: true, integer: true, initial: 10 }),
    shieldless: new NumberField({ required: true, integer: true, initial: 10 }),
  });
}

/** Derived encumbrance state; initials are safe pre-derive values. */
function encumbranceSchema() {
  return new SchemaField({
    carried: new NumberField({ required: true, initial: 0 }),
    category: new StringField({ required: true, blank: false, initial: "unencumbered", choices: ENCUMBRANCE_CATEGORIES }),
    penalty: new SchemaField({
      attackRoll: new NumberField({ required: true, integer: true, initial: 0 }),
      armorClass: new NumberField({ required: true, integer: true, initial: 0 }),
    }),
    baseMove: new NumberField({ required: true, integer: true, initial: 12 }),
    movementRate: new NumberField({ required: true, integer: true, initial: 12 }),
  });
}

/** Derived movement summary; initials are safe pre-derive values. */
function movementSchema() {
  return new SchemaField({
    base: new NumberField({ required: true, integer: true, initial: 12 }),
    current: new NumberField({ required: true, integer: true, initial: 12 }),
    encumbranceCategory: new StringField({ required: true, blank: false, initial: "unencumbered", choices: ENCUMBRANCE_CATEGORIES }),
  });
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
        max: new NumberField({ required: true, integer: true, initial: 0 }),
        rolls: new ArrayField(new NumberField({ required: true, integer: true, min: 0 }), { required: true, initial: [] }),
        temp: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        nonlethal: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
      thac0: thac0Schema(),
      ac: acSchema(),
      encumbrance: encumbranceSchema(),
      movement: movementSchema(),
    }),
    saves: new SchemaField({
      ppd: saveEntrySchema(),
      rsw: saveEntrySchema(),
      pp: saveEntrySchema(),
      bw: saveEntrySchema(),
      spell: saveEntrySchema(),
    }),
    classes: new ArrayField(
      new SchemaField({
        chassisId: new StringField({ required: true, blank: false, choices: CLASS_IDS }),
        level: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
        canLevelUp: new BooleanField({ required: true, initial: false }),
      }),
      { required: true, initial: [] },
    ),
    multiclassPending: new BooleanField({ required: true, initial: false }),
    languagesKnown: new SchemaField({ max: new NumberField({ required: true, integer: true, min: 0, initial: 0 }) }),
    proficiencies: new SchemaField({
      weapon: proficiencyBlockSchema(),
      nonweapon: proficiencyBlockSchema(),
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
        specialistSchool: new StringField({ required: true, nullable: true, initial: null, choices: WIZARD_SCHOOLS }),
        opposedSchools: new ArrayField(new StringField({ required: true, blank: false, choices: WIZARD_SCHOOLS }), { required: true, initial: [] }),
        spellbookItemIds: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
        memorized: memorizedSchema(),
        slots: new ObjectField({ required: true, initial: {} }),
      }),
      priest: new SchemaField({
        sphereAccessOverride: new ArrayField(new StringField({ required: true, blank: false, choices: SPHERE_NAMES }), { required: true, nullable: true, initial: null }),
        memorized: memorizedSchema(),
        slots: new ObjectField({ required: true, initial: {} }),
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

/**
 * `prepareBaseData` for `character` + `npc`: applies the embedded `race` item's
 * racial ability deltas onto `system.abilities.<k>.score` in place, so every
 * later consumer (`snapshotActor`, sheets) sees the adjusted scores. No-op when
 * the actor carries no `race` item.
 */
export function applyRacialAdjustment(model: foundry.abstract.TypeDataModel.Any): void {
  const sys = model as unknown as {
    abilities: Record<string, { score: number }>;
    parent: { items: Iterable<{ type: string; system: { raceId?: Race } }> };
  };
  const raceItem = [...sys.parent.items].find((i) => i.type === "race");
  if (!raceItem) return;
  const raw = Object.fromEntries(ABILITY_KEYS.map((k) => [k, sys.abilities[k].score])) as unknown as AbilityScores;
  const adj = applyRacialDeltas(raw, raceItem.system.raceId as Race);
  for (const k of ABILITY_KEYS) sys.abilities[k].score = Math.max(1, adj[k]);
}

/** The `system.*` write surface for `deriveAndCache` (spec §5.1 paths). */
interface DerivedWriteSurface {
  abilities: Record<string, { mods?: unknown }>;
  classes: unknown;
  multiclassPending: boolean;
  attributes: {
    hp: { max: number };
    thac0: unknown;
    ac: unknown;
    encumbrance: unknown;
    movement: unknown;
  };
  saves: Record<string, unknown>;
  proficiencies: unknown;
  languagesKnown: unknown;
  spellcasting: { wizard: { slots: unknown }; priest: { slots: unknown } };
}

/**
 * Runs the character pipeline and writes every derived value onto `system.*`
 * (spec §5.1 paths). Per Ruling PF-C, when a `derived.*` block is `null` (a
 * 0-class actor has no THAC0 / saves / proficiencies) the schema-initialised
 * defaults are left in place rather than overwritten.
 */
export function deriveAndCache(model: foundry.abstract.TypeDataModel.Any): void {
  const parent = (model as unknown as { parent: Actor.Implementation }).parent;
  const derived = deriveCharacter(snapshotActor(parent), getOptionalRules());
  const sys = model as unknown as DerivedWriteSurface;

  for (const k of ABILITY_KEYS) sys.abilities[k].mods = derived.abilities[k];
  sys.classes = derived.classes;
  sys.multiclassPending = derived.multiclassPending;

  if (derived.classes.length) sys.attributes.hp.max = derived.hpMax;
  sys.attributes.ac = derived.ac;
  if (derived.thac0) sys.attributes.thac0 = derived.thac0;

  if (derived.saves) {
    for (const k of ["ppd", "rsw", "pp", "bw", "spell"] as const) sys.saves[k] = derived.saves[k];
  }

  if (derived.proficiencies) {
    sys.proficiencies = {
      weapon: derived.proficiencies.weapon,
      nonweapon: derived.proficiencies.nonweapon,
    };
    sys.languagesKnown = { max: derived.proficiencies.languagesMax };
  }

  sys.attributes.encumbrance = derived.encumbrance;
  sys.attributes.movement = {
    base: derived.encumbrance.baseMove,
    current: derived.encumbrance.movementRate,
    encumbranceCategory: derived.encumbrance.category,
  };

  if (derived.spellSlots.wizard) sys.spellcasting.wizard.slots = derived.spellSlots.wizard;
  if (derived.spellSlots.priest) sys.spellcasting.priest.slots = derived.spellSlots.priest;
}

export abstract class Adnd2eActorModel<
  Schema extends foundry.data.fields.DataSchema = foundry.data.fields.DataSchema,
> extends foundry.abstract.TypeDataModel<Schema, Actor.Implementation> {
  override prepareDerivedData(): void {
    // Subclasses override.
  }
}
