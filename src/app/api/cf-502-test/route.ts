import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "test_500" }, { status: 500 });
}

export async function POST() {
  return NextResponse.json({ error: "test_500_post" }, { status: 500 });
}