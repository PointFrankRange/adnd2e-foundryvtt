import type { ActiveEffectSubtype } from "./subtypes";
import { Adnd2eActiveEffectModel } from "./adnd2e";

export { Adnd2eActiveEffectModel };
export { ACTIVE_EFFECT_SUBTYPES } from "./subtypes";
export type { ActiveEffectSubtype } from "./subtypes";

/** Registered on `CONFIG.ActiveEffect.dataModels` in the init hook. Keys ≡ `ACTIVE_EFFECT_SUBTYPES`. */
export const ACTIVE_EFFECT_DATA_MODELS: Record<
  ActiveEffectSubtype,
  typeof foundry.abstract.TypeDataModel<foundry.data.fields.DataSchema, ActiveEffect.Implementation>
> = {
  adnd2e: Adnd2eActiveEffectModel,
};
