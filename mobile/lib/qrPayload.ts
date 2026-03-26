export interface HUNowQrPayload {
  version: 1;
  card_token: string;
  venue_id?: number;
  offer_index?: number;
  tier?: "bronze" | "silver" | "gold";
  offer_title?: string;
}

const PREFIX = "hunow:";

export function buildMemberQrPayload(payload: HUNowQrPayload): string {
  return `${PREFIX}${JSON.stringify(payload)}`;
}

export function parseMemberQrPayload(raw: string): HUNowQrPayload | null {
  if (!raw.startsWith(PREFIX)) return null;

  try {
    const parsed = JSON.parse(raw.slice(PREFIX.length)) as Partial<HUNowQrPayload>;
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
