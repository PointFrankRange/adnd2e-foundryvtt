import { buildTurnCardContext } from "../../combat/turn-card";
import { SYSTEM_ID, TEMPLATE_PATH } from "../../constants";
import { resolveKitOverrides } from "../../core/kits";
import { resolveAttempt, turnerLevelFor, type TurnRowId, type TurnTarget } from "../../core/turning";
import { activeKitEntries } from "../../data/derive/character/kits";
import { requestApply } from "../../relay/relay-client";

/* Turn Undead (SP10, PHB p. 103). Foundry glue: reads the user's targeted
 * tokens, rolls once, posts one card, and applies each result through the
 * player-apply relay. The rules live in src/core/turning. */

const FLAG = "turnAttempt";

interface TurnerActor {
  name: string;
  img: string;
  isOwner: boolean;
  system: { classes: { chassisId: string; level: number }[] };
  items: Iterable<{ id: string; name: string; type: string; system: unknown }>;
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
  unsetFlag(scope: string, key: string): Promise<unknown>;
}

interface TargetActor {
  name: string;
  img: string;
  uuid: string;
  isOwner: boolean;
  system: {
    hd?: { count: number };
    details?: { types?: string[]; turning?: { row?: string } };
  };
}

/** The actor's classes with each class's kit turning rule (SP11 Plan C). */
function turnClasses(actor: TurnerActor): { chassisId: string; level: number; turning: ReturnType<typeof resolveKitOverrides>["turning"] }[] {
  const kits = activeKitEntries(actor.items);
  return actor.system.classes.map((c) => ({ ...c, turning: resolveKitOverrides(kits, c.chassisId).turning }));
}

export function turningPanel(actor: TurnerActor): { canTurn: boolean; level: number | null; attempted: boolean; canReset: boolean } {
  const level = turnerLevelFor(turnClasses(actor));
  const attempted = Boolean(actor.getFlag(SYSTEM_ID, FLAG));
  const isGm = Boolean((game.user as unknown as { isGM?: boolean } | null)?.isGM);
  return { canTurn: level !== null, level, attempted, canReset: attempted && isGm };
}

interface TargetedToken {
  name: string;
  document?: { texture?: { src?: string | null } };
  actor: TargetActor | null;
}

function targetedActors(): { token: TargetedToken; actor: TargetActor }[] {
  const targets = (game.user as unknown as { targets: Iterable<TargetedToken> }).targets;
  const found: { token: TargetedToken; actor: TargetActor }[] = [];
  for (const token of targets) if (token.actor) found.push({ token, actor: token.actor });
  return found;
}

export async function turnUndead(actor: TurnerActor): Promise<void> {
  const level = turnerLevelFor(turnClasses(actor));
  if (level === null) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.turning.notTurner"));
    return;
  }
  if (actor.getFlag(SYSTEM_ID, FLAG)) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.turning.alreadyAttempted"));
    return;
  }
  const targets = targetedActors();
  if (targets.length === 0) {
    ui.notifications?.warn(game.i18n!.localize("ADND2E.sheet.turning.noTargets"));
    return;
  }

  const d20 = await new Roll("1d20").evaluate();
  const cap = (await new Roll("2d6").evaluate()).total;
  const bonusCap = (await new Roll("2d4").evaluate()).total;
  const naturalD20 = d20.dice[0]?.total ?? d20.total;

  const turnTargets: TurnTarget[] = targets.map(({ actor: t }, i) => ({
    id: String(i),
    isUndead: Boolean(t.system.details?.types?.includes("undead")),
    row: (t.system.details?.turning?.row || null) as TurnRowId | null,
    hd: t.system.hd?.count ?? 0,
  }));
  const results = resolveAttempt({ d20: naturalD20, level, targets: turnTargets, cap, bonusCap });

  const context = buildTurnCardContext({
    actorName: actor.name,
    actorImg: actor.img,
    naturalD20,
    level,
    cap,
    bonusCap,
    rows: results.map((r, i) => {
      const { token, actor: ta } = targets[i]!;
      return { name: token.name, img: token.document?.texture?.src || ta.img, status: r.status };
    }),
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    TEMPLATE_PATH("chat/turn-undead-roll.hbs"),
    context as unknown as Record<string, unknown>,
  );
  await d20.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: actor as never }),
    content,
  } as unknown as Roll.MessageData);

  await actor.setFlag(SYSTEM_ID, FLAG, true);

  for (const [i, r] of results.entries()) {
    const target = targets[i]!.actor;
    try {
      if (r.status === "turned") {
        await requestApply(target as never, { kind: "condition", targetUuid: target.uuid, conditionId: "turned" });
      } else if (r.status === "destroyed") {
        await requestApply(target as never, { kind: "destroy", targetUuid: target.uuid });
      }
    } catch (err) {
      console.error(`${SYSTEM_ID} | turn apply failed`, err);
    }
  }
}

export async function resetTurnAttempt(actor: TurnerActor): Promise<void> {
  await actor.unsetFlag(SYSTEM_ID, FLAG);
}
