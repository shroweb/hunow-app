import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Linking, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import * as Brightness from "expo-brightness";
import Animated, {
  useSharedValue, withSpring, withSequence, withTiming, useAnimatedStyle,
} from "react-native-reanimated";
import { wordpress, getFeaturedImage, extractOffers, formatOfferRule, type WPEat, type WPOffer } from "@/lib/wordpress";
import { fetchOfferStatuses, type OfferStatus } from "@/lib/wpAuth";
import { decodeHtml, stripHtml, getDisplayAddress } from "@/lib/utils";
import { getExpiryBadgeLabel } from "@/lib/offerExpiry";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/Skeleton";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const AMBER = "#F59E0B";
const TIER_CONFIG: Record<string, { min: number; label: string; colour: string; icon: keyof typeof Ionicons.glyphMap; accent: string }> = {
  bronze: { min: 200, label: "Bronze", colour: "#CD7F32", icon: "medal-outline", accent: "#F1D2B5" },
  silver: { min: 600, label: "Silver", colour: "#C0C0C0", icon: "diamond-outline", accent: "#ECEEF3" },
  gold: { min: 1400, label: "Gold", colour: "#FBC900", icon: "trophy-outline", accent: "#FFF0A6" },
};

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, token } = useAuth();
  const [venue, setVenue] = useState<WPEat | null>(null);
  const [offers, setOffers] = useState<WPOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const [qrModalOffer, setQrModalOffer] = useState<WPOffer | null>(null);
  const [offerStatuses, setOfferStatuses] = useState<{ standard: Record<number, OfferStatus>; tier: Record<string, OfferStatus> }>({ standard: {}, tier: {} });
  const savedBrightness = useRef<number | null>(null);

  // Favourite heart animation
  const heartScale = useSharedValue(1);
  // QR modal reveal animation
  const qrRevealScale = useSharedValue(0.7);
  const qrRevealOpacity = useSharedValue(0);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setStatusLoading(!!token);
      const [wpVenue, statusData] = await Promise.all([
        wordpress.getEatById(Number(id)).catch(() => null),
        token ? fetchOfferStatuses(Number(id), token).catch(() => null) : Promise.resolve(null),
      ]);
      setVenue(wpVenue);
      if (wpVenue) setOffers(extractOffers(wpVenue));
      if (statusData) {
        setOfferStatuses({
          standard: Object.fromEntries((statusData.standard ?? []).map((s) => [s.offer_index ?? 0, s])),
          tier: Object.fromEntries((statusData.tier ?? []).map((s) => [s.tier ?? "", s])),
        });
      }
      setStatusLoading(false);
      setLoading(false);
    }
    load();
  }, [id, token]);

  // Load real favourite state from WP
  useEffect(() => {
    if (!token || !id) return;
    wordpress.getFavourites(token).then((favs) => {
      setIsFavourite(favs.some((f: { post_id: number }) => f.post_id === Number(id)));
    }).catch(() => {});
  }, [id, token]);

  // Brightness: max on QR modal open, restore on close
  useEffect(() => {
    if (qrModalOffer) {
      Brightness.getBrightnessAsync().then((b) => {
        savedBrightness.current = b;
        Brightness.setBrightnessAsync(1.0).catch(() => {});
      }).catch(() => {});
      // Animate QR card in
      qrRevealScale.value = withSpring(1, { damping: 14, stiffness: 180 });
      qrRevealOpacity.value = withTiming(1, { duration: 300 });
    } else {
      if (savedBrightness.current !== null) {
        Brightness.setBrightnessAsync(savedBrightness.current).catch(() => {});
        savedBrightness.current = null;
      }
      qrRevealScale.value = 0.7;
      qrRevealOpacity.value = 0;
    }
  }, [qrModalOffer]);

  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const qrRevealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: qrRevealScale.value }],
    opacity: qrRevealOpacity.value,
  }));

  async function handleFavouriteToggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    heartScale.value = withSequence(
      withSpring(1.35, { damping: 6, stiffness: 300 }),
      withSpring(1, { damping: 8, stiffness: 200 }),
    );
    const newState = !isFavourite;
    setIsFavourite(newState);
    if (!token) return;
    try {
      if (newState) {
        await wordpress.addFavourite(Number(id), token);
      } else {
        await wordpress.removeFavourite(Number(id), token);
      }
    } catch {
      setIsFavourite(!newState); // revert on failure
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: NAV }}>
        <Skeleton width="100%" height={240} borderRadius={0} />
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton width={220} height={28} borderRadius={8} />
          <Skeleton width={300} height={14} borderRadius={6} />
          <Skeleton width={260} height={14} borderRadius={6} />
        </View>
      </View>
    );
  }

  if (!venue) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NAV, paddingHorizontal: 20 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="chevron-back" size={20} color="white" />
          <Text style={{ color: "white", fontSize: 14, marginLeft: 4 }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, textAlign: "center", marginTop: 80 }}>Venue not found</Text>
      </SafeAreaView>
    );
  }

  const img = getFeaturedImage(venue);
  const ctaUrl = venue.acf?.offer_cta_url as string | undefined;
  const ctaText = venue.acf?.offer_cta_text as string | undefined;
  const venueName = decodeHtml(venue.title.rendered);
  const locationText = getDisplayAddress(venue.acf?.address);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Hero Image */}
        <View style={{ position: "relative" }}>
          {img ? (
            <Image source={{ uri: img }} style={{ width: "100%", height: 240 }} resizeMode="cover" />
          ) : (
            <View style={{ width: "100%", height: 240, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="storefront-outline" size={56} color="rgba(255,255,255,0.12)" />
            </View>
          )}

          {/* Back button */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            style={{
              position: "absolute", top: 16, left: 16,
              backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 20,
              width: 36, height: 36, alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={20} color="white" />
          </TouchableOpacity>

          {/* Animated Favourite button */}
          <TouchableOpacity
            onPress={handleFavouriteToggle}
            style={{
              position: "absolute", top: 16, right: 16,
              backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 20,
              width: 36, height: 36, alignItems: "center", justifyContent: "center",
            }}
          >
            <Animated.View style={heartAnimStyle}>
              <Ionicons
                name={isFavourite ? "heart" : "heart-outline"}
                size={20}
                color={isFavourite ? "#FF4D6D" : "white"}
              />
            </Animated.View>
          </TouchableOpacity>

          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 108, backgroundColor: "rgba(15,0,50,0.58)" }} />
          <View style={{ position: "absolute", left: 20, right: 20, bottom: 28 }}>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.5, marginBottom: locationText ? 8 : 0 }}>
              {venueName}
            </Text>
            {locationText ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Ionicons name="location-outline" size={14} color={YELLOW} />
                <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "600", flex: 1 }}>
                  {locationText}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          {venue.excerpt?.rendered ? (
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
              {stripHtml(venue.excerpt.rendered)}
            </Text>
          ) : null}

          {/* Contact */}
          {(venue.acf?.phone || venue.acf?.website) && (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16,
              marginBottom: 16, gap: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            }}>
              {venue.acf?.phone && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                  onPress={() => Linking.openURL(`tel:${venue.acf!.phone}`)}
                >
                  <View style={{ backgroundColor: YELLOW + "22", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="call-outline" size={18} color={YELLOW} />
                  </View>
                  <Text style={{ color: "white", fontSize: 14, fontWeight: "500" }}>{venue.acf.phone as string}</Text>
                </TouchableOpacity>
              )}
              {venue.acf?.website && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                  onPress={() => Linking.openURL(venue.acf!.website as string)}
                >
                  <View style={{ backgroundColor: YELLOW + "22", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="globe-outline" size={18} color={YELLOW} />
                  </View>
                  <Text style={{ color: "white", fontSize: 14, fontWeight: "500" }} numberOfLines={1}>{venue.acf.website as string}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Opening Hours */}
          {venue.acf?.opening_hours && (venue.acf.opening_hours as any[]).length > 0 && (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16,
              marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            }}>
              <Text style={{ color: "white", fontWeight: "800", fontSize: 14, marginBottom: 12 }}>Opening Hours</Text>
              {(venue.acf.opening_hours as { day: string; hours: string }[]).map((h, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{h.day}</Text>
                  <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>{h.hours}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Tier Offers ── */}
          {venue.tier_offers && venue.tier_offers.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: "white", fontWeight: "800", fontSize: 20, marginBottom: 4 }}>Member Tier Offers</Text>
                    <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, lineHeight: 18 }}>
                      Exclusive rewards that unlock as your HU NOW points grow
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <View style={{ backgroundColor: YELLOW + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" }}>
                      <Text style={{ color: YELLOW, fontSize: 11, fontWeight: "800" }}>{user?.points ?? 0} pts</Text>
                    </View>
                    {statusLoading && (
                      <Text style={{ color: "rgba(255,255,255,0.32)", fontSize: 10, fontWeight: "700" }}>Checking status…</Text>
                    )}
                  </View>
                </View>
              </View>
              {venue.tier_offers.map((to) => {
                const cfg = TIER_CONFIG[to.tier];
                if (!cfg) return null;
                const userPoints = user?.points ?? 0;
                const status = offerStatuses.tier[to.tier];
                const unlocked = status?.unlocked ?? (userPoints >= cfg.min);
                const availableNow = status ? status.available : true;
                const ptsNeeded = Math.max(cfg.min - userPoints, 0);
                const progress = Math.min(userPoints / cfg.min, 1);

                return (
                  <View
                    key={to.tier}
                    style={{
                      backgroundColor: to.featured && unlocked ? "#FFF9E8" : unlocked ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.035)",
                      borderRadius: 22, overflow: "hidden", marginBottom: 12,
                      borderWidth: 1.5,
                      borderColor: to.featured ? YELLOW : unlocked ? cfg.colour + "99" : "rgba(255,255,255,0.08)",
                      shadowColor: unlocked ? cfg.colour : "#000",
                      shadowOpacity: unlocked ? 0.18 : 0,
                      shadowRadius: 14,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: unlocked ? 4 : 0,
                    }}
                  >
                    <View style={{ backgroundColor: unlocked ? cfg.colour + "18" : "rgba(255,255,255,0.03)", borderBottomWidth: 1, borderBottomColor: unlocked ? cfg.colour + "22" : "rgba(255,255,255,0.06)", paddingHorizontal: 16, paddingVertical: 14 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
                          <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: unlocked ? cfg.colour + "26" : "rgba(255,255,255,0.07)" }}>
                            <Ionicons name={cfg.icon} size={17} color={cfg.colour} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <Text style={{ color: unlocked ? NAV : "white", fontSize: 16, fontWeight: "900" }}>{cfg.label}</Text>
                              <View style={{ backgroundColor: unlocked ? cfg.colour + "22" : "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ color: unlocked ? cfg.colour : "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "800" }}>
                                  {cfg.min.toLocaleString()} PTS
                                </Text>
                              </View>
                            </View>
                            <Text style={{ color: unlocked ? "rgba(15,0,50,0.55)" : "rgba(255,255,255,0.42)", fontSize: 12, marginTop: 3 }}>
                              {unlocked
                                ? (status?.available ? `${formatOfferRule(to.limit_count, to.limit_period)} available` : status?.status_label ?? "Currently unavailable")
                                : `${ptsNeeded} more points to unlock`}
                            </Text>
                          </View>
                        </View>
                        {unlocked && availableNow ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(34,197,94,0.11)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" }}>
                            <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                            <Text style={{ color: "#22C55E", fontSize: 11, fontWeight: "800" }}>UNLOCKED</Text>
                          </View>
                        ) : unlocked ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(245,158,11,0.14)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" }}>
                            <Ionicons name="time-outline" size={12} color="#F59E0B" />
                            <Text style={{ color: "#F59E0B", fontSize: 11, fontWeight: "800" }}>USED</Text>
                          </View>
                        ) : (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" }}>
                            <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.45)" />
                            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700" }}>LOCKED</Text>
                          </View>
                        )}
                      </View>

                      {!unlocked && (
                        <View style={{ marginTop: 12 }}>
                          <View style={{ height: 7, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                            <View style={{ width: `${Math.max(progress * 100, 4)}%`, height: "100%", borderRadius: 999, backgroundColor: cfg.colour }} />
                          </View>
                          <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, marginTop: 6 }}>
                            You&apos;re {Math.round(progress * 100)}% of the way there
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={{ padding: 16 }}>
                      {to.featured ? (
                        <View style={{ alignSelf: "flex-start", backgroundColor: unlocked ? YELLOW + "22" : "rgba(251,201,0,0.14)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 }}>
                          <Text style={{ color: unlocked ? NAV : YELLOW, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }}>FEATURED REWARD</Text>
                        </View>
                      ) : null}
                      <Text style={{ color: unlocked ? NAV : "white", fontWeight: "800", fontSize: 17, marginBottom: to.description ? 6 : 10 }}>
                        {decodeHtml(to.title)}
                      </Text>
                      {to.description ? (
                        <Text style={{ color: unlocked ? "rgba(15,0,50,0.58)" : "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
                          {decodeHtml(to.description)}
                        </Text>
                      ) : null}

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: unlocked ? cfg.accent : "rgba(255,255,255,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Ionicons name="refresh-outline" size={11} color={unlocked ? NAV : "rgba(255,255,255,0.5)"} />
                          <Text style={{ color: unlocked ? NAV : "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700" }}>
                            {formatOfferRule(to.limit_count, to.limit_period)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: unlocked ? YELLOW + "22" : "rgba(255,255,255,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Ionicons name="star" size={11} color={unlocked ? NAV : "rgba(255,255,255,0.5)"} />
                          <Text style={{ color: unlocked ? NAV : "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700" }}>+35 pts on redemption</Text>
                        </View>
                      </View>

                      {unlocked && availableNow ? (
                        <TouchableOpacity
                          style={{ marginTop: 14, backgroundColor: cfg.colour, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setQrModalOffer({ id: -1, title: to.title, description: to.description, tier: to.tier } as any);
                            }}
                          >
                          <Ionicons name="qr-code-outline" size={16} color={NAV} />
                          <Text style={{ color: NAV, fontSize: 14, fontWeight: "900" }}>Show QR to Redeem</Text>
                        </TouchableOpacity>
                      ) : unlocked ? (
                        <View style={{ marginTop: 14, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: "rgba(245,158,11,0.10)", borderWidth: 1, borderColor: "rgba(245,158,11,0.24)" }}>
                          <Text style={{ color: unlocked ? NAV : "white", fontSize: 12, fontWeight: "800" }}>
                            {status?.status_label ?? "Currently unavailable"}
                          </Text>
                          <Text style={{ color: unlocked ? "rgba(15,0,50,0.58)" : "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                            {status?.next_available_text ?? status?.message ?? "This reward has been used for the current period. It will come back automatically when the next window opens."}
                          </Text>
                        </View>
                      ) : (
                        <View style={{ marginTop: 14, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, paddingRight: 10 }}>
                            <Ionicons name="trending-up-outline" size={16} color={cfg.colour} />
                            <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 12, fontWeight: "700", flex: 1, lineHeight: 17 }}>
                              Earn {ptsNeeded} more points to unlock this reward
                            </Text>
                          </View>
                          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: cfg.colour + "20", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="lock-closed" size={12} color={cfg.colour} />
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* HU NOW Offers */}
          <View style={{ marginBottom: 32 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ color: "white", fontWeight: "800", fontSize: 18 }}>HU NOW Offers</Text>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                {offers.length > 0 && (
                  <View style={{ backgroundColor: YELLOW + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: YELLOW, fontSize: 12, fontWeight: "700" }}>{offers.length} available</Text>
                  </View>
                )}
                {statusLoading && (
                  <Text style={{ color: "rgba(255,255,255,0.32)", fontSize: 10, fontWeight: "700" }}>Checking status…</Text>
                )}
              </View>
            </View>

            {offers.length === 0 ? (
              <View style={{
                backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 20,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <View style={{ backgroundColor: YELLOW + "22", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="pricetag-outline" size={18} color={YELLOW} />
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" }}>No active offers right now</Text>
                </View>
                {venue.excerpt?.rendered ? (
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 19 }}>
                    {stripHtml(venue.excerpt.rendered)}
                  </Text>
                ) : null}
              </View>
            ) : (
              offers.map((offer) => {
                const expiryRaw = venue.acf?.offer_expiry as string | undefined;
                const expiryLabel = expiryRaw ? getExpiryBadgeLabel(expiryRaw) : null;
                const status = offerStatuses.standard[offer.id];
                const availableNow = status ? status.available : true;

                return (
                  <View
                    key={offer.id}
                    style={{
                      backgroundColor: offer.featured ? "#FFF9E8" : "rgba(255,255,255,0.98)", borderRadius: 22, overflow: "hidden",
                      marginBottom: 12,
                      borderWidth: 1.5,
                      borderColor: offer.featured ? YELLOW : availableNow ? YELLOW + "66" : "rgba(245,158,11,0.35)",
                      shadowColor: YELLOW, shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: availableNow ? 0.18 : 0.08, shadowRadius: 14, elevation: 4,
                      opacity: availableNow ? 1 : 0.88,
                    }}
                  >
                    <View style={{ backgroundColor: YELLOW + "18", borderBottomWidth: 1, borderBottomColor: YELLOW + "33", paddingHorizontal: 16, paddingVertical: 14 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
                          <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: YELLOW + "22" }}>
                            <Ionicons name="ticket-outline" size={17} color={NAV} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ color: NAV, fontWeight: "900", fontSize: 17 }}>{decodeHtml(offer.title)}</Text>
                            <Text style={{ color: "rgba(15,0,50,0.52)", fontSize: 12, marginTop: 3 }}>
                              Available to all HU NOW members
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: 6, alignSelf: "flex-start" }}>
                          {offer.featured ? (
                            <View style={{ backgroundColor: YELLOW, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                              <Text style={{ color: NAV, fontSize: 11, fontWeight: "900" }}>FEATURED</Text>
                            </View>
                          ) : null}
                          <View style={{ backgroundColor: YELLOW + "26", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Text style={{ color: NAV, fontSize: 11, fontWeight: "800" }}>STANDARD</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={{ padding: 16 }}>
                      {offer.featured ? (
                        <Text style={{ color: "#8A6A00", fontSize: 12, fontWeight: "900", marginBottom: 10 }}>Promoted reward</Text>
                      ) : null}
                      {offer.description ? (
                        <Text style={{ color: "rgba(15,0,50,0.58)", fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
                          {decodeHtml(offer.description)}
                        </Text>
                      ) : null}

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: YELLOW + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Ionicons name="star" size={11} color={NAV} />
                          <Text style={{ color: NAV, fontSize: 11, fontWeight: "700" }}>+35 pts on redemption</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(15,0,50,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Ionicons name="people-outline" size={11} color={NAV} />
                          <Text style={{ color: NAV, fontSize: 11, fontWeight: "700" }}>{formatOfferRule(offer.limit_count, offer.limit_period)}</Text>
                        </View>
                        {status ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: availableNow ? "rgba(34,197,94,0.10)" : "rgba(245,158,11,0.14)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Ionicons name={availableNow ? "checkmark-circle-outline" : "time-outline"} size={11} color={availableNow ? "#16A34A" : "#B45309"} />
                            <Text style={{ color: availableNow ? "#15803D" : "#B45309", fontSize: 11, fontWeight: "700" }}>{status.status_label}</Text>
                          </View>
                        ) : null}
                        {expiryLabel && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: AMBER + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Ionicons name="time-outline" size={11} color={AMBER} />
                            <Text style={{ color: AMBER, fontSize: 11, fontWeight: "700" }}>{expiryLabel}</Text>
                          </View>
                        )}
                      </View>

                      {ctaText && ctaUrl && (
                        <TouchableOpacity
                          style={{ marginTop: 12, backgroundColor: "rgba(15,0,50,0.06)", borderRadius: 14, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                          onPress={() => Linking.openURL(ctaUrl)}
                        >
                          <Ionicons name="open-outline" size={15} color={NAV} />
                          <Text style={{ color: NAV, fontSize: 13, fontWeight: "800" }}>{decodeHtml(ctaText)}</Text>
                        </TouchableOpacity>
                      )}

                      {availableNow ? (
                        <TouchableOpacity
                          style={{
                            marginTop: 12, backgroundColor: YELLOW, borderRadius: 14,
                            paddingVertical: 13, alignItems: "center", flexDirection: "row",
                            justifyContent: "center", gap: 8,
                          }}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setQrModalOffer(offer);
                          }}
                        >
                          <Ionicons name="qr-code-outline" size={16} color={NAV} />
                          <Text style={{ color: NAV, fontSize: 14, fontWeight: "900" }}>Show QR to Redeem</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={{ marginTop: 12, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: "rgba(245,158,11,0.10)", borderWidth: 1, borderColor: "rgba(245,158,11,0.24)" }}>
                          <Text style={{ color: NAV, fontSize: 12, fontWeight: "800" }}>{status?.status_label ?? "Currently unavailable"}</Text>
                          <Text style={{ color: "rgba(15,0,50,0.58)", fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                            {status?.next_available_text ?? status?.message ?? "This offer has been used for the current period. It will reappear automatically when it resets."}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* QR Redemption Modal — full screen, max brightness */}
      <Modal
        visible={qrModalOffer !== null}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setQrModalOffer(null)}
      >
        <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8 }}>
            Present to staff
          </Text>
          <Text style={{ color: "white", fontSize: 20, fontWeight: "900", textAlign: "center", marginBottom: 28, letterSpacing: -0.5 }}>
            {qrModalOffer ? decodeHtml(qrModalOffer.title) : ""}
          </Text>

          {/* Animated QR card */}
          <Animated.View style={[{
            backgroundColor: "white", borderRadius: 28, padding: 28, alignItems: "center",
            shadowColor: YELLOW, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 20,
          }, qrRevealStyle]}>
            {user?.card_token ? (
              <QRCode value={user.card_token} size={220} color={NAV} backgroundColor="transparent" />
            ) : (
              <View style={{ width: 220, height: 220, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "rgba(15,0,50,0.4)", fontSize: 13 }}>No card token</Text>
              </View>
            )}
            <Text style={{ color: "rgba(15,0,50,0.35)", fontSize: 11, marginTop: 12, letterSpacing: 1, textTransform: "uppercase" }}>
              HU NOW Member
            </Text>
          </Animated.View>

          <View style={{
            flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24,
            backgroundColor: YELLOW + "22", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
          }}>
            <Ionicons name="star" size={14} color={YELLOW} />
            <Text style={{ color: YELLOW, fontSize: 14, fontWeight: "700" }}>+35 pts on redemption</Text>
          </View>

          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setQrModalOffer(null); }}
            style={{
              marginTop: 32, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16,
              paddingHorizontal: 40, paddingVertical: 14,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
            }}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
