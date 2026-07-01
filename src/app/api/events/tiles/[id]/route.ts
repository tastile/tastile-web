import { NextResponse } from "next/server";
import { upstreamArchiveTile } from "@/lib/upstream/events";

export const runtime = "nodejs";

/** DELETE /api/events/tiles/{id} -- archive the v1 tile behind this event.
 *  Archiving a tile removes its generated placements from the timeline
 *  (replaces the legacy "delete event" semantics).
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 422 });
  }
  return upstreamArchiveTile(id);
}

export function GET(): Response {
  return NextResponse.json(
    { error: "Use /api/events/occurrences to read calendar data" },
    { status: 410 },
  );
}
