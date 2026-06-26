import { describe, it, expect } from "vitest";
import {
  TileKind,
  PlanRole,
  RecurringState,
  PlacementSource,
  ExecutionState,
  ExecutionSegmentKind,
  ChangeLayer,
  ChangeKind,
  ChangeSource,
  MergeMode,
  TimeScope,
  TimeSource,
  TimeAggregate,
  TimeQuantifier,
  TaskOrderRelation,
  CommandResult,
  ApiErrorKind,
  ActorKind,
  AggregateKind,
  ResolutionState,
  ConditionKind,
  HolidayKind,
} from "./constants";

describe("v1 numeric constants", () => {
  describe("TileKind", () => {
    it("matches v1/02 §Tile", () => {
      expect(TileKind.RECURRING).toBe(0);
      expect(TileKind.PLACEMENT).toBe(1);
      expect(TileKind.EXECUTION).toBe(2);
    });
  });

  describe("PlanRole", () => {
    it("matches v1/02 §Plan.role", () => {
      expect(PlanRole.EXECUTABLE).toBe(0);
      expect(PlanRole.LABEL).toBe(1);
    });
  });

  describe("RecurringState", () => {
    it("matches v1/02 §Recurring.state", () => {
      expect(RecurringState.ACTIVE).toBe(0);
      expect(RecurringState.PAUSED).toBe(1);
      expect(RecurringState.ENDED).toBe(2);
      expect(RecurringState.CANCELLED).toBe(3);
    });
  });

  describe("PlacementSource", () => {
    it("matches v1/02 §Placement.source", () => {
      expect(PlacementSource.MANUAL).toBe(0);
      expect(PlacementSource.RECURRING).toBe(1);
      expect(PlacementSource.FLOW).toBe(2);
      expect(PlacementSource.IMPORT).toBe(3);
    });
  });

  describe("ExecutionState", () => {
    it("matches v1/02 §Execution", () => {
      expect(ExecutionState.ACTIVE).toBe(0);
      expect(ExecutionState.PAUSED).toBe(1);
      expect(ExecutionState.FINISHED_NORMAL).toBe(2);
      expect(ExecutionState.FINISHED_VOID).toBe(3);
    });
  });

  describe("ExecutionSegmentKind", () => {
    it("matches v1/02 §ExecutionSegment.kind", () => {
      expect(ExecutionSegmentKind.ACTIVE).toBe(0);
      expect(ExecutionSegmentKind.PAUSED).toBe(1);
    });
  });

  describe("ChangeLayer", () => {
    it("matches v1/04 §層", () => {
      expect(ChangeLayer.RECURRING).toBe(0);
      expect(ChangeLayer.PLACEMENT).toBe(1);
      expect(ChangeLayer.EXECUTION).toBe(2);
    });
  });

  describe("ChangeKind", () => {
    it("matches v1/04 §ChangeKind", () => {
      expect(ChangeKind.SET).toBe(0);
      expect(ChangeKind.CLEAR).toBe(1);
      expect(ChangeKind.PUT).toBe(2);
      expect(ChangeKind.DROP).toBe(3);
    });
  });

  describe("ChangeSource", () => {
    it("matches v1/04 §Source", () => {
      expect(ChangeSource.RECURRING).toBe(0);
      expect(ChangeSource.FLOW).toBe(1);
      expect(ChangeSource.USER).toBe(2);
      expect(ChangeSource.DECISION).toBe(3);
      expect(ChangeSource.EXECUTION).toBe(4);
    });
  });

  describe("MergeMode", () => {
    it("matches v1/04 §Merge Mode", () => {
      expect(MergeMode.OVERRIDE).toBe(0);
      expect(MergeMode.INTERSECT_RANGE).toBe(1);
      expect(MergeMode.UNION_IDENTIFIED).toBe(2);
      expect(MergeMode.ORDERED_IDENTIFIED).toBe(3);
      expect(MergeMode.SPAN_ENDPOINT).toBe(4);
    });
  });

  describe("TimeScope", () => {
    it("matches v1/13 §TimeObservation.scope", () => {
      expect(TimeScope.EXECUTION).toBe(0);
      expect(TimeScope.PLACEMENT).toBe(1);
      expect(TimeScope.FRAME).toBe(2);
      expect(TimeScope.CHILDREN).toBe(3);
      expect(TimeScope.REFERENCE).toBe(4);
    });
  });

  describe("TimeSource", () => {
    it("matches v1/13 §TimeObservation.source", () => {
      expect(TimeSource.ACTIVE_SEGMENT).toBe(0);
      expect(TimeSource.PAUSED_SEGMENT).toBe(1);
      expect(TimeSource.EXECUTION).toBe(2);
    });
  });

  describe("TimeAggregate", () => {
    it("matches v1/13 §TimeObservation.aggregate", () => {
      expect(TimeAggregate.TOTAL_DURATION).toBe(0);
      expect(TimeAggregate.EACH_DURATION).toBe(1);
      expect(TimeAggregate.COUNT).toBe(2);
      expect(TimeAggregate.GAP_DURATION).toBe(3);
      expect(TimeAggregate.SPAN_DURATION).toBe(4);
    });
  });

  describe("TimeQuantifier", () => {
    it("matches v1/13 §TimeObservation.quantifier", () => {
      expect(TimeQuantifier.ALL).toBe(0);
      expect(TimeQuantifier.ANY).toBe(1);
    });
  });

  describe("TaskOrderRelation", () => {
    it("matches v1/13 §TaskOrderRule.relation", () => {
      expect(TaskOrderRelation.BEFORE).toBe(0);
      expect(TaskOrderRelation.AFTER).toBe(1);
    });
  });

  describe("CommandResult", () => {
    it("matches v1/14 §1-3", () => {
      expect(CommandResult.APPLIED).toBe(0);
      expect(CommandResult.ALREADY_APPLIED).toBe(1);
      expect(CommandResult.ACCEPTED).toBe(2);
    });
  });

  describe("ApiErrorKind", () => {
    it("matches v1/14 §1-4 (8 values)", () => {
      expect(ApiErrorKind.VALIDATION).toBe(0);
      expect(ApiErrorKind.FORBIDDEN).toBe(1);
      expect(ApiErrorKind.STALE_REVISION).toBe(2);
      expect(ApiErrorKind.IDEMPOTENCY_KEY_REUSED).toBe(3);
      expect(ApiErrorKind.NOT_FOUND).toBe(4);
      expect(ApiErrorKind.CONFLICT).toBe(5);
      expect(ApiErrorKind.BLOCKED).toBe(6);
      expect(ApiErrorKind.RETRYABLE).toBe(7);
    });
  });

  describe("ActorKind", () => {
    it("matches v1/10 §4-3", () => {
      expect(ActorKind.USER).toBe(0);
      expect(ActorKind.WORKER).toBe(1);
      expect(ActorKind.IMPORT).toBe(2);
      expect(ActorKind.SYSTEM).toBe(3);
    });
  });

  describe("AggregateKind", () => {
    it("matches v1/14 §2", () => {
      expect(AggregateKind.RECURRING).toBe(0);
      expect(AggregateKind.PLACEMENT).toBe(1);
      expect(AggregateKind.EXECUTION).toBe(2);
      expect(AggregateKind.SESSION).toBe(3);
    });
  });

  describe("ResolutionState", () => {
    it("matches v1/14 §3", () => {
      expect(ResolutionState.OPEN).toBe(0);
      expect(ResolutionState.CLOSED).toBe(1);
      expect(ResolutionState.BLOCKED).toBe(2);
    });
  });

  describe("ConditionKind", () => {
    it("matches v1/05 §Condition", () => {
      expect(ConditionKind.ALL).toBe(0);
      expect(ConditionKind.ANY).toBe(1);
      expect(ConditionKind.NOT).toBe(2);
      expect(ConditionKind.TERM).toBe(3);
    });
  });

  describe("HolidayKind", () => {
    it("matches v1/05 §CalendarTerm.holidayKind", () => {
      expect(HolidayKind.NOT_HOLIDAY).toBe(0);
      expect(HolidayKind.HOLIDAY).toBe(1);
      expect(HolidayKind.ANY).toBe(2);
    });
  });

  describe("total count", () => {
    it("exports 82 numeric constants across 22 groups", () => {
      const total =
        Object.keys(TileKind).length +
        Object.keys(PlanRole).length +
        Object.keys(RecurringState).length +
        Object.keys(PlacementSource).length +
        Object.keys(ExecutionState).length +
        Object.keys(ExecutionSegmentKind).length +
        Object.keys(ChangeLayer).length +
        Object.keys(ChangeKind).length +
        Object.keys(ChangeSource).length +
        Object.keys(MergeMode).length +
        Object.keys(TimeScope).length +
        Object.keys(TimeSource).length +
        Object.keys(TimeAggregate).length +
        Object.keys(TimeQuantifier).length +
        Object.keys(TaskOrderRelation).length +
        Object.keys(CommandResult).length +
        Object.keys(ApiErrorKind).length +
        Object.keys(ActorKind).length +
        Object.keys(AggregateKind).length +
        Object.keys(ResolutionState).length +
        Object.keys(ConditionKind).length +
        Object.keys(HolidayKind).length;
      expect(total).toBe(82);
    });
  });
});