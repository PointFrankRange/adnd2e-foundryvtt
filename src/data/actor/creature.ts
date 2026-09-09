import { htmlField } from "../common/fields";
import { deriveCreature } from "../derive/creature";
import type { CreatureSnapshot } from "../derive/creature";
import { ALIGNMENTS, ATTACK_TYPES, CREATURE_SIZES, SAVE_MODES } from "../item/choices";
import { Adnd2eActorModel } from "./base-actor";
import type { ClassGroup, SaveCategory } from "../../core/types";

const { StringField, NumberField, ArrayField, SchemaField } = foundry.data.fields;

export class CreatureModel extends Adnd2eActorModel {
  static defineSchema(): foundry.data.fields.DataSchema {
    return {
      hd: new SchemaField({
        count: new NumberField({ required: true, min: 0, initial: 1 }),
        dieType: new NumberField({ required: true, integer: true, initial: 8 }),
        bonus: new NumberField({ required: true, integer: true, initial: 0 }),
        fixedHp: new NumberField({ required: true, nullable: true, integer: true, min: 0, initial: null }),
      }),
      attributes: new SchemaField({
        hp: new SchemaField({
          value: new NumberField({ required: true, integer: true, initial: 0 }),
          max: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        }),
        ac: new SchemaField({ value: new NumberField({ required: true, integer: true, initial: 10 }) }),
        thac0: new SchemaField({
          value: new NumberField({ required: true, integer: true, initial: 20 }),
          asFighterLevel: new NumberField({ required: true, nullable: true, integer: true, min: 1, initial: null }),
        }),
        movement: new SchemaField({
          land: new NumberField({ required: true, integer: true, min: 0, initial: 12 }),
          burrow: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          climb: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          fly: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          swim: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          flyManeuverability: new StringField({ required: true, blank: true, initial: "" }),
        }),
      }),
      attacks: new ArrayField(
        new SchemaField({
          name: new StringField({ required: true, blank: true, initial: "" }),
          count: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
          damage: new StringField({ required: true, blank: true, initial: "" }),
          thac0Override: new NumberField({ required: true, nullable: true, integer: true, initial: null }),
          type: new StringField({ required: true, blank: false, initial: "melee", choices: ATTACK_TYPES }),
          special: new StringField({ required: true, blank: true, initial: "" }),
        }),
        { required: true, initial: [] },
      ),
      saves: new SchemaField({
        mode: new StringField({ required: true, blank: false, initial: "explicit", choices: SAVE_MODES }),
        explicit: new SchemaField({
          ppd: new NumberField({ required: true, integer: true, initial: 20 }),
          rsw: new NumberField({ required: true, integer: true, initial: 20 }),
          pp: new NumberField({ required: true, integer: true, initial: 20 }),
          bw: new NumberField({ required: true, integer: true, initial: 20 }),
          spell: new NumberField({ required: true, integer: true, initial: 20 }),
        }),
        asClass: new SchemaField({
          group: new StringField({ required: true, blank: true, initial: "" }),
          level: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
        }),
        effective: new SchemaField({
          ppd: new NumberField({ required: true, integer: true, initial: 20 }),
          rsw: new NumberField({ required: true, integer: true, initial: 20 }),
          pp: new NumberField({ required: true, integer: true, initial: 20 }),
          bw: new NumberField({ required: true, integer: true, initial: 20 }),
          spell: new NumberField({ required: true, integer: true, initial: 20 }),
        }),
      }),
      details: new SchemaField({
        size: new StringField({ required: true, blank: false, initial: "medium", choices: CREATURE_SIZES }),
        alignment: new StringField({ required: true, blank: false, initial: "true-neutral", choices: ALIGNMENTS }),
        intelligence: new StringField({ required: true, blank: true, initial: "" }),
        morale: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        magicResistance: new NumberField({ required: true, integer: true, min: 0, max: 100, initial: 0 }),
        treasureType: new StringField({ required: true, blank: true, initial: "" }),
        numberAppearing: new StringField({ required: true, blank: true, initial: "" }),
        xpValue: new NumberField({ required: true, nullable: true, integer: true, min: 0, initial: null }),
        specialAttacks: htmlField(),
        specialDefenses: htmlField(),
        description: htmlField(),
      }),
    };
  }
  override prepareDerivedData(): void {
    deriveAndCacheCreature(this);
  }
}

const SAVE_KEYS: readonly SaveCategory[] = ["ppd", "rsw", "pp", "bw", "spell"];

/** Ruling S2 shim — the creature model is loosely typed until the Schema-typing debt clears. */
function snapshotCreature(model: foundry.abstract.TypeDataModel.Any): CreatureSnapshot {
  const sys = (model as unknown as { parent: Actor.Implementation }).parent.system as unknown as {
    hd: { count: number; dieType: number; bonus: number; fixedHp: number | null };
    attributes: { thac0: { value: number; asFighterLevel: number | null } };
    saves: {
      mode: "explicit" | "asClass";
      explicit: Record<SaveCategory, number>;
      asClass: { group: string; level: number };
    };
  };
  return {
    hd: { ...sys.hd },
    thac0AsFighterLevel: sys.attributes.thac0.asFighterLevel,
    authoredThac0: sys.attributes.thac0.value,
    saveMode: sys.saves.mode,
    explicitSaves: { ...sys.saves.explicit },
    asClassSave: { group: sys.saves.asClass.group as ClassGroup | "", level: sys.saves.asClass.level },
  };
}

interface CreatureWriteSurface {
  attributes: { hp: { max: number }; thac0: { value: number } };
  saves: { effective: Record<string, number> };
}

/** Runs deriveCreature and writes onto system.* (spec §5.3 derived paths). */
function deriveAndCacheCreature(model: foundry.abstract.TypeDataModel.Any): void {
  const derived = deriveCreature(snapshotCreature(model));
  const sys = model as unknown as CreatureWriteSurface;
  sys.attributes.hp.max = derived.hpMax;
  sys.attributes.thac0.value = derived.thac0;
  for (const k of SAVE_KEYS) sys.saves.effective[k] = derived.saves[k];
}
