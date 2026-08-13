/**
 * DecisionDef TypeScript types, serializer, and candidate evaluator.
 *
 * Matches the Rust spec at tastile-core/v1/06-decision-and-feedback.md.
 * Decision evaluates candidates against constraints to decide whether to
 * auto-resolve or open a Session for user input.
 */

import type { ConditionNode } from "@/shared/model/v1/condition";
import { convertCondition } from "./plan-wire";

// ---------- DecisionObserve.scope numeric constants (v1/06 §Decision) ----------

export const DecisionObserveScope = {
  PLAN: 0,
  FRAME: 1,
  PLACEMENT: 2,
  EXECUTION: 3,
} as const;

interface DecisionObserve {
  scope: number;
}

// ---------- CandidateEffect.kind numeric constants (v1/06 §CandidateEffect) ----------

export const CandidateEffectKind = {
  PROPOSE_PLACEMENT: 0,
  PROPOSE_CHANGE: 1,
  REQUEST: 2,
} as const;

interface PlacementProposalDraft {
  span: { start: string; end: string } | null;
}

interface RequestDraft {
  /** Required for the REQUEST kind (v1/06 §87 idempotency key contract). */
  idempotencyKey: string;
}

interface CandidateEffect {
  kind: number;
  proposal: PlacementProposalDraft | null;
  change: unknown | null;
  request: RequestDraft | null;
}

export interface DecisionCandidate {
  id: string;
  when: ConditionNode;
  rank: number;
  effects: CandidateEffect[];
}

interface FeedbackReuseRule {
  id: string;
  when: ConditionNode;
  source: unknown;
  apply: unknown[];
}

export interface DecisionDef {
  id: string;
  observe: DecisionObserve;
  candidates: DecisionCandidate[];
  reuse: FeedbackReuseRule[];
  dialog: unknown;
}

// ---------- Serializer ----------

/**
 * Convert a DecisionDef from store shape (camelCase, internally-tagged Condition)
 * to wire shape (snake_case, externally-tagged Condition) for
 * PublishScheduleDefinitionPayload.
 */
export function serializeDecision(def: DecisionDef): unknown {
  return {
    id: def.id,
    observe: def.observe,
    candidates: def.candidates.map((c) => ({
      id: c.id,
      when: convertCondition(c.when),
      rank: c.rank,
      effects: c.effects.map((e) => ({
        kind: e.kind,
        proposal: e.proposal,
        change: e.change,
        request: e.request,
      })),
    })),
    reuse: def.reuse,
    dialog: def.dialog,
  };
}

// ---------- Candidate evaluator ----------

export interface ResolutionResult {
  kind: "AutoResolved" | "SessionPending";
  selectedCandidateIds: string[];
}

/**
 * Evaluate candidates against constraints (v1/06 §自動解決 7段).
 *
 * This is a pure frontend function for preview purposes.
 * The real evaluation happens in tastile-core.
 *
 * Simplified preview logic:
 * - Collect valid candidates (non-null `when` condition = always valid in preview)
 * - If 0 candidates → SessionPending
 * - If 1 candidate → AutoResolved
 * - If 2+ candidates → SessionPending (user must choose)
 */
export function evaluateCandidates(
  def: DecisionDef,
  _ctx: { now: Date; activePlacementIds: string[] },
): ResolutionResult {
  const validCandidates = def.candidates.filter((c) => c.when !== null);

  if (validCandidates.length === 0) {
    return { kind: "SessionPending", selectedCandidateIds: [] };
  }

  const sorted = [...validCandidates].sort((a, b) => a.rank - b.rank);

  if (sorted.length === 1) {
    return { kind: "AutoResolved", selectedCandidateIds: [sorted[0].id] };
  }

  return { kind: "SessionPending", selectedCandidateIds: sorted.map((c) => c.id) };
}
