import { NextResponse } from "next/server";
import { chainId, mockUsdcAddress, paymentRouterAddress } from "@/lib/addresses";

export async function GET() {
  return NextResponse.json({
    chainId,
    paymentRouter: paymentRouterAddress,
    mockUSDC: mockUsdcAddress,
  });
}
