"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { avalancheFuji } from "viem/chains";
import { useBalance, useConnection, useReadContract, useWriteContract } from "wagmi";
import { mockUsdcAbi, useContractConfig } from "@/lib/contracts";
import { useRates } from "@/lib/use-rates";
import { formatThb } from "@/lib/scan-types";
import { STATUS_COLORS, STATUS_LABELS, type PaymentRecord } from "@/lib/payment-types";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Home() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { address } = useConnection();
  const { data: contractConfig } = useContractConfig();
  const { data: rates } = useRates();
  const { writeContractAsync, isPending: isFauceting } = useWriteContract();
  const [faucetError, setFaucetError] = useState<string | null>(null);

  const { data: avaxBalance, isLoading: isAvaxLoading } = useBalance({
    address,
    chainId: avalancheFuji.id,
    query: { enabled: !!address },
  });

  const {
    data: usdcBalanceRaw,
    isLoading: isUsdcLoading,
    refetch: refetchUsdc,
  } = useReadContract({
    address: contractConfig?.mockUSDC,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractConfig?.mockUSDC },
  });

  const { data: recentPayments } = useQuery<PaymentRecord[]>({
    queryKey: ["payments", address],
    queryFn: async () => {
      const res = await fetch(`/api/payments?walletAddress=${address}`);
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
    enabled: !!address,
  });

  const avaxAmount = avaxBalance ? Number(formatUnits(avaxBalance.value, avaxBalance.decimals)) : 0;
  const usdcAmount = usdcBalanceRaw ? Number(formatUnits(usdcBalanceRaw as bigint, 6)) : 0;
  const totalThb = rates ? avaxAmount * rates.avaxThb + usdcAmount * rates.usdcThb : undefined;

  async function handleFaucet() {
    if (!contractConfig?.mockUSDC) return;
    setFaucetError(null);
    try {
      await writeContractAsync({
        address: contractConfig.mockUSDC,
        abi: mockUsdcAbi,
        functionName: "faucet",
        args: [],
      });
      setTimeout(() => refetchUsdc(), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Faucet request failed.";
      setFaucetError(message.includes("FaucetOnCooldown") ? "Faucet is on a 24h cooldown per wallet." : message);
    }
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 dark:bg-black">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
            EasyPay AVAX
          </h1>
          <p className="max-w-xs text-zinc-600 dark:text-zinc-400">
            Pay any Thai PromptPay QR with AVAX or USDC.
          </p>
          <p className="max-w-xs text-sm text-zinc-400 dark:text-zinc-500">
            จ่ายพร้อมเพย์ด้วย AVAX หรือ USDC
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            onClick={() => login({ loginMethods: ["google"] })}
            className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-background font-medium transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Continue with Google
          </button>
          <button
            onClick={() => login({ loginMethods: ["wallet"] })}
            className="flex h-12 items-center justify-center rounded-full border border-black/[.1] px-6 font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.15] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Connect existing wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-10 dark:bg-black">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {user?.google?.email ?? user?.email?.address ?? "Signed in"}
          </p>
          {address && (
            <p className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
              {shortenAddress(address)}
            </p>
          )}
        </div>
        <button
          onClick={logout}
          className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-400 dark:hover:bg-[#1a1a1a]"
        >
          Log out
        </button>
      </header>

      <section className="flex flex-col items-center gap-1 py-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Balance · ยอดคงเหลือ</p>
        <p className="text-4xl font-semibold text-black dark:text-zinc-50">
          {totalThb === undefined
            ? "—"
            : `฿${totalThb.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
        <div className="mt-2 flex flex-col items-center gap-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          <p>{isAvaxLoading ? "Loading..." : `${avaxAmount.toFixed(4)} AVAX`}</p>
          <p>{isUsdcLoading ? "Loading..." : `${usdcAmount.toFixed(2)} USDC`}</p>
        </div>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Avalanche Fuji testnet
        </p>
      </section>

      <Link
        href="/scan"
        className="flex h-14 flex-col items-center justify-center rounded-full bg-foreground text-lg font-medium leading-tight text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        <span>Scan to pay</span>
        <span className="text-xs font-normal opacity-80">สแกนเพื่อจ่าย</span>
      </Link>

      <div className="flex flex-col gap-1">
        <button
          onClick={handleFaucet}
          disabled={isFauceting || !contractConfig}
          className="flex h-12 items-center justify-center rounded-full border border-dashed border-black/[.15] text-sm text-zinc-500 transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.15] dark:text-zinc-400 dark:hover:bg-[#1a1a1a]"
        >
          {isFauceting ? "Requesting..." : "Get test USDC (testnet faucet)"}
        </button>
        {faucetError && <p className="text-center text-xs text-red-500">{faucetError}</p>}
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Recent payments · รายการล่าสุด
          </h2>
          <Link href="/history" className="text-xs text-zinc-400 underline dark:text-zinc-600">
            See all
          </Link>
        </div>
        {!recentPayments?.length ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-600">No payments yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentPayments.slice(0, 3).map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{p.merchantName ?? p.merchantId}</span>
                <div className="flex items-center gap-2">
                  <span className="text-black dark:text-zinc-50">฿{formatThb(p.thbSatang + p.feeSatang)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                    {STATUS_LABELS[p.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
