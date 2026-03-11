import { NextRequest, NextResponse } from "next/server";
import { upsertCameraStatus } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { id, ip } = await req.json();

    if (typeof id !== "string" || typeof ip !== "string") {
      return NextResponse.json(
        { error: "id and ip must be strings" },
        { status: 400 },
      );
    }

    await upsertCameraStatus(id, ip);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("register-camera error (DB may be unreachable):", err);
    // Return 200 so the ESP32 doesn't retry; IP will not be in DB until Neon is reachable
    return NextResponse.json({ ok: false, error: "DB unreachable" });
  }
}

