export type PaymentStatus = "QUOTED" | "SUBMITTED" | "CONFIRMED" | "PAID_OUT" | "EXPIRED" | "FAILED";

export interface PaymentRecord {
  id: string;
  quoteId: string;
  token: string;
  tokenAmount: string;
  thbSatang: number;
  feeBps: number;
  feeSatang: number;
  merchantId: string;
  merchantName: string | null;
  rateUsed: number;
  expiry: string;
  status: PaymentStatus;
  txHash: string | null;
  payoutRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_LABELS: Record<PaymentStatus, string> = {
  QUOTED: "Quoted",
  SUBMITTED: "Submitted",
  CONFIRMED: "Confirmed",
  PAID_OUT: "Paid out",
  EXPIRED: "Expired",
  FAILED: "Failed",
};

export const STATUS_COLORS: Record<PaymentStatus, string> = {
  QUOTED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  PAID_OUT: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  EXPIRED: "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};
