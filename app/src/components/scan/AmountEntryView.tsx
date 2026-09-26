"use client";

import { useState } from "react";
import type { ParsedQr } from "@/lib/scan-types";
import { maskMerchantId } from "@/lib/scan-types";

interface AmountEntryViewProps {
  parsed: ParsedQr;
  onSubmit: (amountSatang: number) => void;
  onCancel: () => void;
}

export function AmountEntryView({ parsed, onSubmit, onCancel }: AmountEntryViewProps) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number.parseFloat(amount);
    if (Number.isNaN(value) || value <= 0) {
      setError("Enter an amount greater than ฿0.");
      return;
    }
    onSubmit(Math.round(value * 100));
  }

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-10 dark:bg-black">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Paying · จ่ายให้</p>
        <p className="text-lg font-medium text-black dark:text-zinc-50">
          {parsed.merchantName ?? maskMerchantId(parsed.idType, parsed.id)}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col items-center gap-6">
        <div className="flex items-end gap-2">
          <span className="pb-2 text-3xl font-semibold text-zinc-400">฿</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            autoFocus
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-48 border-b-2 border-black/[.1] bg-transparent text-6xl font-semibold text-black outline-none dark:border-white/[.15] dark:text-zinc-50"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="mt-auto flex w-full flex-col gap-3">
          <button
            type="submit"
            className="flex h-14 items-center justify-center rounded-full bg-foreground text-lg font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-12 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
