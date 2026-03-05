import { NextResponse } from "next/server";
import { getCameraStatus } from "@/lib/db";

const DEFAULT_CAMERA_ID = "cam-1";

export async function GET() {
  try {
    const status = await getCameraStatus(DEFAULT_CAMERA_ID);
    return NextResponse.json({ ip: status?.ip ?? null });
  } catch (err: any) {
    console.error("camera-info error:", err);
    return NextResponse.json(
      { ip: null, error: String(err?.message || err) },
      { status: 500 },
    );
  }
}

