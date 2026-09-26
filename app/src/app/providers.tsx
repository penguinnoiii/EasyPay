"use client";

import { useEffect } from "react";
import { PrivyProvider, useWallets } from "@privy-io/react-auth";
import { WagmiProvider, createConfig, useSetActiveWallet } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { avalancheFuji } from "viem/chains";

const wagmiConfig = createConfig({
  chains: [avalancheFuji],
  transports: {
    [avalancheFuji.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
});

const queryClient = new QueryClient();

function ActiveWalletSync() {
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();

  useEffect(() => {
    if (wallets.length === 0) return;
    // Prefer a connected external wallet (MetaMask, Core, etc.) over the embedded
    // one, since a user who explicitly connected their own wallet wants to pay from it.
    const externalWallet = wallets.find(
      (wallet) => wallet.walletClientType !== "privy" && wallet.walletClientType !== "privy-v2",
    );
    setActiveWallet(externalWallet ?? wallets[0]);
  }, [wallets, setActiveWallet]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_WALLET_APP_ID ?? ""}
      config={{
        loginMethods: ["google", "email", "wallet"],
        defaultChain: avalancheFuji,
        supportedChains: [avalancheFuji],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        appearance: {
          theme: "dark",
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <ActiveWalletSync />
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
