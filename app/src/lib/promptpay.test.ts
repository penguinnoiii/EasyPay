import { describe, expect, it } from "vitest";
import { parsePromptPay } from "./promptpay";

// Fixtures generated with the reference `promptpay-qr` library (phone/national ID cases)
// or hand-assembled and CRC16/XMODEM(0xFFFF)-signed with the `crc` package (bill payment,
// bad CRC, non-THB currency), so the CRC check is verified independently of this parser.

const PHONE_STATIC = "00020101021129370016A000000677010111011300668123456785802TH530376463045D82";
const PHONE_DYNAMIC_100 = "00020101021229370016A000000677010111011300668123456785802TH53037645406100.006304BB8A";
const NATIONAL_ID = "00020101021129370016A000000677010111021312345678901235802TH53037646304EC40";
const BILL_PAYMENT =
  "00020101021230490016A00000067701011201159999999999999990206REF00153037645406250.005802TH5913Bill Merchant63044697";
const NON_THB_CURRENCY = "00020101021129370016A000000677010111011300668123456785802TH53038406304D52D";

describe("parsePromptPay", () => {
  it("parses a static phone QR", () => {
    const result = parsePromptPay(PHONE_STATIC);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.type).toBe("static");
    expect(result.data.idType).toBe("phone");
    expect(result.data.id).toBe("0812345678");
    expect(result.data.currency).toBe("THB");
    expect(result.data.amountSatang).toBeUndefined();
  });

  it("parses a dynamic phone QR with an embedded amount", () => {
    const result = parsePromptPay(PHONE_DYNAMIC_100);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.type).toBe("dynamic");
    expect(result.data.idType).toBe("phone");
    expect(result.data.id).toBe("0812345678");
    expect(result.data.amountSatang).toBe(10000);
  });

  it("parses a national ID QR", () => {
    const result = parsePromptPay(NATIONAL_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.idType).toBe("nationalId");
    expect(result.data.id).toBe("1234567890123");
  });

  it("parses a bill payment (tag 30) QR", () => {
    const result = parsePromptPay(BILL_PAYMENT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.idType).toBe("billPayment");
    expect(result.data.id).toBe("999999999999999");
    expect(result.data.amountSatang).toBe(25000);
    expect(result.data.merchantName).toBe("Bill Merchant");
  });

  it("rejects a payload with an invalid CRC", () => {
    const corrupted = PHONE_STATIC.slice(0, -1) + (PHONE_STATIC.endsWith("2") ? "3" : "2");
    const result = parsePromptPay(corrupted);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/CRC/i);
  });

  it("rejects a non-THB currency", () => {
    const result = parsePromptPay(NON_THB_CURRENCY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/currency/i);
  });

  it("rejects garbage input without guessing", () => {
    const result = parsePromptPay("not a qr payload");
    expect(result.ok).toBe(false);
  });
});
