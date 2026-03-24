import { Router, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const redeemRouter = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

redeemRouter.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const { card_id, offer_id, business_id } = req.body;

  if (!card_id || !offer_id || !business_id) {
    res.status(400).json({ message: "card_id, offer_id, and business_id are required" });
    return;
  }

  // Verify the business belongs to the authenticated user
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", business_id)
    .eq("user_id", req.userId!)
    .single();

  if (bizError || !business) {
    res.status(403).json({ message: "Not authorised to redeem for this business" });
    return;
  }

  // Fetch the offer
  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select("id, redemption_type, is_active, business_id")
    .eq("id", offer_id)
    .eq("business_id", business_id)
    .single();

  if (offerError || !offer) {
    res.status(404).json({ message: "Offer not found" });
    return;
  }

  if (!offer.is_active) {
    res.status(400).json({ message: "This offer is no longer active" });
    return;
  }

  // Check redemption eligibility
  const eligible = await checkEligibility(card_id, offer_id, offer.redemption_type);
  if (!eligible.ok) {
    res.status(400).json({ message: eligible.message });
    return;
  }

  // Record the redemption
  const { error: insertError } = await supabase.from("redemptions").insert({
    card_id,
    offer_id,
    business_id,
    redeemed_by: req.userId!,
  });

  if (insertError) {
    console.error("Redemption insert error:", insertError);
    res.status(500).json({ message: "Failed to record redemption" });
    return;
  }

  res.json({ success: true, message: "Offer redeemed successfully" });
});

async function checkEligibility(
  cardId: string,
  offerId: string,
  redemptionType: string
): Promise<{ ok: boolean; message?: string }> {
  if (redemptionType === "unlimited") return { ok: true };

  const { data: existing } = await supabase
    .from("redemptions")
    .select("redeemed_at")
    .eq("card_id", cardId)
    .eq("offer_id", offerId)
    .order("redeemed_at", { ascending: false })
    .limit(1);

  if (!existing || existing.length === 0) return { ok: true };

  if (redemptionType === "one_time") {
    return { ok: false, message: "This offer has already been redeemed on this card" };
  }

  const last = new Date(existing[0].redeemed_at);
  const now = new Date();

  if (redemptionType === "once_per_day") {
    const sameDay = last.toDateString() === now.toDateString();
    if (sameDay) return { ok: false, message: "This offer can only be redeemed once per day" };
  }

  if (redemptionType === "once_per_week") {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    if (now.getTime() - last.getTime() < msPerWeek) {
      return { ok: false, message: "This offer can only be redeemed once per week" };
    }
  }

  if (redemptionType === "once_per_month") {
    const sameMonth = last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear();
    if (sameMonth) return { ok: false, message: "This offer can only be redeemed once per month" };
  }

  return { ok: true };
}
