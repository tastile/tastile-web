import { describe, it, expect } from "vitest";
import {
  type Actor,
  type SystemActor,
  type HumanActor,
  type AgentActor,
  isSystemActor,
  isHumanActor,
  isAgentActor,
} from "./actor";

describe("Actor", () => {
  describe("SystemActor", () => {
    it("should create a system actor", () => {
      const actor: SystemActor = {
        type: "system",
        systemId: "scheduler",
      };
      expect(actor.type).toBe("system");
      expect(actor.systemId).toBe("scheduler");
    });

    it("should be identified by type guard", () => {
      const actor: Actor = {
        type: "system",
        systemId: "scheduler",
      };
      expect(isSystemActor(actor)).toBe(true);
      expect(isHumanActor(actor)).toBe(false);
      expect(isAgentActor(actor)).toBe(false);
    });
  });

  describe("HumanActor", () => {
    it("should create a human actor", () => {
      const actor: HumanActor = {
        type: "human",
        userId: "user-123",
      };
      expect(actor.type).toBe("human");
      expect(actor.userId).toBe("user-123");
    });

    it("should be identified by type guard", () => {
      const actor: Actor = {
        type: "human",
        userId: "user-123",
      };
      expect(isSystemActor(actor)).toBe(false);
      expect(isHumanActor(actor)).toBe(true);
      expect(isAgentActor(actor)).toBe(false);
    });
  });

  describe("AgentActor", () => {
    it("should create an agent actor", () => {
      const actor: AgentActor = {
        type: "agent",
        agentId: "agent-456",
      };
      expect(actor.type).toBe("agent");
      expect(actor.agentId).toBe("agent-456");
    });

    it("should be identified by type guard", () => {
      const actor: Actor = {
        type: "agent",
        agentId: "agent-456",
      };
      expect(isSystemActor(actor)).toBe(false);
      expect(isHumanActor(actor)).toBe(false);
      expect(isAgentActor(actor)).toBe(true);
    });
  });

  describe("Actor union type", () => {
    it("should allow any actor type", () => {
      const actors: Actor[] = [
        { type: "system", systemId: "scheduler" },
        { type: "human", userId: "user-123" },
        { type: "agent", agentId: "agent-456" },
      ];
      expect(actors).toHaveLength(3);
    });
  });
});
