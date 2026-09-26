// Vendored copy of packages/shared/addresses.fuji.json: Vercel's serverless
// file tracing doesn't reliably bundle files read dynamically via fs from
// outside the Next.js project root, and Turbopack's dev bundler refuses to
// statically import across that boundary either. Keep this in sync with
// packages/shared/addresses.fuji.json after each contract redeploy.
import addresses from "./addresses.fuji.json";

export const paymentRouterAddress = addresses.paymentRouter as `0x${string}`;
export const mockUsdcAddress = addresses.mockUSDC as `0x${string}`;
export const chainId = addresses.chainId as number;

export const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
