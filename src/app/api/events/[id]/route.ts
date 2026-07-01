import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** The legacy per-event CRUD surface is gone. Use:
 *  - GET  /api/events/occurrences      to read
 *  - POST /api/events                   to create (tile + Manual placement)
 *  - POST /api/events/tiles/{tileId}/update  to edit (uses underlying tile)
 *  - DELETE /api/events/tiles/{tileId}        to archive (uses underlying tile)
 *  - POST /api/events/placements/{placementId}/close  to close a single occurrence
 */
function gone(_req?: Request, _ctx?: { params: Promise<{ id: string }> }): Response {
  return NextResponse.json(
    { error: "Event CRUD moved to /api/events/tiles and /api/events/placements" },
    { status: 410 },
  );
}

export const GET = gone;
export const PATCH = gone;
export const DELETE = gone;
