import { NextResponse } from "next/server";
import { upstreamUpdateTile } from "@/lib/upstream/events";

export const runtime = "nodejs";

/** POST /api/events/tiles/{id}/update -- edit v1 tile content/visual.
 *  Used by recurring/flow-sourced events so we route the change back
 *  to the underlying tile (one edit affects all generated occurrences).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const b = (body ?? {}) as {
    title?: unknown;
    description?: unknown;
    color?: unknown;
    icon?: unknown;
  };
  if (
    b.title === undefined &&
    b.description === undefined &&
    b.color === undefined &&
    b.icon === undefined
  ) {
    return NextResponse.json(
      { error: "No updatable fields supplied" },
      { status: 422 },
    );
  }
  return upstreamUpdateTile(id, {
    title: typeof b.title === "string" ? b.title : undefined,
    description: typeof b.description === "string" ? b.description : null,
    color: typeof b.color === "string" ? b.color : null,
    icon: typeof b.icon === "string" ? b.icon : null,
  });
}
