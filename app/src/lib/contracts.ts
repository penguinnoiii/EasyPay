import { useQuery } from "@tanstack/react-query";
import paymentRouterAbiJson from "@/lib/abi/PaymentRouter.json";
import mockUsdcAbiJson from "@/lib/abi/MockUSDC.json";
import type { Abi } from "viem";

export const paymentRouterAbi = paymentRouterAbiJson as Abi;
export const mockUsdcAbi = mockUsdcAbiJson as Abi;

export interface ContractConfig {
  chainId: number;
  paymentRouter: `0x${string}`;
  mockUSDC: `0x${string}`;
}

export function useContractConfig() {
  return useQuery<ContractConfig>({
    queryKey: ["contract-config"],
    queryFn: async () => {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Failed to load contract config");
      return res.json();
    },
    staleTime: Infinity,
  });
}
