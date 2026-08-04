import type { TimeRequirement } from "@/tile/model/v1/completion";

/**
 * Serialize a TimeRequirement from store shape to wire shape.
 * The wire format matches PublishScheduleDefinitionPayload.plan.completion.timeRequirements[].
 *
 * Field renames:
 *   store: required.minMs / required.maxMs  →  wire: required.min / required.max
 *   store: preferred.minMs / preferred.maxMs →  wire: preferred.min / preferred.max
 */
export function serializeTimeRequirement(req: TimeRequirement): unknown {
  return {
    observation: {
      scope: req.observation.scope,
      source: req.observation.source,
      aggregate: req.observation.aggregate,
      quantifier: req.observation.quantifier,
    },
    required: {
      min: req.required.minMs,
      max: req.required.maxMs,
    },
    preferred: req.preferred
      ? {
          min: req.preferred.minMs,
          max: req.preferred.maxMs,
        }
      : null,
  };
}
