import { useQuery } from "@tanstack/react-query";

export interface RatesResponse {
  avaxThb: number;
  usdcThb: number;
  source: "coingecko" | "fallback";
}

export function useRates() {
  return useQuery<RatesResponse>({
    queryKey: ["rates"],
    queryFn: async () => {
      const res = await fetch("/api/rates");
      if (!res.ok) throw new Error("Failed to load rates");
      return res.json();
    },
    refetchInterval: 30_000,
  });
}
