import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Read from disk rather than a static import: packages/shared lives outside the
// Next.js project root, which Turbopack refuses to resolve as a module import.
// Resolved relative to this file (not process.cwd()) so it also works from the
// standalone listener script, which runs with a different working directory.
const thisDir = dirname(fileURLToPath(import.meta.url));
const addressesPath = join(thisDir, "..", "..", "..", "packages", "shared", "addresses.fuji.json");
const addresses = JSON.parse(readFileSync(addressesPath, "utf-8"));

export const paymentRouterAddress = addresses.paymentRouter as `0x${string}`;
export const mockUsdcAddress = addresses.mockUSDC as `0x${string}`;
export const chainId = addresses.chainId as number;

export const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
