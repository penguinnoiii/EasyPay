"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useConnection } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatThb } from "@/lib/scan-types";
import { STATUS_COLORS, STATUS_LABELS, type PaymentRecord } from "@/lib/payment-types";

export default function HistoryPage() {
  const { ready, authenticated } = usePrivy();
  const { address } = useConnection();

  const {
    data: payments,
    isLoading,
    isError,
    refetch,
  } = useQuery<PaymentRecord[]>({
    queryKey: ["payments", address],
    queryFn: async () => {
      const res = await fetch(`/api/payments?walletAddress=${address}`);
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
    enabled: !!address,
    refetchInterval: 5000,
  });

  if (!ready) return null;

  if (!authenticated) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Log in from the home screen first.</p>
        <Link href="/" className="text-sm underline text-zinc-500 dark:text-zinc-400">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 px-6 py-10 dark:bg-black">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">History · ประวัติ</h1>
        <Link href="/" className="text-sm text-zinc-500 underline dark:text-zinc-400">
          Home
        </Link>
      </header>

      {isLoading && <p className="text-sm text-zinc-400 dark:text-zinc-600">Loading...</p>}

      {isError && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-red-500">Could not load your history.</p>
          <button onClick={() => refetch()} className="text-sm underline text-zinc-500 dark:text-zinc-400">
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && payments?.length === 0 && (
        <p className="text-sm text-zinc-400 dark:text-zinc-600">No payments yet.</p>
      )}

      <ul className="flex flex-col gap-3">
        {payments?.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white px-4 py-3 dark:border-white/[.1] dark:bg-zinc-900"
          >
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-black dark:text-zinc-50">
                {p.merchantName ?? p.merchantId}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-600">
                {new Date(p.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-sm font-medium text-black dark:text-zinc-50">
                ฿{formatThb(p.thbSatang + p.feeSatang)}
              </p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                {STATUS_LABELS[p.status]}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
