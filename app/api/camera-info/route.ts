import { NextResponse } from "next/server";
import { getCameraStatus } from "@/lib/db";

const DEFAULT_CAMERA_ID = "cam-1";

export async function GET() {
  try {
    const status = await getCameraStatus(DEFAULT_CAMERA_ID);
    return NextResponse.json({ ip: status?.ip ?? null });
  } catch (err: any) {
    console.error("camera-info error:", err);
    // If the database is unreachable (e.g. no internet while connected to ESP32‑CAM AP),
    // fall back gracefully instead of breaking the dashboard.
    return NextResponse.json({ ip: null });
  }
}

