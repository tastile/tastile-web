import { NextResponse } from "next/server";
import { upstreamListTimeline } from "@/lib/upstream/events";

export const runtime = "nodejs";

/**
 * GET /api/events/occurrences?start=&end=&min_minutes=&include_recurring=
 *
 * Always proxies to the v1 Rust API. Lane assignment is intentionally
 * NOT done here -- the rendered width and overlap structure depend on
 * the view, so the client computes it.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start and end are required (RFC3339)" }, { status: 422 });
  }
  const minRaw = url.searchParams.get("min_minutes");
  const includeRaw = url.searchParams.get("include_recurring");
  const minMinutes = minRaw === null ? 0 : Math.max(0, Number(minRaw));
  const includeRecurring = includeRaw === null ? true : includeRaw !== "false";
  const ownerIds = url.searchParams.get("owner_ids")?.split(",").filter(Boolean);

  return upstreamListTimeline({
    start,
    end,
    minMinutes,
    includeRecurring,
    ownerIds,
  });
}
