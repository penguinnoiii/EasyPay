// THB pricing for AVAX and USDC, with a short cache and a hardcoded fallback
// so quoting keeps working if CoinGecko is slow, rate-limited, or unreachable.

export type TokenSymbol = "AVAX" | "USDC";

const COINGECKO_IDS: Record<TokenSymbol, string> = {
  AVAX: "avalanche-2",
  USDC: "usd-coin",
};

const TOKEN_DECIMALS: Record<TokenSymbol, number> = {
  AVAX: 18,
  USDC: 6,
};

const CACHE_TTL_MS = 30_000;
// Rate scaled by 1e8 to keep price-to-token-amount math in exact integers (no floats on money).
const PRICE_PRECISION = BigInt(100_000_000);

export type RateSource = "coingecko" | "fallback";

interface RatesResult {
  avaxThb: number;
  usdcThb: number;
  source: RateSource;
}

let cache: { avaxThb: number; usdcThb: number; fetchedAt: number } | null = null;

function fallbackRates(): { avaxThb: number; usdcThb: number } {
  return {
    avaxThb: Number(process.env.FALLBACK_AVAX_THB ?? "650"),
    usdcThb: Number(process.env.FALLBACK_USDC_THB ?? "36.5"),
  };
}

export async function getRates(): Promise<RatesResult> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { avaxThb: cache.avaxThb, usdcThb: cache.usdcThb, source: "coingecko" };
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS.AVAX},${COINGECKO_IDS.USDC}&vs_currencies=thb`;
    const headers: Record<string, string> = {};
    if (process.env.COINGECKO_API_KEY) {
      headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
    }
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);
    const data = await res.json();
    const avaxThb = data[COINGECKO_IDS.AVAX]?.thb;
    const usdcThb = data[COINGECKO_IDS.USDC]?.thb;
    if (typeof avaxThb !== "number" || typeof usdcThb !== "number") {
      throw new Error("Malformed CoinGecko response");
    }
    cache = { avaxThb, usdcThb, fetchedAt: now };
    return { avaxThb, usdcThb, source: "coingecko" };
  } catch {
    return { ...fallbackRates(), source: "fallback" };
  }
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - BigInt(1)) / b;
}

/**
 * Fee policy in one place so tiering (e.g. 100bps above ฿1,000, 300bps below ฿50)
 * can be added later without touching call sites.
 */
export function getFeeBps(_thbSatang: number): number {
  return Number(process.env.DEFAULT_FEE_BPS ?? "150");
}

export interface QuoteAmounts {
  feeBps: number;
  feeSatang: number;
  totalThbSatang: number;
  tokenAmount: bigint;
  rateUsed: number;
  rateSource: RateSource;
}

export async function computeQuoteAmounts(thbSatang: number, token: TokenSymbol): Promise<QuoteAmounts> {
  const feeBps = getFeeBps(thbSatang);
  const feeSatang = Number(ceilDiv(BigInt(thbSatang) * BigInt(feeBps), BigInt(10_000)));
  const totalThbSatang = thbSatang + feeSatang;

  const { avaxThb, usdcThb, source } = await getRates();
  const rate = token === "AVAX" ? avaxThb : usdcThb;
  const scaledRate = BigInt(Math.round(rate * Number(PRICE_PRECISION)));
  const decimals = TOKEN_DECIMALS[token];

  const numerator = BigInt(totalThbSatang) * BigInt(10) ** BigInt(decimals) * PRICE_PRECISION;
  const denominator = BigInt(100) * scaledRate;
  const tokenAmount = ceilDiv(numerator, denominator);

  return { feeBps, feeSatang, totalThbSatang, tokenAmount, rateUsed: rate, rateSource: source };
}
