"use client";

import { useState } from "react";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

export default function MerchantPage() {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [merchantName, setMerchantName] = useState("Som Tam Stall");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setQrDataUrl(null);

    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setError("Enter a 10-digit Thai phone number, e.g. 0812345678.");
      return;
    }

    const parsedAmount = amount.trim() === "" ? undefined : Number.parseFloat(amount);
    if (parsedAmount !== undefined && (Number.isNaN(parsedAmount) || parsedAmount <= 0)) {
      setError("Amount must be a positive number, or leave it blank for a static QR.");
      return;
    }

    try {
      const payload = generatePayload(digits, { amount: parsedAmount });
      const dataUrl = await QRCode.toDataURL(payload, { width: 320, margin: 2 });
      setQrDataUrl(dataUrl);
    } catch {
      setError("Could not generate a QR for that input.");
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-8 bg-zinc-50 px-6 py-10 dark:bg-black">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Demo merchant
        </h1>
        <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
          Generate a PromptPay QR for judges to scan with the EasyPay app.
        </p>
        <p className="max-w-xs text-xs text-zinc-400 dark:text-zinc-600">สร้าง QR พร้อมเพย์สำหรับสาธิต</p>
      </div>

      <form onSubmit={handleGenerate} className="flex w-full max-w-xs flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          Merchant name (display only)
          <input
            type="text"
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            className="rounded-lg border border-black/[.1] bg-white px-3 py-2 text-black dark:border-white/[.15] dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          PromptPay phone number
          <input
            type="tel"
            required
            placeholder="0812345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-lg border border-black/[.1] bg-white px-3 py-2 text-black dark:border-white/[.15] dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          Amount in THB (optional — leave blank for a static QR)
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-lg border border-black/[.1] bg-white px-3 py-2 text-black dark:border-white/[.15] dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>

        <button
          type="submit"
          className="flex h-12 items-center justify-center rounded-full bg-foreground text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Generate QR
        </button>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {qrDataUrl && (
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`PromptPay QR for ${merchantName}`}
            width={320}
            height={320}
            className="rounded-2xl bg-white p-4"
          />
          <p className="text-center text-lg font-medium text-black dark:text-zinc-50">
            {merchantName}
            {amount.trim() !== "" && ` — ฿${amount}`}
          </p>
        </div>
      )}
    </div>
  );
}
