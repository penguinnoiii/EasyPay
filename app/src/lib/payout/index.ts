import { randomBytes } from "node:crypto";

export interface PayoutRequest {
  paymentId: string;
  merchantId: string;
  thbSatang: number;
}

export interface PayoutResult {
  payoutRef: string;
}

export interface PayoutProvider {
  payout(request: PayoutRequest): Promise<PayoutResult>;
}

/**
 * Simulates a PromptPay payout with a 2-4s delay, standing in for a real
 * bank/e-money gateway integration. Swap `payoutProvider` below for a real
 * implementation of this interface when one exists.
 */
export class MockPayoutProvider implements PayoutProvider {
  async payout(_request: PayoutRequest): Promise<PayoutResult> {
    const delayMs = 2000 + Math.random() * 2000;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return { payoutRef: `DEMO-${randomBytes(4).toString("hex").toUpperCase()}` };
  }
}

export const payoutProvider: PayoutProvider = new MockPayoutProvider();
