import { NextRequest, NextResponse } from "next/server";
import { getRecentClassifications } from "@/lib/db";

export async function GET(_req: NextRequest) {
  try {
    const rows = await getRecentClassifications(20);
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load history", details: String(err?.message || err) },
      { status: 500 },
    );
  }
}

