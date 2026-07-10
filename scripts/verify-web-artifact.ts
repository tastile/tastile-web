import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CENTRAL_FILE_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

export function listZipEntries(input: Uint8Array): string[] {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const eocdOffset = findSignatureFromEnd(view, END_OF_CENTRAL_DIRECTORY);
  if (eocdOffset < 0 || eocdOffset + 22 > view.byteLength) {
    throw new Error("Invalid ZIP: end-of-central-directory record not found");
  }

  const entryCount = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const entries: string[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== CENTRAL_FILE_HEADER) {
      throw new Error("Invalid ZIP: malformed central directory");
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + 46;
    entries.push(new TextDecoder().decode(input.subarray(nameStart, nameStart + nameLength)));
    offset = nameStart + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function assertSafeWebArtifact(input: Uint8Array): string[] {
  const entries = listZipEntries(input);
  const forbidden = entries.filter((entry) =>
    entry
      .split("/")
      .some((segment) => /^\.env(?:\.|$)/i.test(segment)),
  );
  if (forbidden.length > 0) {
    throw new Error(`Artifact contains environment files: ${forbidden.join(", ")}`);
  }
  return entries;
}

function findSignatureFromEnd(view: DataView, signature: number): number {
  for (let offset = view.byteLength - 4; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === signature) return offset;
  }
  return -1;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  const artifactPath = process.argv[2];
  if (!artifactPath) throw new Error("Usage: bun scripts/verify-web-artifact.ts <artifact.zip>");
  const entries = assertSafeWebArtifact(readFileSync(artifactPath));
  console.log(`Verified ${entries.length} artifact entries: no environment files found.`);
}
