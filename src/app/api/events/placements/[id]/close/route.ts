import { NextResponse } from "next/server";
import { upstreamClosePlacement } from "@/lib/upstream/events";

export const runtime = "nodejs";

/** POST /api/events/placements/{id}/close -- close a single placement
 *  without archiving its underlying tile. Use this when the user wants
 *  to dismiss one occurrence of a recurring tile without affecting
 *  future ones.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 422 });
  }
  return upstreamClosePlacement(id);
}
