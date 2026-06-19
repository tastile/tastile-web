import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const filePath = join(process.cwd(), "public", "openapi.yaml");
  const content = await readFile(filePath, "utf-8");
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
