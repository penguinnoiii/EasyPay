"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWaitForTransactionReceipt } from "wagmi";
import { formatThb, maskMerchantId } from "@/lib/scan-types";
import { STATUS_LABELS, type PaymentRecord } from "@/lib/payment-types";

interface ProcessingViewProps {
  paymentId: string;
  txHash: `0x${string}`;
  onDone: () => void;
}

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set(["PAID_OUT", "FAILED", "EXPIRED"]);

export function ProcessingView({ paymentId, txHash, onDone }: ProcessingViewProps) {
  const { isSuccess: onChainConfirmed, isLoading: onChainLoading, isError: onChainError } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const [payment, setPayment] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/payments/${paymentId}`);
        if (!res.ok || stopped) return;
        const data = (await res.json()) as PaymentRecord;
        if (stopped) return;
        setPayment(data);
        if (!TERMINAL_STATUSES.has(data.status)) {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (!stopped) setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
    poll();

    return () => {
      stopped = true;
    };
  }, [paymentId]);

  const paidOut = payment?.status === "PAID_OUT";
  const failed = payment?.status === "FAILED" || payment?.status === "EXPIRED" || onChainError;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 py-10 text-center dark:bg-black">
      <div className="flex flex-col items-center gap-2">
        <StepRow label="Submitted · ส่งแล้ว" done />
        <StepRow
          label="Confirmed on-chain · ยืนยันบนเชนแล้ว"
          done={onChainConfirmed}
          loading={onChainLoading}
          error={onChainError}
        />
        <StepRow
          label="Merchant paid (demo) · จ่ายร้านค้าแล้ว (จำลอง)"
          done={paidOut}
          loading={onChainConfirmed && !paidOut && !failed}
          error={failed}
        />
      </div>

      <a
        href={`https://testnet.snowscan.xyz/tx/${txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm underline text-zinc-500 dark:text-zinc-400"
      >
        View on Snowtrace
      </a>

      {onChainError && (
        <p className="text-sm text-red-500">
          The transaction did not confirm on-chain. Check Snowtrace for details.
        </p>
      )}
      {!onChainError && payment?.status === "FAILED" && (
        <p className="text-sm text-red-500">The mock payout failed. Contact support with the tx hash above.</p>
      )}
      {payment?.status === "EXPIRED" && (
        <p className="text-sm text-red-500">This quote expired before the payout could run.</p>
      )}

      {paidOut && payment && (
        <div className="mt-4 flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-black/[.08] bg-white p-6 text-left dark:border-white/[.1] dark:bg-zinc-900">
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">Receipt</p>
          <Row label="Merchant" value={payment.merchantName ?? maskMerchantId(undefined, payment.merchantId)} />
          <Row label="Amount" value={`฿${formatThb(payment.thbSatang + payment.feeSatang)}`} />
          <Row label="Time" value={new Date(payment.updatedAt).toLocaleString()} />
          <Row label="Tx hash" value={`${txHash.slice(0, 10)}...${txHash.slice(-6)}`} mono />
          <Row label="Payout ref" value={`${payment.payoutRef} (Demo payout)`} />
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
            Status: {STATUS_LABELS[payment.status]}
          </p>
        </div>
      )}

      {(paidOut || failed) && (
        <button
          onClick={onDone}
          className="mt-2 flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-base font-medium text-background"
        >
          Done
        </button>
      )}

      <Link href="/" className="text-xs text-zinc-400 dark:text-zinc-600">
        Back to home
      </Link>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={`text-black dark:text-zinc-50 ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function StepRow({
  label,
  done,
  loading,
  error,
}: {
  label: string;
  done: boolean;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <p className={`text-sm ${done ? "text-black dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-600"}`}>
      {error ? "⚠" : done ? "✓" : loading ? "…" : "○"} {label}
    </p>
  );
}
