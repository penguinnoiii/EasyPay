import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("walletAddress");
  if (!walletAddress || !ADDRESS_RE.test(walletAddress)) {
    return NextResponse.json({ error: "Missing or invalid 'walletAddress' query param." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) {
    return NextResponse.json([]);
  }

  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(payments);
}
