import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { wordpress, extractOffers, formatOfferRule, getFeaturedImage, type WPEat } from "@/lib/wordpress";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const WP_SITE = (process.env.EXPO_PUBLIC_WP_API_URL ?? "https://hunow.co.uk/wp-json").replace(/\/wp-json(?:\/wp\/v2)?$/, "");
const PORTAL_URL = `${WP_SITE}/my-account/`;

const TIER_META: Record<"bronze" | "silver" | "gold", { label: string; colour: string }> = {
  bronze: { label: "Bronze", colour: "#CD7F32" },
  silver: { label: "Silver", colour: "#C0C0C0" },
  gold: { label: "Gold", colour: "#FBC900" },
};

function getVenuePublicUrl(venue: WPEat): string {
  return `${WP_SITE}/eat/${venue.slug}/`;
}

export default function BusinessOffersScreen() {
  const { user } = useAuth();
  const [venue, setVenue] = useState<WPEat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user?.venue_id) {
        setLoading(false);
        return;
      }

      try {
        const data = await wordpress.getEatById(user.venue_id);
        setVenue(data);
      } catch {
        setVenue(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user?.venue_id]);

  const standardOffers = useMemo(() => (venue ? extractOffers(venue) : []), [venue]);
  const tierOffers = useMemo(() => venue?.tier_offers ?? [], [venue]);
  const liveOfferCount = standardOffers.length + tierOffers.length;
  const heroImage = venue ? getFeaturedImage(venue) : null;

  async function openUrl(url: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Linking.openURL(url);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: NAV, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={YELLOW} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
            Venue Rewards
          </Text>
          <Text style={{ color: "white", fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginBottom: 8 }}>
            Offers
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.52)", fontSize: 14, lineHeight: 20 }}>
            Review the offers currently live for your venue and jump to the web portal to update them.
          </Text>
        </View>

        {!user?.venue_id ? (
          <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 22, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: YELLOW + "22", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Ionicons name="link-outline" size={20} color={YELLOW} />
            </View>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 6 }}>Venue not linked yet</Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 19, marginBottom: 18 }}>
              Your business account needs to be linked to a WordPress venue listing before offers can be managed or redeemed.
            </Text>
            <TouchableOpacity
              onPress={() => openUrl(PORTAL_URL)}
              style={{ backgroundColor: YELLOW, borderRadius: 16, paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: NAV, fontWeight: "800", fontSize: 14 }}>Open Business Portal</Text>
            </TouchableOpacity>
          </View>
        ) : venue ? (
          <>
            <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 18 }}>
              <View style={{ height: 150, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center" }}>
                {heroImage ? <Image source={{ uri: heroImage }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }} resizeMode="cover" /> : null}
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,0,50,0.55)" }} />
                <View style={{ position: "absolute", left: 18, right: 18, bottom: 18 }}>
                  <Text style={{ color: "rgba(255,255,255,0.48)", fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>
                    Linked Venue
                  </Text>
                  <Text style={{ color: "white", fontSize: 24, fontWeight: "900", marginBottom: 10 }}>
                    {venue.title.rendered.replace(/&amp;/g, "&")}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    <View style={{ backgroundColor: YELLOW, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ color: NAV, fontSize: 11, fontWeight: "800" }}>{liveOfferCount} live rewards</Text>
                    </View>
                    <View style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>Post ID {user.venue_id}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={{ padding: 16, flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => openUrl(PORTAL_URL)}
                  style={{ flex: 1, backgroundColor: YELLOW, borderRadius: 16, paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ color: NAV, fontWeight: "800", fontSize: 14 }}>Manage in Portal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openUrl(getVenuePublicUrl(venue))}
                  style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
                >
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>View Live Page</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 22 }}>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>
                  Standard
                </Text>
                <Text style={{ color: "white", fontSize: 24, fontWeight: "900" }}>{standardOffers.length}</Text>
                <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, marginTop: 4 }}>Offers for every member</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>
                  Tier
                </Text>
                <Text style={{ color: "white", fontSize: 24, fontWeight: "900" }}>{tierOffers.length}</Text>
                <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, marginTop: 4 }}>Bronze, Silver, Gold rewards</Text>
              </View>
            </View>

            <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 10 }}>Standard Offers</Text>
            {standardOffers.length === 0 ? (
              <View style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 22 }}>
                <Text style={{ color: "white", fontWeight: "700", marginBottom: 4 }}>No standard offers live</Text>
                <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, lineHeight: 19 }}>
                  Add your first standard offer in the venue portal and it will appear here automatically.
                </Text>
              </View>
            ) : (
              <View style={{ marginBottom: 22 }}>
                {standardOffers.map((offer) => (
                  <View key={offer.id} style={{ backgroundColor: "white", borderRadius: 18, padding: 16, marginBottom: 10 }}>
                    <View style={{ alignSelf: "flex-start", backgroundColor: YELLOW + "22", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, marginBottom: 10 }}>
                      <Text style={{ color: NAV, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }}>STANDARD</Text>
                    </View>
                    <Text style={{ color: NAV, fontSize: 16, fontWeight: "800", marginBottom: 6 }}>{offer.title}</Text>
                    {offer.description ? (
                      <Text style={{ color: "rgba(15,0,50,0.55)", fontSize: 13, lineHeight: 19, marginBottom: 10 }}>
                        {offer.description}
                      </Text>
                    ) : null}
                    <Text style={{ color: "rgba(15,0,50,0.48)", fontSize: 12, fontWeight: "700" }}>
                      {formatOfferRule(offer.limit_count, offer.limit_period)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 10 }}>Tier Offers</Text>
            {tierOffers.length === 0 ? (
              <View style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ color: "white", fontWeight: "700", marginBottom: 4 }}>No tier rewards live</Text>
                <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, lineHeight: 19 }}>
                  Bronze, Silver, and Gold rewards are optional. Add them in the portal whenever you’re ready.
                </Text>
              </View>
            ) : (
              tierOffers.map((offer) => {
                const meta = TIER_META[offer.tier];
                return (
                  <View
                    key={offer.tier}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderRadius: 18,
                      padding: 16,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: meta.colour + "55",
                    }}
                  >
                    <View style={{ alignSelf: "flex-start", backgroundColor: meta.colour + "22", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, marginBottom: 10 }}>
                      <Text style={{ color: meta.colour, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }}>{meta.label.toUpperCase()}</Text>
                    </View>
                    <Text style={{ color: "white", fontSize: 16, fontWeight: "800", marginBottom: 6 }}>{offer.title}</Text>
                    {offer.description ? (
                      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 19, marginBottom: 10 }}>
                        {offer.description}
                      </Text>
                    ) : null}
                    <Text style={{ color: meta.colour, fontSize: 12, fontWeight: "700" }}>
                      {formatOfferRule(offer.limit_count, offer.limit_period)}
                    </Text>
                  </View>
                );
              })
            )}
          </>
        ) : (
          <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 22, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 6 }}>Couldn’t load venue details</Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 19, marginBottom: 18 }}>
              Your business account is linked, but the venue record could not be loaded right now.
            </Text>
            <TouchableOpacity
              onPress={() => openUrl(PORTAL_URL)}
              style={{ backgroundColor: YELLOW, borderRadius: 16, paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: NAV, fontWeight: "800", fontSize: 14 }}>Open Business Portal</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
