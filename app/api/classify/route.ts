import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateObject, gateway } from "ai";
import { logClassification } from "@/lib/db";

const model = gateway("google/gemini-2.5-flash");

const ClassificationSchema = z.object({
  label: z.enum(["cable", "phone", "battery", "pcb", "other"]).catch("other"),
  confidence: z.number().min(0).max(1).optional().catch(0.7),
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
                'Classify the object in this photo into exactly one of: "cable", "phone", "battery", "pcb", "other".\n\n' +
                "Category rules:\n" +
                '- "cable": ANY cable, wire, charger, wall charger, wall adapter, power adapter, power brick, USB plug, power supply, charging block, or anything used to charge or transmit power/data\n' +
                '- "phone": smartphones, mobile phones, tablets, handheld electronic devices\n' +
                '- "battery": any battery, power bank, rechargeable cell, AA/AAA/lithium battery\n' +
                '- "pcb": circuit boards, motherboards, PCBs, electronic components mounted on a board\n' +
                '- "other": ONLY for non-electronic items — toys, food, furniture, clothing, keys, toothpaste, or items with zero electronic function\n\n' +
                "Important: chargers and power adapters are ALWAYS classified as \"cable\", not \"other\".\n" +
                "Return a JSON object with label, confidence (0–1), and a short reason.",
            },
            {
              type: "image",
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