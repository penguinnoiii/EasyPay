"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useConnection } from "wagmi";
import { ScannerView } from "@/components/scan/ScannerView";
import { AmountEntryView } from "@/components/scan/AmountEntryView";
import { ConfirmView } from "@/components/scan/ConfirmView";
import { ProcessingView } from "@/components/scan/ProcessingView";
import type { ParsedQr } from "@/lib/scan-types";

type FlowState =
  | { step: "scanning"; error?: string }
  | { step: "amount-entry"; parsed: ParsedQr }
  | { step: "confirm"; parsed: ParsedQr; amountSatang: number }
  | { step: "processing"; paymentId: string; txHash: `0x${string}` };

export default function ScanPage() {
  const { ready, authenticated } = usePrivy();
  const { address } = useConnection();
  const [state, setState] = useState<FlowState>({ step: "scanning" });
  const [scanAttempt, setScanAttempt] = useState(0);

  function backToScanning(error?: string) {
    setScanAttempt((n) => n + 1);
    setState({ step: "scanning", error });
  }

  async function handleDecoded(payload: string) {
    try {
      const res = await fetch("/api/qr/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const body = await res.json();
      if (!res.ok) {
        backToScanning(body.error ?? "Could not read that QR code.");
        return;
      }
      const parsed = body as ParsedQr;
      if (parsed.amountSatang !== undefined) {
        setState({ step: "confirm", parsed, amountSatang: parsed.amountSatang });
      } else {
        setState({ step: "amount-entry", parsed });
      }
    } catch {
      backToScanning("Network error while reading the QR code.");
    }
  }

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

  if (!address) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
        <p className="text-zinc-500 dark:text-zinc-400">Loading wallet...</p>
        <Link href="/" className="text-sm underline text-zinc-500 dark:text-zinc-400">
          Back to home
        </Link>
      </div>
    );
  }

  switch (state.step) {
    case "scanning":
      return <ScannerView key={scanAttempt} onDecoded={handleDecoded} error={state.error} />;
    case "amount-entry":
      return (
        <AmountEntryView
          parsed={state.parsed}
          onSubmit={(amountSatang) => setState({ step: "confirm", parsed: state.parsed, amountSatang })}
          onCancel={() => backToScanning()}
        />
      );
    case "confirm":
      return (
        <ConfirmView
          parsed={state.parsed}
          amountSatang={state.amountSatang}
          walletAddress={address as `0x${string}`}
          onSubmitted={(paymentId, txHash) =>
            setState({ step: "processing", paymentId, txHash: txHash as `0x${string}` })
          }
          onCancel={() => backToScanning()}
        />
      );
    case "processing":
      return (
        <ProcessingView
          paymentId={state.paymentId}
          txHash={state.txHash}
          onDone={() => backToScanning()}
        />
      );
  }
}
