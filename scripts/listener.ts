// Watches PaymentRouter for PaymentReceived events on Fuji, marks the matching
// Payment row CONFIRMED, then runs the mock payout and marks it PAID_OUT.
// Also sweeps QUOTED payments past their expiry to EXPIRED.
//
// Run from the repo root: npm run listener

import { config as loadEnv } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http } from "viem";
import { avalancheFuji } from "viem/chains";

const scriptDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(scriptDir, "..", "app", ".env.local") });

// Imported dynamically, after env vars are loaded: these modules read
// process.env at module-init time, and ESM static imports are hoisted above
// the loadEnv() call above regardless of source order.
const { prisma } = await import("../app/src/lib/db.ts");
const { paymentRouterAddress } = await import("../app/src/lib/addresses.ts");
const { payoutProvider } = await import("../app/src/lib/payout/index.ts");
const { default: paymentRouterAbi } = await import("../app/src/lib/abi/PaymentRouter.json", {
  with: { type: "json" },
});

const EXPIRY_SWEEP_INTERVAL_MS = 10_000;

const client = createPublicClient({
  chain: avalancheFuji,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

async function handlePaymentReceived(log: {
  args: {
    quoteId?: `0x${string}`;
    payer?: `0x${string}`;
    token?: `0x${string}`;
    tokenAmount?: bigint;
    thbSatang?: bigint;
    feeBps?: number;
    merchantHash?: `0x${string}`;
  };
  transactionHash: `0x${string}` | null;
}) {
  const { quoteId, token, tokenAmount, thbSatang, feeBps } = log.args;
  if (!quoteId) return;

  const payment = await prisma.payment.findUnique({ where: { quoteId } });
  if (!payment) {
    console.warn(`[listener] no Payment row for quoteId ${quoteId}, skipping`);
    return;
  }
  if (payment.status !== "QUOTED" && payment.status !== "SUBMITTED") {
    return; // already processed (e.g. re-org replay or duplicate log)
  }

  const mismatches: string[] = [];
  if (token && token.toLowerCase() !== payment.token.toLowerCase()) mismatches.push("token");
  if (tokenAmount !== undefined && tokenAmount.toString() !== payment.tokenAmount) mismatches.push("tokenAmount");
  if (thbSatang !== undefined && Number(thbSatang) !== payment.thbSatang) mismatches.push("thbSatang");
  if (feeBps !== undefined && feeBps !== payment.feeBps) mismatches.push("feeBps");
  if (mismatches.length > 0) {
    console.warn(`[listener] event/DB mismatch for ${quoteId} on: ${mismatches.join(", ")}`);
  }

  const confirmed = await prisma.payment.update({
    where: { quoteId },
    data: {
      status: "CONFIRMED",
      txHash: payment.txHash ?? log.transactionHash ?? undefined,
    },
  });
  console.log(`[listener] ${quoteId} CONFIRMED (tx ${confirmed.txHash})`);

  try {
    const { payoutRef } = await payoutProvider.payout({
      paymentId: confirmed.id,
      merchantId: confirmed.merchantId,
      thbSatang: confirmed.thbSatang,
    });
    await prisma.payment.update({
      where: { quoteId },
      data: { status: "PAID_OUT", payoutRef },
    });
    console.log(`[listener] ${quoteId} PAID_OUT (${payoutRef})`);
  } catch (err) {
    console.error(`[listener] payout failed for ${quoteId}:`, err);
    await prisma.payment.update({ where: { quoteId }, data: { status: "FAILED" } });
  }
}

async function sweepExpired() {
  const { count } = await prisma.payment.updateMany({
    where: { status: "QUOTED", expiry: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  if (count > 0) console.log(`[listener] marked ${count} payment(s) EXPIRED`);
}

console.log(`[listener] watching PaymentReceived on ${paymentRouterAddress} (Fuji)`);

client.watchContractEvent({
  address: paymentRouterAddress,
  abi: paymentRouterAbi,
  eventName: "PaymentReceived",
  onLogs: (logs) => {
    for (const log of logs) {
      handlePaymentReceived(log as unknown as Parameters<typeof handlePaymentReceived>[0]).catch((err) =>
        console.error("[listener] error handling log:", err),
      );
    }
  },
  onError: (err) => console.error("[listener] watch error:", err),
});

setInterval(() => {
  sweepExpired().catch((err) => console.error("[listener] sweep error:", err));
}, EXPIRY_SWEEP_INTERVAL_MS);
