"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { avalancheFuji } from "viem/chains";
import { useBalance, useConfig, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { mockUsdcAbi, paymentRouterAbi, useContractConfig } from "@/lib/contracts";
import { formatThb, maskMerchantId, type ParsedQr, type QuoteResponse, type TokenSymbol } from "@/lib/scan-types";

interface ConfirmViewProps {
  parsed: ParsedQr;
  amountSatang: number;
  walletAddress: `0x${string}`;
  onSubmitted: (paymentId: string, txHash: string) => void;
  onCancel: () => void;
}

const TOKEN_DECIMALS: Record<TokenSymbol, number> = { AVAX: 18, USDC: 6 };

export function ConfirmView({ parsed, amountSatang, walletAddress, onSubmitted, onCancel }: ConfirmViewProps) {
  const [token, setToken] = useState<TokenSymbol>("USDC");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [payStep, setPayStep] = useState<"idle" | "approving" | "paying">("idle");
  const [payError, setPayError] = useState<string | null>(null);

  const wagmiConfig = useConfig();
  const { data: contractConfig, isError: contractConfigError } = useContractConfig();
  const { writeContractAsync } = useWriteContract();

  const { data: avaxBalance } = useBalance({
    address: walletAddress,
    chainId: avalancheFuji.id,
  });

  const { data: usdcBalance } = useReadContract({
    address: contractConfig?.mockUSDC,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: [walletAddress],
    query: { enabled: !!contractConfig?.mockUSDC },
  });

  const { data: allowance } = useReadContract({
    address: contractConfig?.mockUSDC,
    abi: mockUsdcAbi,
    functionName: "allowance",
    args: [walletAddress, contractConfig?.paymentRouter],
    query: { enabled: !!contractConfig?.mockUSDC && !!contractConfig?.paymentRouter && token === "USDC" },
  });

  async function fetchQuote(nextToken: TokenSymbol, isStale: () => boolean) {
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: parsed.raw, token: nextToken, amountSatang, walletAddress }),
      });
      const body = await res.json();
      if (isStale()) return;
      if (!res.ok) throw new Error(body.error ?? "Failed to get a quote.");
      setQuote(body as QuoteResponse);
    } catch (err) {
      if (isStale()) return;
      setQuoteError(err instanceof Error ? err.message : "Failed to get a quote.");
      setQuote(null);
    } finally {
      if (!isStale()) setQuoteLoading(false);
    }
  }

  useEffect(() => {
    let stale = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-dependency-change with a staleness guard against the race
    fetchQuote(token, () => stale);
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!quote) return;
    const tick = () => setSecondsLeft(Math.max(0, quote.quote.expiry - Math.floor(Date.now() / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [quote]);

  const tokenAmount = quote ? BigInt(quote.quote.tokenAmount) : null;
  const currentBalance = token === "AVAX" ? avaxBalance?.value : (usdcBalance as bigint | undefined);
  const insufficientBalance =
    tokenAmount !== null && currentBalance !== undefined ? currentBalance < tokenAmount : false;
  const expired = secondsLeft <= 0 && !!quote;

  async function handlePay() {
    if (!quote || !contractConfig || tokenAmount === null) return;
    setPayError(null);

    const quoteStruct = {
      quoteId: quote.quote.quoteId,
      payer: quote.quote.payer,
      token: quote.quote.token,
      tokenAmount,
      thbSatang: BigInt(quote.quote.thbSatang),
      feeBps: quote.quote.feeBps,
      merchantHash: quote.quote.merchantHash,
      expiry: BigInt(quote.quote.expiry),
    };

    try {
      let hash: `0x${string}`;
      if (token === "AVAX") {
        setPayStep("paying");
        hash = await writeContractAsync({
          address: contractConfig.paymentRouter,
          abi: paymentRouterAbi,
          functionName: "payNative",
          args: [quoteStruct, quote.signature],
          value: tokenAmount,
        });
      } else {
        if ((allowance as bigint | undefined) === undefined || (allowance as bigint) < tokenAmount) {
          setPayStep("approving");
          const approveHash = await writeContractAsync({
            address: contractConfig.mockUSDC,
            abi: mockUsdcAbi,
            functionName: "approve",
            args: [contractConfig.paymentRouter, tokenAmount],
          });
          await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
        }
        setPayStep("paying");
        hash = await writeContractAsync({
          address: contractConfig.paymentRouter,
          abi: paymentRouterAbi,
          functionName: "pay",
          args: [quoteStruct, quote.signature],
        });
      }

      await fetch(`/api/payments/${quote.paymentId}/submitted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: hash }),
      });

      onSubmitted(quote.paymentId, hash);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment failed.");
      setPayStep("idle");
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 px-6 py-8 dark:bg-black">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Paying · จ่ายให้</p>
        <p className="text-lg font-medium text-black dark:text-zinc-50">
          {parsed.merchantName ?? maskMerchantId(parsed.idType, parsed.id)}
        </p>
      </div>

      {quoteLoading && !quote && (
        <p className="text-center text-sm text-zinc-400 dark:text-zinc-600">Getting a quote...</p>
      )}

      {quoteError && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-sm text-red-500">{quoteError}</p>
          <div className="flex gap-3">
            <button
              onClick={() => fetchQuote(token, () => false)}
              className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background"
            >
              Retry
            </button>
            <button onClick={onCancel} className="rounded-full border border-black/[.1] px-5 py-2 text-sm text-zinc-600 dark:border-white/[.15] dark:text-zinc-400">
              Cancel
            </button>
          </div>
        </div>
      )}

      {quote && (
        <>
          <div className="flex flex-col items-center gap-1 py-4">
            <p className="text-4xl font-semibold text-black dark:text-zinc-50">
              ฿{formatThb(quote.breakdown.totalThbSatang)}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              ฿{formatThb(quote.breakdown.thbSatang)} + fee ฿{formatThb(quote.breakdown.feeSatang)} (
              {(quote.quote.feeBps / 100).toFixed(1)}%)
            </p>
          </div>

          <div className="flex justify-center gap-2">
            {(["USDC", "AVAX"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setToken(t)}
                disabled={quoteLoading}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  token === t
                    ? "bg-foreground text-background"
                    : "border border-black/[.1] text-zinc-600 dark:border-white/[.15] dark:text-zinc-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            {formatUnits(tokenAmount!, TOKEN_DECIMALS[token])} {token}
          </p>

          <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
            {expired ? "Quote expired · โควทหมดอายุ" : `Quote valid for ${secondsLeft}s`}
          </p>

          {insufficientBalance && (
            <p className="text-center text-sm text-red-500">Insufficient {token} balance.</p>
          )}
          {contractConfigError && (
            <p className="text-center text-sm text-red-500">
              Could not load contract config.{" "}
              <button onClick={() => window.location.reload()} className="underline">
                Reload
              </button>
            </p>
          )}
          {payError && <p className="text-center text-sm text-red-500">{payError}</p>}

          <div className="mt-auto flex flex-col gap-3">
            {expired ? (
              <button
                onClick={() => fetchQuote(token, () => false)}
                className="flex h-14 items-center justify-center rounded-full bg-foreground text-lg font-medium text-background"
              >
                Get new quote
              </button>
            ) : (
              <button
                onClick={handlePay}
                disabled={insufficientBalance || payStep !== "idle" || quoteLoading || !contractConfig}
                className="flex h-14 items-center justify-center rounded-full bg-foreground text-lg font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
              >
                {payStep === "approving"
                  ? "Approving..."
                  : payStep === "paying"
                    ? "Paying..."
                    : `Pay ฿${formatThb(quote.breakdown.totalThbSatang)}`}
              </button>
            )}
            <button
              onClick={onCancel}
              disabled={payStep !== "idle"}
              className="flex h-12 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
