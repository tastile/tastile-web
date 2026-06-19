import { NextResponse } from "next/server";
import { fetchDesktopReleaseInfo } from "@/lib/desktop-release";

export async function GET() {
  const release = await fetchDesktopReleaseInfo();
  if (!release) {
    return NextResponse.json({ error: "desktop_download_unavailable" }, { status: 503 });
  }

  return NextResponse.redirect(release.downloadUrl, 302);
}
