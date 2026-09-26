import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.txHash !== "string") {
    return NextResponse.json({ error: "Missing 'txHash'." }, { status: 400 });
  }

  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  const updated = await prisma.payment.update({
    where: { id },
    data: { status: "SUBMITTED", txHash: body.txHash },
  });

  return NextResponse.json(updated);
}
