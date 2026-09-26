// Thai QR Payment (PromptPay) parser — EMVCo TLV format.
// Spec references: EMVCo QR Code Specification, Bank of Thailand Thai QR Payment Standard.

export type PromptPayType = "static" | "dynamic";
export type PromptPayIdType = "phone" | "nationalId" | "ewallet" | "billPayment";

export interface ParsedPromptPay {
  type: PromptPayType;
  idType: PromptPayIdType;
  id: string;
  amountSatang?: number;
  merchantName?: string;
  currency: "THB";
  raw: string;
}

export type ParsePromptPayResult =
  | { ok: true; data: ParsedPromptPay }
  | { ok: false; error: string };

const TAG_PAYLOAD_FORMAT = "00";
const TAG_POI_METHOD = "01";
const TAG_MERCHANT_ACCOUNT_TRANSFER = "29";
const TAG_MERCHANT_ACCOUNT_BILL_PAYMENT = "30";
const TAG_CURRENCY = "53";
const TAG_AMOUNT = "54";
const TAG_COUNTRY_CODE = "58";
const TAG_MERCHANT_NAME = "59";
const TAG_CRC = "63";

const POI_STATIC = "11";
const POI_DYNAMIC = "12";
const CURRENCY_THB = "764";

const SUBTAG_PHONE = "01";
const SUBTAG_NATIONAL_ID = "02";
const SUBTAG_EWALLET = "03";
const SUBTAG_BILLER_ID = "01";

interface TlvEntry {
  tag: string;
  value: string;
}

function parseTlv(payload: string): TlvEntry[] | null {
  const entries: TlvEntry[] = [];
  let i = 0;
  while (i < payload.length) {
    if (i + 4 > payload.length) return null;
    const tag = payload.slice(i, i + 2);
    const lenStr = payload.slice(i + 2, i + 4);
    const len = Number.parseInt(lenStr, 10);
    if (!/^\d{2}$/.test(lenStr) || Number.isNaN(len)) return null;
    const valueStart = i + 4;
    const valueEnd = valueStart + len;
    if (valueEnd > payload.length) return null;
    entries.push({ tag, value: payload.slice(valueStart, valueEnd) });
    i = valueEnd;
  }
  return entries;
}

function findTag(entries: TlvEntry[], tag: string): string | undefined {
  return entries.find((e) => e.tag === tag)?.value;
}

/** CRC16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, xorout 0. */
function crc16ccitt(input: string): number {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function thbStringToSatang(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [intPart, fracPartRaw = ""] = value.split(".");
  const fracPart = (fracPartRaw + "00").slice(0, 2);
  return Number.parseInt(intPart, 10) * 100 + Number.parseInt(fracPart, 10);
}

function normalizePhone(subTagValue: string): string {
  // Encoded as 13 digits: leading zeros + "66" + 9-digit number (no leading 0).
  const digits = subTagValue.replace(/\D/g, "");
  const trimmed = digits.replace(/^0+/, "");
  if (trimmed.startsWith("66") && trimmed.length === 11) {
    return `0${trimmed.slice(2)}`;
  }
  return digits;
}

export function parsePromptPay(payload: string): ParsePromptPayResult {
  if (typeof payload !== "string" || payload.length < 8) {
    return { ok: false, error: "Payload too short to be a valid PromptPay QR." };
  }

  const crcHeader = payload.slice(-8, -4);
  const providedCrc = payload.slice(-4).toUpperCase();
  if (crcHeader !== `${TAG_CRC}04`) {
    return { ok: false, error: "Missing or malformed CRC field (tag 63)." };
  }
  const dataForCrc = payload.slice(0, -4);
  const computedCrc = crc16ccitt(dataForCrc).toString(16).toUpperCase().padStart(4, "0");
  if (computedCrc !== providedCrc) {
    return { ok: false, error: "CRC checksum mismatch — QR payload is corrupted or invalid." };
  }

  const entries = parseTlv(payload);
  if (!entries) {
    return { ok: false, error: "Malformed TLV structure." };
  }

  const payloadFormat = findTag(entries, TAG_PAYLOAD_FORMAT);
  if (payloadFormat !== "01") {
    return { ok: false, error: "Unsupported payload format indicator." };
  }

  const poiMethod = findTag(entries, TAG_POI_METHOD);
  let type: PromptPayType;
  if (poiMethod === POI_STATIC) {
    type = "static";
  } else if (poiMethod === POI_DYNAMIC) {
    type = "dynamic";
  } else {
    return { ok: false, error: "Unsupported or missing point-of-initiation method (tag 01)." };
  }

  const currencyTag = findTag(entries, TAG_CURRENCY);
  if (currencyTag !== CURRENCY_THB) {
    return { ok: false, error: `Unsupported currency (expected THB/764, got ${currencyTag ?? "none"}).` };
  }

  const countryCode = findTag(entries, TAG_COUNTRY_CODE);
  if (countryCode !== undefined && countryCode !== "TH") {
    return { ok: false, error: `Unsupported country code (expected TH, got ${countryCode}).` };
  }

  let idType: PromptPayIdType;
  let id: string;

  const transferInfo = findTag(entries, TAG_MERCHANT_ACCOUNT_TRANSFER);
  const billPaymentInfo = findTag(entries, TAG_MERCHANT_ACCOUNT_BILL_PAYMENT);

  if (transferInfo !== undefined) {
    const subEntries = parseTlv(transferInfo);
    if (!subEntries) {
      return { ok: false, error: "Malformed merchant account info (tag 29)." };
    }
    const phone = findTag(subEntries, SUBTAG_PHONE);
    const nationalId = findTag(subEntries, SUBTAG_NATIONAL_ID);
    const ewallet = findTag(subEntries, SUBTAG_EWALLET);
    if (phone !== undefined) {
      idType = "phone";
      id = normalizePhone(phone);
    } else if (nationalId !== undefined) {
      idType = "nationalId";
      id = nationalId;
    } else if (ewallet !== undefined) {
      idType = "ewallet";
      id = ewallet;
    } else {
      return { ok: false, error: "Unsupported PromptPay identifier type in tag 29." };
    }
  } else if (billPaymentInfo !== undefined) {
    const subEntries = parseTlv(billPaymentInfo);
    if (!subEntries) {
      return { ok: false, error: "Malformed bill payment info (tag 30)." };
    }
    const billerId = findTag(subEntries, SUBTAG_BILLER_ID);
    if (billerId === undefined) {
      return { ok: false, error: "Missing biller ID in bill payment info (tag 30)." };
    }
    idType = "billPayment";
    id = billerId;
  } else {
    return { ok: false, error: "No PromptPay merchant account info found (expected tag 29 or 30)." };
  }

  let amountSatang: number | undefined;
  const amountTag = findTag(entries, TAG_AMOUNT);
  if (amountTag !== undefined) {
    const parsed = thbStringToSatang(amountTag);
    if (parsed === null) {
      return { ok: false, error: "Malformed transaction amount (tag 54)." };
    }
    amountSatang = parsed;
  }

  const merchantName = findTag(entries, TAG_MERCHANT_NAME);

  return {
    ok: true,
    data: {
      type,
      idType,
      id,
      amountSatang,
      merchantName,
      currency: "THB",
      raw: payload,
    },
  };
}
