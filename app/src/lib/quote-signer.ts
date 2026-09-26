import { keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainId, paymentRouterAddress } from "@/lib/addresses";

const account = privateKeyToAccount(process.env.QUOTE_SIGNER_PRIVATE_KEY as Hex);

export const quoteSignerAddress = account.address;

const domain = {
  name: "PaymentRouter",
  version: "1",
  chainId,
  verifyingContract: paymentRouterAddress,
} as const;

const types = {
  Quote: [
    { name: "quoteId", type: "bytes32" },
    { name: "payer", type: "address" },
    { name: "token", type: "address" },
    { name: "tokenAmount", type: "uint256" },
    { name: "thbSatang", type: "uint256" },
    { name: "feeBps", type: "uint16" },
    { name: "merchantHash", type: "bytes32" },
    { name: "expiry", type: "uint64" },
  ],
} as const;

export interface Quote {
  quoteId: Hex;
  payer: Hex;
  token: Hex;
  tokenAmount: bigint;
  thbSatang: bigint;
  feeBps: number;
  merchantHash: Hex;
  expiry: bigint;
}

export async function signQuote(quote: Quote): Promise<Hex> {
  return account.signTypedData({
    domain,
    types,
    primaryType: "Quote",
    message: quote,
  });
}

/** Deterministic merchant hash from a normalized PromptPay identifier. */
export function computeMerchantHash(idType: string, id: string): Hex {
  return keccak256(toBytes(`${idType}:${id}`));
}
