import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, Image, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { wordpress, getFeaturedImage, extractOffers, type WPEvent, type WPPost, type WPEat } from "@/lib/wordpress";
import { decodeHtml, parseEventDate, getLatLng } from "@/lib/utils";
import { haversineKm } from "@/lib/haversine";
import { useAuth } from "@/context/AuthContext";
import { OfferCardSkeleton } from "@/components/OfferCardSkeleton";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const SURFACE = "rgba(255,255,255,0.07)";
const BORDER = "rgba(255,255,255,0.09)";
const BRAND_LOGO_URL = "https://hunow.co.uk/wp-content/uploads/2025/02/Group-1-1.png";
const TIERS = [
  { name: "Standard", min: 0, max: 199, colour: "rgba(255,255,255,0.5)" },
  { name: "Bronze", min: 200, max: 599, colour: "#CD7F32" },
  { name: "Silver", min: 600, max: 1399, colour: "#C0C0C0" },
  { name: "Gold", min: 1400, max: 99999, colour: YELLOW },
];

function getTier(points: number) {
  return [...TIERS].reverse().find((t) => points >= t.min) ?? TIERS[0];
}

function getNextTier(points: number) {
  return TIERS.find((t) => t.min > points) ?? null;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

interface ActiveOffer {
  venueId: number;
  venueName: string;
  offerTitle: string;
  img: string | null;
  featured?: boolean;
  distanceKm?: number;
}

function isDateOnlyValue(raw?: string | null): boolean {
  if (!raw) return false;
  return /^\d{8}$/.test(raw.trim()) || /^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
}

function getEventCutoff(event: WPEvent): Date | null {
  const endRaw = typeof event.acf?.event_end === "string" ? event.acf.event_end : "";
  const startRaw = typeof event.acf?.event_date === "string" ? event.acf.event_date : "";
  const endDate = endRaw ? parseEventDate(endRaw) : null;
  if (endDate) {
    if (isDateOnlyValue(endRaw)) endDate.setHours(23, 59, 59, 999);
    return endDate;
  }
  const startDate = startRaw ? parseEventDate(startRaw) : null;
  if (startDate && isDateOnlyValue(startRaw)) {
    startDate.setHours(23, 59, 59, 999);
  }
  return startDate;
}

function SectionHeader({
  icon,
  title,
  actionLabel,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon ? <Ionicons name={icon} size={16} color={YELLOW} /> : null}
        <Text style={{ color: "white", fontSize: 18, fontWeight: "800", letterSpacing: -0.2 }}>{title}</Text>
      </View>
      {actionLabel && onPress ? (
        <TouchableOpacity onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ color: YELLOW, fontSize: 13, fontWeight: "700" }}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={13} color={YELLOW} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

async function loadOffers(): Promise<ActiveOffer[]> {
  const venues = await wordpress.getEat({ page: 1, perPage: 100 });
  const result: ActiveOffer[] = [];
  for (const v of venues) {
    const offers = extractOffers(v);
    for (const o of offers) {
      result.push({
        venueId: v.id,
        venueName: decodeHtml(v.title.rendered),
        offerTitle: o.title,
        img: getFeaturedImage(v),
        featured: Boolean(o.featured),
      });
    }
  }
  return result.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const CARD_W = width - 48;

  const [events, setEvents]     = useState<WPEvent[]>([]);
  const [news, setNews]         = useState<WPPost[]>([]);
  const [activeOffers, setActiveOffers] = useState<ActiveOffer[]>([]);
  const [nearbyOffers, setNearbyOffers] = useState<ActiveOffer[]>([]);
  const [nearbyState, setNearbyState] = useState<"idle" | "ready" | "empty" | "denied" | "unavailable">("idle");
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const [wpEvents, wpNews, wpOffers] = await Promise.all([
      wordpress.getEvents({ perPage: 4 }),
      wordpress.getPosts({ perPage: 4 }).catch(() => [] as WPPost[]),
      loadOffers().catch(() => [] as ActiveOffer[]),
    ]);
    const now = new Date();
    const upcomingEvents = wpEvents.filter((event) => {
      const cutoff = getEventCutoff(event);
      return cutoff ? cutoff.getTime() >= now.getTime() : false;
    });
    setEvents(upcomingEvents.slice(0, 4));
    setNews([...wpNews].sort((a, b) => Number(Boolean(b.sticky)) - Number(Boolean(a.sticky)) || new Date(b.date).getTime() - new Date(a.date).getTime()));
    setActiveOffers(wpOffers);

    // Rewards Near You — non-blocking
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status === "undetermined") {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      const { status } = permission;
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const allVenues = await wordpress.getEat({ page: 1, perPage: 100 });
            const nearbyOfferItems = allVenues
          .flatMap((v) => {
            const coords = getLatLng(v.acf?.address);
            if (!coords) return [];
            const distanceKm = haversineKm(loc.coords.latitude, loc.coords.longitude, coords.lat, coords.lng);
            const offers = extractOffers(v);
            return offers.map((offer) => ({
              venueId: v.id,
              venueName: decodeHtml(v.title.rendered),
              offerTitle: offer.title,
              img: getFeaturedImage(v),
              featured: Boolean(offer.featured),
              distanceKm,
            }));
          })
          .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
          .slice(0, 6);
        setNearbyOffers(nearbyOfferItems);
        setNearbyState(nearbyOfferItems.length > 0 ? "ready" : "empty");
      } else {
        setNearbyOffers([]);
        setNearbyState("denied");
      }
    } catch {
      setNearbyOffers([]);
      setNearbyState("unavailable");
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);
  function onRefresh() { setRefreshing(true); load(); }

  // Skeleton state — show header and nav instantly, skeleton for content sections
  const showSkeleton = loading;
  const currentPoints = user?.points ?? 0;
  const currentTier = getTier(currentPoints);
  const nextTier = getNextTier(currentPoints);
  const tierProgress = nextTier ? (currentPoints - currentTier.min) / (nextTier.min - currentTier.min) : 1;
  const pointsToNext = nextTier ? nextTier.min - currentPoints : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Image
              source={{ uri: BRAND_LOGO_URL }}
              style={{ width: 112, height: 52, marginBottom: 10, marginLeft: -18, alignSelf: "flex-start" }}
              resizeMode="contain"
            />
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{greeting()}</Text>
            <Text style={{ color: "white", fontSize: 28, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 }}>
              {user?.display_name?.split(" ")[0] ?? "Welcome"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(customer)/card")}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: YELLOW, borderRadius: 20,
              paddingHorizontal: 12, paddingVertical: 7,
              shadowColor: YELLOW, shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.4, shadowRadius: 8,
            }}
          >
            <Ionicons name="star" size={13} color={NAV} />
            <Text style={{ color: NAV, fontSize: 13, fontWeight: "800" }}>{user?.points ?? 0} pts</Text>
          </TouchableOpacity>
        </View>

        {/* ── Quick Nav ─────────────────────────────────── */}
        <View style={{ flexDirection: "row", paddingHorizontal: 20, marginTop: 20, gap: 10 }}>
          {[
            { label: "Offers",  icon: "pricetag-outline"  as const, route: "/(customer)/venues" },
            { label: "Events",  icon: "calendar-outline"  as const, route: "/(customer)/events" },
            { label: "News",    icon: "newspaper-outline" as const, route: "/(customer)/news"   },
            { label: "My Card", icon: "card-outline"      as const, route: "/(customer)/card"   },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(item.route as any); }}
              style={{
                flex: 1, backgroundColor: SURFACE,
                borderRadius: 18, alignItems: "center", paddingVertical: 13,
                borderWidth: 1, borderColor: BORDER,
              }}
            >
              <Ionicons name={item.icon} size={22} color={YELLOW} />
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "600", marginTop: 5, textAlign: "center" }}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => router.push("/(customer)/card")}
          style={{
            marginHorizontal: 20, marginTop: 18, backgroundColor: SURFACE,
            borderRadius: 22, padding: 18, borderWidth: 1, borderColor: BORDER,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <View>
              <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 }}>
                Tier Progress
              </Text>
              <Text style={{ color: "white", fontSize: 17, fontWeight: "800" }}>{currentTier.name}</Text>
            </View>
            <View style={{ backgroundColor: currentTier.colour + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: currentTier.colour, fontSize: 11, fontWeight: "800" }}>{currentPoints} pts</Text>
            </View>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.52)", fontSize: 13, marginBottom: 10 }}>
            {nextTier ? `${pointsToNext} pts to unlock ${nextTier.name}` : "You’ve reached the top tier. Enjoy your unlocked venue rewards."}
          </Text>
          <View style={{ height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 10 }}>
            <View style={{ width: `${Math.max(Math.min(tierProgress * 100, 100), 6)}%`, height: "100%", backgroundColor: currentTier.colour, borderRadius: 999 }} />
          </View>
          <Text style={{ color: YELLOW, fontSize: 12, fontWeight: "700" }}>
            View rewards and your full card
          </Text>
        </TouchableOpacity>

        {/* ── Near You ──────────────────────────────────── */}
        {(nearbyOffers.length > 0 || nearbyState === "denied" || nearbyState === "unavailable") && (
          <View style={{ marginTop: 28 }}>
            <SectionHeader
              icon="location"
              title="Rewards Near You"
              actionLabel="View All"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(customer)/venues");
              }}
            />
            {nearbyOffers.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                {nearbyOffers.map((offer, index) => {
                  const dist = (offer.distanceKm ?? 0) < 1
                    ? `${Math.round((offer.distanceKm ?? 0) * 1000)}m`
                    : `${(offer.distanceKm ?? 0).toFixed(1)}km`;
                  return (
                    <TouchableOpacity
                      key={`${offer.venueId}-${index}`}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/(customer)/venue/${offer.venueId}` as any); }}
                      style={{
                        width: 224, backgroundColor: "white", borderRadius: 22, overflow: "hidden",
                        shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
                      }}
                    >
                      {offer.img ? (
                        <Image source={{ uri: offer.img }} style={{ width: "100%", height: 110 }} resizeMode="cover" />
                      ) : (
                        <View style={{ width: "100%", height: 110, backgroundColor: "rgba(15,0,50,0.08)", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="storefront-outline" size={28} color="rgba(15,0,50,0.2)" />
                        </View>
                      )}
                      <View style={{ position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.64)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>{dist}</Text>
                      </View>
                    <View style={{ padding: 14 }}>
                        <View style={{ alignSelf: "flex-start", backgroundColor: offer.featured ? YELLOW : YELLOW + "22", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, marginBottom: 8 }}>
                          <Text style={{ color: NAV, fontWeight: "800", fontSize: 10, letterSpacing: 0.6 }}>{offer.featured ? "HU NOW PICK" : "AVAILABLE NOW"}</Text>
                        </View>
                      <Text style={{ color: "rgba(15,0,50,0.58)", fontWeight: "700", fontSize: 12, marginBottom: 6 }} numberOfLines={1}>
                        {offer.venueName}
                      </Text>
                      <Text style={{ color: NAV, fontWeight: "800", fontSize: 15, lineHeight: 19 }} numberOfLines={2}>
                        {decodeHtml(offer.offerTitle)}
                      </Text>
                      <Text style={{ color: "rgba(15,0,50,0.46)", fontSize: 11, marginTop: 6 }} numberOfLines={1}>
                        Earn 35pts
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              </ScrollView>
            ) : (
              <View style={{ paddingHorizontal: 20 }}>
                <View style={{ backgroundColor: SURFACE, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: BORDER }}>
                  <Text style={{ color: "white", fontSize: 15, fontWeight: "800", marginBottom: 4 }}>
                    {nearbyState === "denied" ? "Turn on location to see nearby rewards" : "Nearby rewards are unavailable right now"}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.46)", fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
                    {nearbyState === "denied"
                      ? "You can still browse every live HU NOW reward across the city."
                      : "You can still explore all current offers while we load venue distances again."}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(customer)/venues")}
                    style={{ alignSelf: "flex-start", backgroundColor: YELLOW, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}
                  >
                    <Text style={{ color: NAV, fontSize: 12, fontWeight: "800" }}>Browse All Offers</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Three Pillars: Offers → Events → News ─────── */}
        {/* ── Active Offers ─────────────────────────────── */}
        {showSkeleton ? (
          <View style={{ marginTop: 28 }}>
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <View style={{ width: 140, height: 20, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 6 }} />
            </View>
            <OfferCardSkeleton count={3} />
          </View>
        ) : activeOffers.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <SectionHeader title="Active Offers" actionLabel="View All" onPress={() => router.push("/(customer)/venues")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {activeOffers.map((offer, index) => (
                <TouchableOpacity
                  key={`${offer.venueId}-${index}`}
                  onPress={() => router.push(`/(customer)/venue/${offer.venueId}` as any)}
                  style={{
                    width: 224,
                    height: 154,
                    backgroundColor: "white",
                    borderRadius: 22,
                    overflow: "hidden",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.18,
                    shadowRadius: 10,
                    elevation: 5,
                  }}
                >
                  {/* Image top half */}
                  <View style={{ position: "relative", height: 82 }}>
                    {offer.img ? (
                      <Image source={{ uri: offer.img }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: "100%", height: "100%", backgroundColor: NAV, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="pricetag-outline" size={22} color={YELLOW} />
                      </View>
                    )}
                    {/* Yellow OFFER pill overlay */}
                    <View style={{
                      position: "absolute", top: 10, left: 10,
                      backgroundColor: offer.featured ? "#F59E0B" : YELLOW, borderRadius: 999,
                      paddingHorizontal: 9, paddingVertical: 5,
                    }}>
                      <Text style={{ color: NAV, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }}>{offer.featured ? "HU NOW PICK" : "STANDARD"}</Text>
                    </View>
                  </View>

                  {/* Text bottom half */}
                  <View style={{ paddingHorizontal: 12, paddingVertical: 12, flex: 1, justifyContent: "center" }}>
                    <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 11, fontWeight: "700", marginBottom: 6 }} numberOfLines={1}>
                      {offer.venueName}
                    </Text>
                    <Text style={{ color: NAV, fontWeight: "800", fontSize: 14, lineHeight: 18 }} numberOfLines={2}>
                      {offer.offerTitle}
                    </Text>
                    <Text style={{ color: "rgba(15,0,50,0.46)", fontSize: 11, marginTop: 6 }} numberOfLines={1}>
                      Earn 35pts
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Events ────────────────────────────────────── */}
        {events.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <SectionHeader title="Events" actionLabel="View All" onPress={() => router.push("/(customer)/events")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {events.map((event) => {
                const img  = getFeaturedImage(event);
                const date = event.acf?.event_date ? parseEventDate(event.acf.event_date) : null;
                return (
                  <TouchableOpacity
                    key={event.id}
                    onPress={() => router.push(`/(customer)/event/${event.id}` as any)}
                    style={{
                      width: 224, backgroundColor: "white", borderRadius: 22, overflow: "hidden",
                      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: "100%", height: 132 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: "100%", height: 132, backgroundColor: YELLOW + "33", alignItems: "center", justifyContent: "center" }}>
                        {date ? (
                          <View style={{ alignItems: "center" }}>
                            <Text style={{ color: NAV, fontWeight: "900", fontSize: 28, lineHeight: 30 }}>{date.getDate()}</Text>
                            <Text style={{ color: NAV, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
                              {date.toLocaleDateString("en-GB", { month: "short" })}
                            </Text>
                          </View>
                        ) : (
                          <Ionicons name="calendar-outline" size={32} color={NAV} />
                        )}
                      </View>
                    )}
                    <View style={{ padding: 14 }}>
                      <Text style={{ color: NAV, fontWeight: "800", fontSize: 15, lineHeight: 19 }} numberOfLines={2}>
                        {decodeHtml(event.title.rendered)}
                      </Text>
                      {date && (
                        <Text style={{ color: "rgba(15,0,50,0.48)", fontSize: 12, marginTop: 5, fontWeight: "700" }}>
                          {date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── News ──────────────────────────────────────── */}
        {news.length > 0 && (
          <View style={{ marginTop: 28, marginBottom: 16 }}>
            <SectionHeader title="News" actionLabel="View All" onPress={() => router.push("/(customer)/news" as any)} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {news.map((post) => {
                const img = getFeaturedImage(post as any);
                return (
                  <TouchableOpacity
                    key={post.id}
                    activeOpacity={0.88}
                    onPress={() => router.push(`/(customer)/post/${post.id}` as any)}
                    style={{
                      width: 224, backgroundColor: "white", borderRadius: 22,
                      overflow: "hidden",
                      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: "100%", height: 132 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: "100%", height: 132, backgroundColor: "rgba(15,0,50,0.06)", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="newspaper-outline" size={32} color="rgba(15,0,50,0.2)" />
                      </View>
                    )}
                    <View style={{ padding: 14 }}>
                      <Text style={{ color: "rgba(15,0,50,0.42)", fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
                        HU NOW News
                      </Text>
                      <Text style={{ color: NAV, fontWeight: "800", fontSize: 15, lineHeight: 20 }} numberOfLines={3}>
                        {decodeHtml(post.title.rendered)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
