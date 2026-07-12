import { NextRequest, NextResponse } from "next/server";
import { processWithGemini } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "A valid document 'id' is required." },
        { status: 400 }
      );
    }

    const result = await processWithGemini(id);

    return NextResponse.json({ result }, { status: 200 });
  } catch (error: any) {
    console.error("Gemini API Error:", error);

    const message = error?.message || "An unexpected error occurred.";
    const status = message.includes("not found") ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
