export interface HUNowQrPayload {
  version: 1;
  card_token: string;
  venue_id?: number;
  offer_index?: number;
  tier?: "bronze" | "silver" | "gold";
  offer_title?: string;
}

export interface HUNowVoucherQrPayload {
  version: 1;
  voucher_token: string;
}

const PREFIX = "hunow:";
const VOUCHER_PREFIX = "hunow-voucher:";

export function buildMemberQrPayload(payload: HUNowQrPayload): string {
  return `${PREFIX}${JSON.stringify(payload)}`;
}

export function parseMemberQrPayload(raw: string): HUNowQrPayload | null {
  const value = raw.trim();
  if (!value.startsWith(PREFIX)) return null;

  try {
    const parsed = JSON.parse(value.slice(PREFIX.length)) as Partial<HUNowQrPayload>;
    if (!parsed || parsed.version !== 1 || typeof parsed.card_token !== "string" || !parsed.card_token.trim()) {
      return null;
    }
    return {
      version: 1,
      card_token: parsed.card_token.trim(),
      venue_id: typeof parsed.venue_id === "number" ? parsed.venue_id : undefined,
      offer_index: typeof parsed.offer_index === "number" ? parsed.offer_index : undefined,
      tier: parsed.tier === "bronze" || parsed.tier === "silver" || parsed.tier === "gold" ? parsed.tier : undefined,
      offer_title: typeof parsed.offer_title === "string" ? parsed.offer_title : undefined,
    };
  } catch {
    return null;
  }
}

export function buildVoucherQrPayload(payload: HUNowVoucherQrPayload): string {
  return `${VOUCHER_PREFIX}${JSON.stringify(payload)}`;
}

export function parseVoucherQrPayload(raw: string): HUNowVoucherQrPayload | null {
  const value = raw.trim();
  const payloadString = value.startsWith(VOUCHER_PREFIX)
    ? value.slice(VOUCHER_PREFIX.length)
    : value.startsWith(PREFIX)
      ? value.slice(PREFIX.length)
      : null;

  if (!payloadString) return null;

  try {
    const parsed = JSON.parse(payloadString) as Partial<HUNowVoucherQrPayload>;
    if (!parsed || typeof parsed.voucher_token !== "string" || !parsed.voucher_token.trim()) {
      return null;
    }
    return {
      version: 1,
      voucher_token: parsed.voucher_token.trim(),
    };
  } catch {
    return null;
  }
}
