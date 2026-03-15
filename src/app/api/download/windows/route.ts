import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const DOWNLOAD_URL = `${SUPABASE_URL}/storage/v1/object/public/releases/tastile-0.1.0-setup.exe`

export async function GET() {
  return NextResponse.redirect(DOWNLOAD_URL, 302)
}
