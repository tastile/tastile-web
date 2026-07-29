import { fetchDesktopReleaseInfo } from "@/lib/desktop-release";
import { NextResponse } from "next/server";

export async function GET() {
  const release = await fetchDesktopReleaseInfo();
  if (!release) {
    return NextResponse.json({ error: "desktop_version_unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    latest: release.latestVersion,
    download_url: release.downloadUrl,
    required: false,
    release_notes: release.notes,
  });
}
