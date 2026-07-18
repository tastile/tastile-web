import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

const filePath = join(process.cwd(), "public", "openapi.yaml");
const openapiYaml = await readFile(filePath, "utf-8");

export async function GET() {
  return new NextResponse(openapiYaml, {
    headers: {
      "Content-Type": "text/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
