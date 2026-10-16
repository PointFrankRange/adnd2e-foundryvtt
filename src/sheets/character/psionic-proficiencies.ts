import {
  DISCIPLINES, FOCUS_SECONDS, HARNESS_SECONDS, HARNESS_SUBCONSCIOUS, MEDITATIVE_FOCUS, harnessBonusPsp, harnessEndPool, proficiencyExpired,
} from "../../core/psionics";
import { currentPsp, info, requirePsionicist, warn, type PsionicActor, type PsionicItem } from "./psionic-actions";

/* Issue #180: Harness Subconscious and Meditative Focus (PHBR5 p.17-18). The long waits (48 hours of gathering, 12 of
 * meditation) are taken on trust, like the Rest control: the button asserts they were spent. Every write targets the
 * acting actor's own `system.psionics`. */

export type ProficiencyActor = PsionicActor & {
  system: PsionicActor["system"] & {
    psionics: PsionicActor["system"]["psionics"] & {
      harness?: { bonus: number; expiresAt: number | null };
      focus?: { discipline: string; expiresAt: number | null };
    };
  };
};

export interface ProficiencyDeps {
  /** rolls the owned proficiency's check (the system's non-weapon check, which posts the card); null = blocked */
  check: (actor: ProficiencyActor, itemId: string) => Promise<boolean | null>;
  /** the world time in seconds */
  now: () => number;
}

export const defaultProficiencyDeps: ProficiencyDeps = {
  check: async (actor, itemId) => (await import("./proficiency-actions")).rollNonweaponCheck(actor as never, itemId),
  now: () => (game as unknown as { time: { worldTime: number } }).time.worldTime,
};

const owned = (actor: ProficiencyActor, name: string): PsionicItem | undefined =>
  [...actor.items].find((i) => i.type === "nonweaponProficiency" && i.name === name);

/** Harness Subconscious: with a full pool and a passed check, +20% PSPs for 72 hours. */
export async function harnessSubconscious(actor: ProficiencyActor, deps: ProficiencyDeps = defaultProficiencyDeps): Promise<void> {
  if (!requirePsionicist(actor)) return;
  const nwp = owned(actor, HARNESS_SUBCONSCIOUS);
  if (!nwp) {
    warn("ADND2E.sheet.psionics.proficiencies.notKnown", { name: HARNESS_SUBCONSCIOUS });
    return;
  }
  if ((actor.system.psionics.harness?.bonus ?? 0) > 0) {
    info("ADND2E.sheet.psionics.proficiencies.harnessActive");
    return;
  }
  const base = actor.system.psionics.max;
  if (currentPsp(actor) < base) {
    warn("ADND2E.sheet.psionics.proficiencies.harnessNeedsFull");
    return;
  }
  if (!(await deps.check(actor, nwp.id))) return; // blocked, or a failed check (its card says so)
  const bonus = harnessBonusPsp(base);
  await actor.update({
    "system.psionics.harness": { bonus, expiresAt: deps.now() + HARNESS_SECONDS },
    "system.psionics.psp": base + bonus,
  });
  info("ADND2E.sheet.psionics.proficiencies.harnessed", { bonus });
}

/** Ends the Harness boost: the gained points are lost (never below 0) and the pool is stored as full when it is. */
export async function endHarness(actor: ProficiencyActor): Promise<void> {
  const bonus = actor.system.psionics.harness?.bonus ?? 0;
  if (bonus <= 0) return;
  const base = actor.system.psionics.max - bonus;
  const pool = harnessEndPool(currentPsp(actor), bonus);
  await actor.update({
    "system.psionics.harness": { bonus: 0, expiresAt: null },
    "system.psionics.psp": pool >= base ? null : pool,
  });
}

/** Meditative Focus: after a passed check, +2 to one discipline's power scores and -1 to the rest for 24 hours. */
export async function meditativeFocus(actor: ProficiencyActor, discipline: string, deps: ProficiencyDeps = defaultProficiencyDeps): Promise<void> {
  if (!requirePsionicist(actor)) return;
  const nwp = owned(actor, MEDITATIVE_FOCUS);
  if (!nwp) {
    warn("ADND2E.sheet.psionics.proficiencies.notKnown", { name: MEDITATIVE_FOCUS });
    return;
  }
  if (!(DISCIPLINES as readonly string[]).includes(discipline)) {
    warn("ADND2E.sheet.psionics.proficiencies.pickDiscipline");
    return;
  }
  if ((actor.system.psionics.focus?.discipline ?? "") !== "") {
    info("ADND2E.sheet.psionics.proficiencies.focusActive");
    return;
  }
  if (!(await deps.check(actor, nwp.id))) return;
  await actor.update({ "system.psionics.focus": { discipline, expiresAt: deps.now() + FOCUS_SECONDS } });
  info("ADND2E.sheet.psionics.proficiencies.focused", { discipline });
}

/** Ends the focus. */
export async function endFocus(actor: ProficiencyActor): Promise<void> {
  if ((actor.system.psionics.focus?.discipline ?? "") === "") return;
  await actor.update({ "system.psionics.focus": { discipline: "", expiresAt: null } });
}

/** The world time moved: ends every expired Harness boost and focus among these actors. */
export async function expireProficiencyEffects(actors: Iterable<ProficiencyActor>, now: number): Promise<void> {
  for (const actor of actors) {
    const p = actor.system.psionics;
    if (!p || p.level <= 0) continue;
    if ((p.harness?.bonus ?? 0) > 0 && proficiencyExpired(p.harness?.expiresAt ?? null, now)) await endHarness(actor);
    if ((p.focus?.discipline ?? "") !== "" && proficiencyExpired(p.focus?.expiresAt ?? null, now)) await endFocus(actor);
  }
}
