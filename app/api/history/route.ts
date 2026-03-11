import { NextRequest, NextResponse } from "next/server";
import { getRecentClassifications } from "@/lib/db";

export async function GET(_req: NextRequest) {
  const rows = await getRecentClassifications(20);
  return NextResponse.json(rows);
}

