import { NextResponse } from 'next/server'

const CURRENT_VERSION = process.env.TASTILE_DESKTOP_VERSION ?? '0.1.0'
const DOWNLOAD_BASE = 'https://tastile.app/download'

export async function GET() {
  return NextResponse.json({
    latest: CURRENT_VERSION,
    download_url: `${DOWNLOAD_BASE}`,
    required: false,
    release_notes: 'Initial release',
  })
}
