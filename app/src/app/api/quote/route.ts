import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import type { Hex } from "viem";
import { parsePromptPay } from "@/lib/promptpay";
import { computeQuoteAmounts, type TokenSymbol } from "@/lib/pricing";
import { computeMerchantHash, signQuote } from "@/lib/quote-signer";
import { mockUsdcAddress, NATIVE_TOKEN_ADDRESS } from "@/lib/addresses";
import { prisma } from "@/lib/db";

const QUOTE_TTL_SECONDS = 60;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function isValidToken(value: unknown): value is TokenSymbol {
  return value === "AVAX" || value === "USDC";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.payload !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'payload'." }, { status: 400 });
  }
  if (typeof body.walletAddress !== "string" || !ADDRESS_RE.test(body.walletAddress)) {
    return NextResponse.json({ error: "Missing or invalid 'walletAddress'." }, { status: 400 });
  }
  if (!isValidToken(body.token)) {
    return NextResponse.json({ error: "'token' must be 'AVAX' or 'USDC'." }, { status: 400 });
  }

  const parsed = parsePromptPay(body.payload);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  let thbSatang: number;
  if (parsed.data.amountSatang !== undefined) {
    thbSatang = parsed.data.amountSatang;
  } else if (
    typeof body.amountSatang === "number" &&
    Number.isInteger(body.amountSatang) &&
    body.amountSatang > 0
  ) {
    thbSatang = body.amountSatang;
  } else {
    return NextResponse.json(
      { error: "This is a static QR — provide a positive integer 'amountSatang'." },
      { status: 400 },
    );
  }

  const { feeBps, feeSatang, tokenAmount, rateUsed, rateSource } = await computeQuoteAmounts(
    thbSatang,
    body.token,
  );

  const tokenAddress = body.token === "AVAX" ? NATIVE_TOKEN_ADDRESS : mockUsdcAddress;
  const quoteId = `0x${randomBytes(32).toString("hex")}` as Hex;
  const expirySeconds = Math.floor(Date.now() / 1000) + QUOTE_TTL_SECONDS;
  const merchantHash = computeMerchantHash(parsed.data.idType, parsed.data.id);
  const walletAddress = body.walletAddress as Hex;

  const signature = await signQuote({
    quoteId,
    payer: walletAddress,
    token: tokenAddress,
    tokenAmount,
    thbSatang: BigInt(thbSatang),
    feeBps,
    merchantHash,
    expiry: BigInt(expirySeconds),
  });

  const user = await prisma.user.upsert({
    where: { walletAddress },
    update: {},
    create: {
      walletAddress,
      authId: typeof body.authId === "string" ? body.authId : walletAddress,
    },
  });

  const payment = await prisma.payment.create({
    data: {
      quoteId,
      userId: user.id,
      token: tokenAddress,
      tokenAmount: tokenAmount.toString(),
      thbSatang,
      feeBps,
      feeSatang,
      merchantId: parsed.data.id,
      merchantName: parsed.data.merchantName,
      rateUsed,
      expiry: new Date(expirySeconds * 1000),
    },
  });

  return NextResponse.json({
    paymentId: payment.id,
    quote: {
      quoteId,
      payer: walletAddress,
      token: tokenAddress,
      tokenAmount: tokenAmount.toString(),
      thbSatang,
      feeBps,
      merchantHash,
      expiry: expirySeconds,
    },
    signature,
    breakdown: {
      merchantName: parsed.data.merchantName,
      thbSatang,
      feeSatang,
      totalThbSatang: thbSatang + feeSatang,
      tokenAmount: tokenAmount.toString(),
      rateUsed,
      rateSource,
      expiresAt: expirySeconds,
    },
  });
}
