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
import { wordpress, getFeaturedImage, type WPEvent, type WPPost, type WPEat } from "@/lib/wordpress";
import { decodeHtml, parseEventDate, getLatLng } from "@/lib/utils";
import { haversineKm } from "@/lib/haversine";
import { useAuth } from "@/context/AuthContext";
import { OfferCardSkeleton } from "@/components/OfferCardSkeleton";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

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
}

async function loadOffers(): Promise<ActiveOffer[]> {
  const venues = await wordpress.getEat({ page: 1, perPage: 100 });
  const result: ActiveOffer[] = [];
  for (const v of venues) {
    const offers =
      v.offers?.items?.filter((o) => o.title?.trim()) ??
      (v.acf?.offer_title ? [{ id: 1, title: v.acf.offer_title, description: "" }] : []);
    for (const o of offers) {
      result.push({
        venueId: v.id,
        venueName: decodeHtml(v.title.rendered),
        offerTitle: o.title,
        img: getFeaturedImage(v),
      });
    }
  }
  return result;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const CARD_W = width - 48;

  const [events, setEvents]     = useState<WPEvent[]>([]);
  const [news, setNews]         = useState<WPPost[]>([]);
  const [activeOffers, setActiveOffers] = useState<ActiveOffer[]>([]);
  const [nearbyVenues, setNearbyVenues] = useState<(WPEat & { distanceKm: number })[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const [wpEvents, wpNews, wpOffers] = await Promise.all([
      wordpress.getEvents({ perPage: 4 }),
      wordpress.getPosts({ perPage: 4 }).catch(() => [] as WPPost[]),
      loadOffers().catch(() => [] as ActiveOffer[]),
    ]);
    setEvents(wpEvents.slice(0, 4));
    setNews(wpNews);
    setActiveOffers(wpOffers);

    // Near You — non-blocking
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const allVenues = await wordpress.getEat({ page: 1, perPage: 100 });
        const withDist = allVenues
          .map((v) => {
            const coords = getLatLng(v.acf?.address);
            if (!coords) return null;
            return { ...v, distanceKm: haversineKm(loc.coords.latitude, loc.coords.longitude, coords.lat, coords.lng) };
          })
          .filter(Boolean) as (WPEat & { distanceKm: number })[];
        withDist.sort((a, b) => a.distanceKm - b.distanceKm);
        setNearbyVenues(withDist.slice(0, 4));
      }
    } catch {
      // Location denied or unavailable — hide section silently
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);
  function onRefresh() { setRefreshing(true); load(); }

  // Skeleton state — show header and nav instantly, skeleton for content sections
  const showSkeleton = loading;

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
                flex: 1, backgroundColor: "rgba(255,255,255,0.07)",
                borderRadius: 16, alignItems: "center", paddingVertical: 12,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
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

        {/* ── Near You ──────────────────────────────────── */}
        {nearbyVenues.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="location" size={16} color={YELLOW} />
                <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>NEAR YOU</Text>
              </View>
              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(customer)/venues"); }} style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: YELLOW, fontSize: 13, fontWeight: "600" }}>View All </Text>
                <Text style={{ color: YELLOW, fontSize: 13 }}>→</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {nearbyVenues.map((venue) => {
                const img = getFeaturedImage(venue);
                const dist = venue.distanceKm < 1
                  ? `${Math.round(venue.distanceKm * 1000)}m`
                  : `${venue.distanceKm.toFixed(1)}km`;
                return (
                  <TouchableOpacity
                    key={venue.id}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/(customer)/venue/${venue.id}` as any); }}
                    style={{
                      width: 190, backgroundColor: "white", borderRadius: 16, overflow: "hidden",
                      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: "100%", height: 110 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: "100%", height: 110, backgroundColor: "rgba(15,0,50,0.08)", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="storefront-outline" size={28} color="rgba(15,0,50,0.2)" />
                      </View>
                    )}
                    {/* Distance badge */}
                    <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                      <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>{dist}</Text>
                    </View>
                    <View style={{ padding: 10 }}>
                      <Text style={{ color: NAV, fontWeight: "700", fontSize: 13 }} numberOfLines={1}>
                        {decodeHtml(venue.title.rendered)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
            <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>ACTIVE OFFERS</Text>
              <TouchableOpacity onPress={() => router.push("/(customer)/venues")} style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: YELLOW, fontSize: 13, fontWeight: "600" }}>View All </Text>
                <Text style={{ color: YELLOW, fontSize: 13 }}>→</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {activeOffers.map((offer, index) => (
                <TouchableOpacity
                  key={`${offer.venueId}-${index}`}
                  onPress={() => router.push(`/(customer)/venue/${offer.venueId}` as any)}
                  style={{
                    width: 200,
                    height: 130,
                    backgroundColor: "white",
                    borderRadius: 16,
                    overflow: "hidden",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.18,
                    shadowRadius: 10,
                    elevation: 5,
                  }}
                >
                  {/* Image top half */}
                  <View style={{ position: "relative", height: 65 }}>
                    {offer.img ? (
                      <Image source={{ uri: offer.img }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: "100%", height: "100%", backgroundColor: NAV, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="pricetag-outline" size={22} color={YELLOW} />
                      </View>
                    )}
                    {/* Yellow OFFER pill overlay */}
                    <View style={{
                      position: "absolute", top: 7, left: 8,
                      backgroundColor: YELLOW, borderRadius: 8,
                      paddingHorizontal: 7, paddingVertical: 3,
                    }}>
                      <Text style={{ color: NAV, fontSize: 9, fontWeight: "800" }}>OFFER</Text>
                    </View>
                  </View>

                  {/* Text bottom half */}
                  <View style={{ padding: 8, flex: 1, justifyContent: "center" }}>
                    <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 10, fontWeight: "600", marginBottom: 2 }} numberOfLines={1}>
                      {offer.venueName}
                    </Text>
                    <Text style={{ color: NAV, fontWeight: "800", fontSize: 12, lineHeight: 15 }} numberOfLines={2}>
                      {offer.offerTitle}
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
            <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>EVENTS</Text>
              <TouchableOpacity onPress={() => router.push("/(customer)/events")} style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: YELLOW, fontSize: 13, fontWeight: "600" }}>View All </Text>
                <Text style={{ color: YELLOW, fontSize: 13 }}>→</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {events.map((event) => {
                const img  = getFeaturedImage(event);
                const date = event.acf?.event_date ? parseEventDate(event.acf.event_date) : null;
                return (
                  <TouchableOpacity
                    key={event.id}
                    onPress={() => router.push(`/(customer)/event/${event.id}` as any)}
                    style={{
                      width: 200, backgroundColor: "white", borderRadius: 16, overflow: "hidden",
                      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: "100%", height: 120 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: "100%", height: 120, backgroundColor: YELLOW + "33", alignItems: "center", justifyContent: "center" }}>
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
                    <View style={{ padding: 10 }}>
                      <Text style={{ color: NAV, fontWeight: "700", fontSize: 13 }} numberOfLines={2}>
                        {decodeHtml(event.title.rendered)}
                      </Text>
                      {date && (
                        <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 11, marginTop: 3 }}>
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
            <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>NEWS</Text>
              <TouchableOpacity onPress={() => router.push("/(customer)/news" as any)} style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: YELLOW, fontSize: 13, fontWeight: "600" }}>View All </Text>
                <Text style={{ color: YELLOW, fontSize: 13 }}>→</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {news.map((post) => {
                const img = getFeaturedImage(post as any);
                return (
                  <TouchableOpacity
                    key={post.id}
                    activeOpacity={0.88}
                    onPress={() => router.push(`/(customer)/post/${post.id}` as any)}
                    style={{
                      width: 220, backgroundColor: "white", borderRadius: 16,
                      overflow: "hidden",
                      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: "100%", height: 120 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: "100%", height: 120, backgroundColor: "rgba(15,0,50,0.06)", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="newspaper-outline" size={32} color="rgba(15,0,50,0.2)" />
                      </View>
                    )}
                    <View style={{ padding: 12 }}>
                      <Text style={{ color: NAV, fontWeight: "700", fontSize: 13, lineHeight: 17 }} numberOfLines={3}>
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
