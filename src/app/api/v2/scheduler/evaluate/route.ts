import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAuthenticatedUserSub } from "@/shared/auth/authenticated-session";
import {
  evaluateSchedulerV2,
  v2AdapterConfigFromEnv,
  type SchedulerEvalInput,
} from "@/lib/v2-adapter/scheduler-eval";

export const runtime = "nodejs";

const envelopeSchema = z.object({ opt_in: z.boolean().optional() });

// `z.number().int()` accepts unsafe integers (e.g. 1e21); bound to the
// IEEE-754 safe range so JSON.stringify cannot emit a rounded value.
const safeInt = z
  .number()
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);

const nullableInt = safeInt.nullable();

const requestSchema = z
  .strictObject({
    opt_in: z.boolean().optional(),
    input: z.strictObject({
      // Integers only — domain validity (positivity, ordering) is owned by the
      // v2 artifact, which reports typed statuses (invalid_window /
      // invalid_generation) instead of the route rejecting the shape.
      step_ms: safeInt,
      span_ms: safeInt,
      origin: nullableInt,
      bounds_start: nullableInt,
      bounds_end: nullableInt,
      range_start_ms: safeInt,
      range_end_ms: safeInt,
    }),
  })
  .refine((body) => body.input.range_end_ms >= body.input.range_start_ms, {
    message: "range_end_ms must be >= range_start_ms",
    path: ["input", "range_end_ms"],
  });

/** POST /api/v2/scheduler/evaluate -- opt-in v2 scheduler evaluation.
 *  Returns a typed result; on any v2 failure returns a typed fallback
 *  marker and never substitutes v1-computed values. */
export async function POST(req: Request): Promise<Response> {
  const userSub = await resolveAuthenticatedUserSub({
    requestHeaders: req.headers,
  });
  if (!userSub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const envelope = envelopeSchema.safeParse(body);
  if (!envelope.success || envelope.data.opt_in !== true) {
    return NextResponse.json({ engine: "disabled" });
  }
  const enabled = process.env.TASTILE_V2_ENABLED === "true";
  if (!enabled) {
    return NextResponse.json({ engine: "disabled" });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const config = v2AdapterConfigFromEnv();
  if (!config) {
    return NextResponse.json({
      engine: "fallback",
      ok: false,
      fallback_reason: "v2_not_configured",
    });
  }

  const input: SchedulerEvalInput = parsed.data.input;
  try {
    const result = await evaluateSchedulerV2(config, input);
    return NextResponse.json(result);
  } catch {
    // Unexpected adapter failure must still surface as a typed fallback,
    // never as an unhandled 500 that looks like a v1 result.
    return NextResponse.json({
      engine: "fallback",
      ok: false,
      fallback_reason: "v2_adapter_error",
    });
  }
}
