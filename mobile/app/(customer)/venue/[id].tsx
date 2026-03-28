import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Linking, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import * as Brightness from "expo-brightness";
import * as Location from "expo-location";
import Animated, {
  useSharedValue, withSpring, withTiming, useAnimatedStyle,
} from "react-native-reanimated";
import { wordpress, getFeaturedImage, extractOffers, formatOfferRule, formatOfferSchedule, type FavouriteOfferRef, type WPEat, type WPLoyaltyStatus, type WPOffer } from "@/lib/wordpress";
import { fetchOfferStatuses, type OfferStatus } from "@/lib/wpAuth";
import { decodeHtml, stripHtml, getDisplayAddress, getTodayOpeningHours, getTodayOpeningStatus, getLatLng } from "@/lib/utils";
import { getExpiryBadgeLabel } from "@/lib/offerExpiry";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/Skeleton";
import { HUNowPickBadge } from "@/components/HUNowPickBadge";
import { buildMemberQrPayload } from "@/lib/qrPayload";
import { haversineKm } from "@/lib/haversine";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const AMBER = "#F59E0B";
const TIER_CONFIG: Record<string, { min: number; label: string; colour: string; icon: keyof typeof Ionicons.glyphMap; accent: string }> = {
  bronze: { min: 200, label: "Bronze", colour: "#CD7F32", icon: "medal-outline", accent: "#F1D2B5" },
  silver: { min: 600, label: "Silver", colour: "#C0C0C0", icon: "diamond-outline", accent: "#ECEEF3" },
  gold: { min: 1400, label: "Gold", colour: "#FBC900", icon: "trophy-outline", accent: "#FFF0A6" },
};

function buildFavouriteKey(favourite: FavouriteOfferRef | { venue_id: number; offer_index?: number; tier?: string }) {
  return favourite.tier
    ? `${favourite.venue_id}:tier:${favourite.tier}`
    : `${favourite.venue_id}:standard:${favourite.offer_index ?? 0}`;
}

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, token, refreshUser } = useAuth();
  const [venue, setVenue] = useState<WPEat | null>(null);
  const [offers, setOffers] = useState<WPOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [favouriteKeys, setFavouriteKeys] = useState<string[]>([]);
  const [qrModalOffer, setQrModalOffer] = useState<WPOffer | null>(null);
  const [offerStatuses, setOfferStatuses] = useState<{ standard: Record<number, OfferStatus>; tier: Record<string, OfferStatus> }>({ standard: {}, tier: {} });
  const [expandedOfferKeys, setExpandedOfferKeys] = useState<string[]>([]);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ tone: "success" | "warn"; title: string; body: string } | null>(null);
  const [loyaltyStatus, setLoyaltyStatus] = useState<WPLoyaltyStatus | null>(null);
  const savedBrightness = useRef<number | null>(null);

  // QR modal reveal animation
  const qrRevealScale = useSharedValue(0.7);
  const qrRevealOpacity = useSharedValue(0);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setStatusLoading(!!token);
      const [wpVenue, statusData, loyaltyData] = await Promise.all([
        wordpress.getEatById(Number(id)).catch(() => null),
        token ? fetchOfferStatuses(Number(id), token).catch(() => null) : Promise.resolve(null),
        token ? wordpress.getLoyaltyStatus(Number(id), token).catch(() => null) : Promise.resolve(null),
      ]);
      setVenue(wpVenue);
      if (wpVenue) setOffers(extractOffers(wpVenue));
      if (statusData) {
        setOfferStatuses({
          standard: Object.fromEntries((statusData.standard ?? []).map((s) => [s.offer_index ?? 0, s])),
          tier: Object.fromEntries((statusData.tier ?? []).map((s) => [s.tier ?? "", s])),
        });
      }
      setLoyaltyStatus(loyaltyData);
      setStatusLoading(false);
      setLoading(false);
    }
    load();
  }, [id, token]);

  // Load real favourite state from WP
  useEffect(() => {
    if (!token) return;
    wordpress.getFavourites(token).then((favs) => {
      setFavouriteKeys(favs.map((fav) => buildFavouriteKey(fav)));
    }).catch(() => {});
  }, [token]);

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

  const qrRevealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: qrRevealScale.value }],
    opacity: qrRevealOpacity.value,
  }));

  async function handleOfferFavouriteToggle(favourite: FavouriteOfferRef) {
    if (!token) {
      Alert.alert("Sign in required", "Please sign in to save favourite offers.");
      return;
    }

    const key = buildFavouriteKey(favourite);
    const isSaved = favouriteKeys.includes(key);
    setFavouriteKeys((current) => (isSaved ? current.filter((item) => item !== key) : [...current, key]));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (isSaved) {
        await wordpress.removeFavourite(favourite, token);
        setFeedbackMessage({ tone: "warn", title: "Removed from favourites", body: "This reward has been taken out of your saved offers." });
      } else {
        await wordpress.addFavourite(favourite, token);
        setFeedbackMessage({ tone: "success", title: "Saved to favourites", body: "This reward is now waiting in your favourites section." });
      }
    } catch {
      setFavouriteKeys((current) => (isSaved ? [...current, key] : current.filter((item) => item !== key)));
      setFeedbackMessage({ tone: "warn", title: "Couldn’t update favourite", body: "Please try again in a moment." });
    }
  }

  function toggleExpanded(key: string) {
    setExpandedOfferKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }

  async function handleCheckIn() {
    if (!token) {
      Alert.alert("Sign in required", "Please sign in to check in and earn points.");
      return;
    }
    setCheckinLoading(true);
    try {
      const venueCoords = getLatLng(venue?.acf?.address);
      if (!venueCoords) {
        Alert.alert("Check-in unavailable", "This venue doesn’t have a valid location set yet.");
        return;
      }

      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (permission.status !== "granted") {
        Alert.alert("Location needed", "Allow location access so we can verify you’re at this venue.");
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const distanceKm = haversineKm(current.coords.latitude, current.coords.longitude, venueCoords.lat, venueCoords.lng);
      const result = await wordpress.dailyCheckin(token, {
        venue_id: Number(id),
        lat: current.coords.latitude,
        lng: current.coords.longitude,
      });
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFeedbackMessage({
        tone: result.already_checked_in ? "warn" : "success",
        title: result.already_checked_in ? "Already checked in today" : "Check-in complete",
        body: result.already_checked_in
          ? result.message
          : `${result.message} You were ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`} from the venue.`,
      });
    } catch (error: any) {
      const message = error?.message ?? "Please try again.";
      const friendly = /within|close|distance|near/i.test(message)
        ? "You need to be a little closer to this venue before check-in will work."
        : message;
      setFeedbackMessage({ tone: "warn", title: "Couldn’t check in", body: friendly });
    } finally {
      setCheckinLoading(false);
    }
  }

  function getQrValue() {
    if (!user?.card_token) return "";
    if (!qrModalOffer) return user.card_token;

    const tier = (qrModalOffer as any).tier as "bronze" | "silver" | "gold" | undefined;
    const offerIndex = qrModalOffer.id > 0 ? qrModalOffer.id : undefined;
    return buildMemberQrPayload({
      version: 1,
      card_token: user.card_token,
      venue_id: Number(id),
      offer_index: offerIndex,
      tier,
      offer_title: qrModalOffer.title,
    });
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
  const todayHours = getTodayOpeningHours(venue.acf?.opening_hours);
  const todayStatus = getTodayOpeningStatus(venue.acf?.opening_hours);
  const mapsQuery = locationText ? encodeURIComponent(locationText) : null;
  const mapsUrl = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${mapsQuery}` : null;

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
          {feedbackMessage ? (
            <View
              style={{
                marginBottom: 14,
                backgroundColor: feedbackMessage.tone === "success" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: feedbackMessage.tone === "success" ? "rgba(34,197,94,0.24)" : "rgba(245,158,11,0.24)",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: feedbackMessage.tone === "success" ? "#22C55E" : "#F59E0B", fontSize: 13, fontWeight: "900", marginBottom: 4 }}>
                    {feedbackMessage.title}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 12, lineHeight: 18 }}>
                    {feedbackMessage.body}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setFeedbackMessage(null)}>
                  <Ionicons name="close" size={16} color="rgba(255,255,255,0.56)" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {(todayStatus || todayHours) ? (
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {todayStatus ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: todayStatus.isOpen ? "rgba(34,197,94,0.14)" : "rgba(245,158,11,0.16)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Ionicons name={todayStatus.isOpen ? "checkmark-circle-outline" : "time-outline"} size={12} color={todayStatus.isOpen ? "#22C55E" : "#F59E0B"} />
                  <Text style={{ color: todayStatus.isOpen ? "#86EFAC" : "#FCD34D", fontSize: 11, fontWeight: "800" }}>{todayStatus.label}</Text>
                </View>
              ) : null}
              {todayHours ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.6)" />
                  <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "700" }}>{todayHours}</Text>
                </View>
              ) : null}
              {mapsUrl ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(mapsUrl)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: YELLOW + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}
                >
                  <Ionicons name="map-outline" size={12} color={YELLOW} />
                  <Text style={{ color: YELLOW, fontSize: 11, fontWeight: "800" }}>Open Map</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          <View style={{
            backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16,
            marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingRight: 12 }}>
                <View style={{ backgroundColor: YELLOW + "22", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="walk-outline" size={18} color={YELLOW} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "white", fontSize: 15, fontWeight: "800" }}>Daily Check-In</Text>
                  <Text style={{ color: "rgba(255,255,255,0.46)", fontSize: 12, marginTop: 2 }}>
                    {user?.today_checked_in ? `Checked in today • ${user?.login_streak ?? 0} day streak` : "Check in once per day to build your streak"}
                  </Text>
                </View>
              </View>
              <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: YELLOW, fontSize: 11, fontWeight: "900" }}>+5 pts</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleCheckIn}
              disabled={checkinLoading || !!user?.today_checked_in}
              style={{
                backgroundColor: user?.today_checked_in ? "rgba(255,255,255,0.08)" : YELLOW,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: user?.today_checked_in ? "rgba(255,255,255,0.5)" : NAV, fontWeight: "900" }}>
                {checkinLoading ? "Checking in…" : user?.today_checked_in ? "Checked in today" : "Check in"}
              </Text>
            </TouchableOpacity>
          </View>
          {loyaltyStatus?.enabled ? (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16,
              marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={{ backgroundColor: YELLOW + "22", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="card-outline" size={18} color={YELLOW} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "white", fontSize: 15, fontWeight: "800" }}>{loyaltyStatus.card_title}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.46)", fontSize: 12, marginTop: 2 }}>
                      {loyaltyStatus.reward_title}
                    </Text>
                  </View>
                </View>
                <View style={{ backgroundColor: YELLOW + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: YELLOW, fontSize: 11, fontWeight: "900" }}>
                    {loyaltyStatus.stamp_count}/{loyaltyStatus.target}
                  </Text>
                </View>
              </View>

              <View style={{ height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 10 }}>
                <View style={{ width: `${Math.max((loyaltyStatus.stamp_count / loyaltyStatus.target) * 100, loyaltyStatus.stamp_count > 0 ? 6 : 0)}%`, height: "100%", borderRadius: 999, backgroundColor: YELLOW }} />
              </View>

              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: loyaltyStatus.reward_description ? 10 : 0 }}>
                <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: "rgba(255,255,255,0.76)", fontSize: 11, fontWeight: "800" }}>
                    5 {loyaltyStatus.stamp_label.toLowerCase()}s = +5 pts
                  </Text>
                </View>
                <View style={{ backgroundColor: "rgba(34,197,94,0.14)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: "#86EFAC", fontSize: 11, fontWeight: "800" }}>
                    10 {loyaltyStatus.stamp_label.toLowerCase()}s = free reward
                  </Text>
                </View>
              </View>

              {loyaltyStatus.reward_description ? (
                <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 13, lineHeight: 19, marginBottom: 10 }}>
                  {loyaltyStatus.reward_description}
                </Text>
              ) : null}

              <Text style={{ color: "rgba(255,255,255,0.48)", fontSize: 12 }}>
                Staff will add a {loyaltyStatus.stamp_label.toLowerCase()} after any in-store purchase. Your reward appears in Vouchers automatically at 10/10.
              </Text>
            </View>
          ) : null}
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
                const offerKey = `tier:${to.tier}`;
                const userPoints = user?.points ?? 0;
                const status = offerStatuses.tier[to.tier];
                const unlocked = status?.unlocked ?? (userPoints >= cfg.min);
                const availableNow = status ? status.available : true;
                const ptsNeeded = Math.max(cfg.min - userPoints, 0);
                const progress = Math.min(userPoints / cfg.min, 1);
                const isExpanded = expandedOfferKeys.includes(offerKey);
                const isSaved = favouriteKeys.includes(buildFavouriteKey({ venue_id: Number(id), tier: to.tier }));
                const scheduleLabel = formatOfferSchedule(to.days_of_week ?? [], to.time_start, to.time_end);
                const tierSummaryText = statusLoading && token
                  ? "Checking member availability..."
                  : unlocked
                    ? (status?.available ? `${formatOfferRule(to.limit_count, to.limit_period)} available` : (status?.status_label ?? "Currently unavailable"))
                    : `${ptsNeeded} more points to unlock`;

                return (
                  <View
                    key={offerKey}
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
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => toggleExpanded(offerKey)}
                      style={{ backgroundColor: unlocked ? cfg.colour + "18" : "rgba(255,255,255,0.03)", borderBottomWidth: isExpanded ? 1 : 0, borderBottomColor: unlocked ? cfg.colour + "22" : "rgba(255,255,255,0.06)", paddingHorizontal: 16, paddingVertical: 14 }}
                    >
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
                              {tierSummaryText}
                            </Text>
                            <Text style={{ color: unlocked ? "rgba(15,0,50,0.38)" : "rgba(255,255,255,0.32)", fontSize: 11, fontWeight: "700", marginTop: 5 }}>
                              {isExpanded ? "Tap to collapse" : "Tap to expand"}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => handleOfferFavouriteToggle({ venue_id: Number(id), tier: to.tier, offer_title: to.title })}
                            style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: unlocked ? "rgba(15,0,50,0.06)" : "rgba(255,255,255,0.08)" }}
                          >
                            <Ionicons name={isSaved ? "heart" : "heart-outline"} size={15} color={isSaved ? "#FF4D6D" : unlocked ? NAV : "rgba(255,255,255,0.6)"} />
                          </TouchableOpacity>
                          {statusLoading && token ? (
                            <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" }}>
                              <Text style={{ color: unlocked ? "rgba(15,0,50,0.45)" : "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700" }}>Checking…</Text>
                            </View>
                          ) : unlocked && availableNow ? (
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
                          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={unlocked ? NAV : "rgba(255,255,255,0.55)"} />
                        </View>
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
                    </TouchableOpacity>

                    {isExpanded && (
                    <View style={{ padding: 16 }}>
                      {to.featured ? <View style={{ marginBottom: 10 }}>{unlocked ? <HUNowPickBadge label="FEATURED BY HU NOW" /> : <HUNowPickBadge label="FEATURED BY HU NOW" inverted />}</View> : null}
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
                        {scheduleLabel ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: unlocked ? "rgba(15,0,50,0.06)" : "rgba(255,255,255,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Ionicons name="calendar-outline" size={11} color={unlocked ? NAV : "rgba(255,255,255,0.5)"} />
                            <Text style={{ color: unlocked ? NAV : "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700" }}>{scheduleLabel}</Text>
                          </View>
                        ) : null}
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
                    )}
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
                const offerKey = `standard:${offer.id}`;
                const expiryRaw = venue.acf?.offer_expiry as string | undefined;
                const expiryLabel = expiryRaw ? getExpiryBadgeLabel(expiryRaw) : null;
                const status = offerStatuses.standard[offer.id];
                const availableNow = status ? status.available : true;
                const isExpanded = expandedOfferKeys.includes(offerKey);
                const isSaved = favouriteKeys.includes(buildFavouriteKey({ venue_id: Number(id), offer_index: offer.id }));
                const scheduleLabel = formatOfferSchedule(offer.days_of_week ?? [], offer.time_start, offer.time_end);
                const standardSummaryText = statusLoading && token
                  ? "Checking member availability..."
                  : "Available to all HU NOW members";

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
                    <TouchableOpacity
                      activeOpacity={0.9}
                          onPress={() => toggleExpanded(offerKey)}
                      style={{ backgroundColor: YELLOW + "18", borderBottomWidth: isExpanded ? 1 : 0, borderBottomColor: YELLOW + "33", paddingHorizontal: 16, paddingVertical: 14 }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
                          <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: YELLOW + "22" }}>
                            <Ionicons name="ticket-outline" size={17} color={NAV} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ color: NAV, fontWeight: "900", fontSize: 17 }}>{decodeHtml(offer.title)}</Text>
                            <Text style={{ color: "rgba(15,0,50,0.52)", fontSize: 12, marginTop: 3 }}>
                              {standardSummaryText}
                            </Text>
                            <Text style={{ color: "rgba(15,0,50,0.38)", fontSize: 11, fontWeight: "700", marginTop: 5 }}>
                              {isExpanded ? "Tap to collapse" : "Tap to expand"}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => handleOfferFavouriteToggle({ venue_id: Number(id), offer_index: offer.id, offer_title: offer.title })}
                          style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,0,50,0.06)" }}
                        >
                          <Ionicons name={isSaved ? "heart" : "heart-outline"} size={15} color={isSaved ? "#FF4D6D" : NAV} />
                        </TouchableOpacity>
                        <View style={{ flexDirection: "row", gap: 6, alignSelf: "flex-start" }}>
                          {offer.featured ? (
                            <HUNowPickBadge />
                          ) : null}
                          <View style={{ backgroundColor: YELLOW + "26", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Text style={{ color: NAV, fontSize: 11, fontWeight: "800" }}>STANDARD</Text>
                          </View>
                        </View>
                          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={NAV} />
                        </View>
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                    <View style={{ padding: 16 }}>
                      {offer.featured ? <View style={{ marginBottom: 10 }}><HUNowPickBadge label="FEATURED BY HU NOW" /></View> : null}
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
                        {scheduleLabel ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(15,0,50,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Ionicons name="calendar-outline" size={11} color={NAV} />
                            <Text style={{ color: NAV, fontSize: 11, fontWeight: "700" }}>{scheduleLabel}</Text>
                          </View>
                        ) : null}
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
                    )}
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
              <QRCode value={getQrValue()} size={220} color={NAV} backgroundColor="transparent" />
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
