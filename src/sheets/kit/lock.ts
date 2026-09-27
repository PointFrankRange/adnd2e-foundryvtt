// The sheet edit lock (sheet redesign R1): a sheet opens locked; only a user who
// can edit the actor can unlock it, and only they are ever treated as unlocked. Pure.

export interface LockState {
  canUnlock: boolean;
  unlocked: boolean;
}

export function lockState(editable: boolean, unlocked: boolean): LockState {
  return { canUnlock: editable, unlocked: editable && unlocked };
}
