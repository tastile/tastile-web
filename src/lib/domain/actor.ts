/**
 * Actor Types
 *
 * Actors represent the entities that can trigger commands in the system.
 * Three types: system (automated processes), human (users), agent (AI agents).
 */

export type SystemActor = {
  type: "system";
  systemId: string;
};

export type HumanActor = {
  type: "human";
  userId: string;
};

export type AgentActor = {
  type: "agent";
  agentId: string;
};

export type Actor = SystemActor | HumanActor | AgentActor;

// Type guards
export function isSystemActor(actor: Actor): actor is SystemActor {
  return actor.type === "system";
}

export function isHumanActor(actor: Actor): actor is HumanActor {
  return actor.type === "human";
}

export function isAgentActor(actor: Actor): actor is AgentActor {
  return actor.type === "agent";
}
