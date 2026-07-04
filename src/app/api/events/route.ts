import { NextResponse } from "next/server";
import { upstreamCreateCalendarEvent } from "@/lib/upstream/events";

export const runtime = "nodejs";

/** The legacy "list all events" surface is gone. Calendar reads go
 *  through GET /api/events/occurrences (v1 /v1/timeline).
 */
export async function GET(): Promise<Response> {
  return NextResponse.json(
    { error: "Use /api/events/occurrences to read calendar data" },
    { status: 410 },
  );
}

/** POST /api/events -- compose a v1 tile + Manual placement. */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const b = (body ?? {}) as {
    title?: unknown;
    description?: unknown;
    start?: unknown;
    end?: unknown;
    color?: unknown;
    icon?: unknown;
  };
  if (typeof b.title !== "string" || typeof b.start !== "string" || typeof b.end !== "string") {
    return NextResponse.json({ error: "title, start, end are required" }, { status: 422 });
  }
  return upstreamCreateCalendarEvent({
    title: b.title,
    description: typeof b.description === "string" ? b.description : null,
    start: b.start,
    end: b.end,
    color: typeof b.color === "string" ? b.color : null,
    icon: typeof b.icon === "string" ? b.icon : null,
  });
}
