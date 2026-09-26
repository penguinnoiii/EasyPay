export type PromptPayIdType = "phone" | "nationalId" | "ewallet" | "billPayment";

export interface ParsedQr {
  type: "static" | "dynamic";
  idType: PromptPayIdType;
  id: string;
  amountSatang?: number;
  merchantName?: string;
  currency: "THB";
  raw: string;
}

export type TokenSymbol = "AVAX" | "USDC";

export interface QuoteResponse {
  paymentId: string;
  quote: {
    quoteId: `0x${string}`;
    payer: `0x${string}`;
    token: `0x${string}`;
    tokenAmount: string;
    thbSatang: number;
    feeBps: number;
    merchantHash: `0x${string}`;
    expiry: number;
  };
  signature: `0x${string}`;
  breakdown: {
    merchantName?: string;
    thbSatang: number;
    feeSatang: number;
    totalThbSatang: number;
    tokenAmount: string;
    rateUsed: number;
    rateSource: "coingecko" | "fallback";
    expiresAt: number;
  };
}

export function maskMerchantId(idType: PromptPayIdType | undefined, id: string): string {
  if ((idType === "phone" || idType === undefined) && id.length === 10) {
    return `${id.slice(0, 3)}x-xxx-${id.slice(-4)}`;
  }
  if (id.length > 6) {
    return `${id.slice(0, 3)}${"x".repeat(id.length - 6)}${id.slice(-3)}`;
  }
  return id;
}

export function formatThb(satang: number): string {
  return (satang / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
