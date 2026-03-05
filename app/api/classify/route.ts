import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateObject, gateway } from "ai";
import { logClassification } from "@/lib/db";

// Mirror how your portfolio-ai project uses Vercel AI:
// the `gateway()` helper reads AI_GATEWAY_API_KEY from .env
// and routes through Vercel AI Gateway, not OpenAI directly.
const model = gateway("google/gemini-2.5-flash");

const ClassificationSchema = z.object({
  label: z.enum(["cable", "phone", "battery", "pcb"]).catch("cable"),
  confidence: z.number().min(0).max(1).optional().catch(0.8),
  reason: z.string().optional().catch(""),
});

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, cameraUrl } = await req.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "imageBase64 is required" },
        { status: 400 },
      );
    }

    const { object } = await generateObject({
      model,
      schema: ClassificationSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "You are an e‑waste sorting assistant. " +
                'Classify the object in this photo into exactly one of: "cable", "phone", "battery", "pcb". ' +
                "Return a JSON object with label, confidence (0–1), and a short reason.",
            },
            {
              type: "image",
              // Gemini via gateway accepts data URLs; this keeps types happy
              image: `data:image/jpeg;base64,${imageBase64}`,
            },
          ],
        },
      ],
    });

    const result = {
      label: object.label,
      confidence: object.confidence,
      reason: object.reason,
    };

    // Fire-and-forget DB logging; errors here should not break the response.
    logClassification({
      label: result.label,
      confidence: result.confidence,
      reason: result.reason,
      cameraUrl: typeof cameraUrl === "string" ? cameraUrl : undefined,
    }).catch((err) => {
      console.error("Failed to log classification:", err);
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      {
        error: "Classification failed",
        details: String(err?.message || err),
      },
      { status: 500 },
    );
  }
}

