import type { FactTerm, FeedbackTerm, MetricTerm, Term } from "@/shared/model/v1/condition";
import { HolidayKind } from "@/shared/model/v1/constants";

export function defaultTerm(kind: string): Term {
  switch (kind) {
    case "calendar":
      return {
        kind: "calendar",
        value: {
          weekdayMask: 0,
          timeStart: null,
          timeEnd: null,
          holidayKind: HolidayKind.ANY,
          dateRange: null,
          offsetMin: 0,
        },
      };
    case "moment":
      return { kind: "moment", value: { referenceId: null, point: null, offsetMs: 0 } };
    case "relation":
      return { kind: "relation", value: { referenceId: "", relation: 0, windowKind: 0 } };
    case "gap":
      return {
        kind: "gap",
        value: {
          scope: 0,
          leftAnchor: { referenceId: null, point: null },
          rightAnchor: { referenceId: null, point: null },
          size: { minMs: null, maxMs: null },
        },
      };
    case "requirement":
      return { kind: "requirement", value: { requirementId: "", state: 0 } };
    case "task":
      return { kind: "task", value: { taskId: "", state: 0 } };
    case "fact":
      return { kind: "fact", value: { factId: "", op: 0, value: null } };
    case "metric":
      return { kind: "metric", value: { metricId: "", op: 0, value: null } };
    case "feedback":
      return { kind: "feedback", value: { feedbackTxnId: "", op: 0, value: null } };
    case "life":
      return { kind: "life", value: { target: "", state: 0 } };
    default:
      return {
        kind: "calendar",
        value: {
          weekdayMask: 0,
          timeStart: null,
          timeEnd: null,
          holidayKind: HolidayKind.ANY,
          dateRange: null,
          offsetMin: 0,
        },
      };
  }
}
