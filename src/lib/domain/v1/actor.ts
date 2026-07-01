/**
 * v1 Actor — tastile-core/v1/10 §4-3 (ActorKind) and Command envelope §1.
 *
 * Interfaces only. No business logic.
 */

import type { ActorKindValue } from "./constants";

export interface Actor {
  id: string;
  kind: ActorKindValue;
  /** Owner id when kind = USER; worker id when kind = WORKER; etc. */
  ownerId: string | null;
}

export interface Stamp {
  at: string;
  actor: Actor;
}
