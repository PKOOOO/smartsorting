import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { cameraUrl } = await req.json();

    if (typeof cameraUrl !== "string" || !cameraUrl.startsWith("http")) {
      return NextResponse.json(
        { error: "cameraUrl must be a valid http URL" },
        { status: 400 },
      );
    }

    const res = await fetch(cameraUrl, { cache: "no-store" });
    if (!res.ok || !res.body) {
      return NextResponse.json(
        { error: `Camera error: ${res.status}` },
        { status: 502 },
      );
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Camera proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch from camera" },
      { status: 500 },
    );
  }
}

