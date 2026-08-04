import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertSafeWebArtifact } from "../../../scripts/verify-web-artifact";

describe("deploy artifact secret policy", () => {
  it("never copies environment or secret files into the uploaded artifact", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/deploy.yml"), "utf8");

    expect(workflow).not.toMatch(/cp\s+\.env(?:\.product)?\s+dist\//);
    expect(workflow).not.toMatch(/dist\/\.env(?:\.local)?/);
    expect(workflow).not.toMatch(/TASTILE_WEB_BRIDGE_SECRET=.*\n[ \s\S]*ENVEOF/);
    expect(workflow).toContain("bun scripts/verify-web-artifact.ts");
  });

  it("accepts a packaged application without environment files", () => {
    expect(assertSafeWebArtifact(zipDirectoryWith("server.js"))).toEqual(["server.js"]);
  });

  it("rejects an environment file anywhere in the packaged application", () => {
    expect(() => assertSafeWebArtifact(zipDirectoryWith("release/.env.local"))).toThrow(
      /environment files/i,
    );
  });
});

function zipDirectoryWith(name: string): Uint8Array {
  const encodedName = new TextEncoder().encode(name);
  const centralSize = 46 + encodedName.length;
  const bytes = new Uint8Array(centralSize + 22);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(28, encodedName.length, true);
  bytes.set(encodedName, 46);

  const end = centralSize;
  view.setUint32(end, 0x06054b50, true);
  view.setUint16(end + 8, 1, true);
  view.setUint16(end + 10, 1, true);
  view.setUint32(end + 12, centralSize, true);
  view.setUint32(end + 16, 0, true);
  return bytes;
}
