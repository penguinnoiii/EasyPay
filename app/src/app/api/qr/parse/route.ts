import { NextResponse } from "next/server";
import { parsePromptPay } from "@/lib/promptpay";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.payload !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'payload'." }, { status: 400 });
  }

  const result = parsePromptPay(body.payload);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
