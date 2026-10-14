import { prototypeTokenLinkDefault } from "../core/tokens";

/* New player characters get a LINKED prototype token, so a token on a scene and
 * the sheet are the same actor (#167). Registered in `init`: the callback is
 * only evaluated when an actor is created. */

interface CreatingActor {
  type: string;
  updateSource(changes: Record<string, unknown>): unknown;
}

export function registerActorHooks(): void {
  Hooks.on("preCreateActor", (actor: unknown, data: unknown) => {
    const a = actor as CreatingActor;
    const explicit = (data as { prototypeToken?: { actorLink?: boolean } } | null)?.prototypeToken?.actorLink;
    if (prototypeTokenLinkDefault(a.type, explicit) === true) {
      a.updateSource({ "prototypeToken.actorLink": true });
    }
  });
}
