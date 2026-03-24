import { Router, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const redeemRouter = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WP_BASE = process.env.WP_API_URL ?? "https://hunow.co.uk/wp-json";

/** Get a WP JWT token for the service account */
async function getWPToken(): Promise<string | null> {
  const username = process.env.WP_SERVICE_USERNAME;
  const password = process.env.WP_SERVICE_PASSWORD;
  if (!username || !password) return null;

  try {
    const res = await fetch(`${WP_BASE}/jwt-auth/v1/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { token: string };
    return data.token;
  } catch {
    return null;
  }
}

/** Award points to a WP user via HU NOW API */
async function awardPoints(wpUserId: number, action: string, points: number, token: string): Promise<void> {
  try {
    await fetch(`${WP_BASE}/hunow/v1/points/award`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: wpUserId, action, points }),
    });
  } catch {
    // Non-critical — log but don't fail the redemption
    console.error("Failed to award WP points");
  }
}

redeemRouter.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const { card_id, offer_title, offer_index, business_id, wp_post_id } = req.body;

  if (!card_id || !offer_title || !business_id) {
    res.status(400).json({ message: "card_id, offer_title, and business_id are required" });
    return;
  }

  // Verify the business belongs to the authenticated user
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("id, wp_post_id")
    .eq("id", business_id)
    .eq("user_id", req.userId!)
    .single();

  if (bizError || !business) {
    res.status(403).json({ message: "Not authorised to redeem for this business" });
    return;
  }

  // Verify the card exists
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, user_id")
    .eq("id", card_id)
    .single();

  if (cardError || !card) {
    res.status(404).json({ message: "Card not found" });
    return;
  }

  // Check if this offer was already redeemed today (basic duplicate guard)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: todayRedemptions } = await supabase
    .from("redemptions")
    .select("id")
    .eq("card_id", card_id)
    .eq("business_id", business_id)
    .eq("offer_title", offer_title)
    .gte("redeemed_at", today.toISOString());

  if (todayRedemptions && todayRedemptions.length > 0) {
    res.status(400).json({ message: "This offer has already been redeemed today on this card" });
    return;
  }

  // Record the redemption in Supabase
  const { error: insertError } = await supabase.from("redemptions").insert({
    card_id,
    business_id,
    offer_title,
    offer_index: offer_index ?? null,
    wp_post_id: wp_post_id ?? business.wp_post_id ?? null,
    redeemed_by: req.userId!,
  });

  if (insertError) {
    console.error("Redemption insert error:", insertError);
    res.status(500).json({ message: "Failed to record redemption" });
    return;
  }

  // Award WP points asynchronously (non-blocking)
  getWPToken().then((token) => {
    if (token) {
      // Award scan points (10pts) + redemption points (25pts) = 35pts total
      awardPoints(0, "offer_redeemed", 35, token); // TODO: resolve WP user ID from card
    }
  });

  res.json({
    success: true,
    message: "Offer redeemed successfully",
    points_awarded: 35,
  });
});
