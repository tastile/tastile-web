import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const DEFAULT_MANIFEST_URL =
  process.env.TASTILE_DESKTOP_MANIFEST_URL ??
  (SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/releases/updates/desktop/manifest.json`
    : '')

type DesktopManifest = {
  latest_version?: string
  download_url?: string
}

export async function GET() {
  if (!DEFAULT_MANIFEST_URL) {
    return NextResponse.json({ error: 'desktop_download_unavailable' }, { status: 503 })
  }

  try {
    const response = await fetch(DEFAULT_MANIFEST_URL, { cache: 'no-store' })
    if (response.ok) {
      const manifest = (await response.json()) as DesktopManifest
      if (manifest.download_url && manifest.download_url.trim().length > 0) {
        return NextResponse.redirect(manifest.download_url, 302)
      }
    }
  } catch {
    // fall through to legacy download path
  }

  return NextResponse.json({ error: 'desktop_download_unavailable' }, { status: 503 })
}
