// Chat-card context for a shapechange (SP16). Pure.
export interface ShapechangeCardInput {
  actorName: string;
  actorImg: string;
  formName: string;
  d6: number;
  healed: number;
  usesLeft: number;
  usesMax: number;
  returning: boolean;
}

export interface ShapechangeCardContext extends ShapechangeCardInput {
  headlineKey: string;
}

export function buildShapechangeCardContext(input: ShapechangeCardInput): ShapechangeCardContext {
  return { ...input, headlineKey: input.returning ? "ADND2E.chat.shapechange.return" : "ADND2E.chat.shapechange.shift" };
}
