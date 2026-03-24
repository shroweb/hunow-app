import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Image, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { wordpress, getFeaturedImage, type WPEat, type WPEvent, type WPPost } from "@/lib/wordpress";
import { decodeHtml, stripHtml, parseEventDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const CARD_W = width - 48;

  const [featured, setFeatured] = useState<WPEat[]>([]);
  const [events, setEvents]     = useState<WPEvent[]>([]);
  const [news, setNews]         = useState<WPPost[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const [wpEat, wpEvents, wpNews] = await Promise.all([
      wordpress.getEat({ perPage: 20 }),
      wordpress.getEvents({ perPage: 4 }),
      wordpress.getPosts({ perPage: 4 }).catch(() => [] as WPPost[]),
    ]);
    const featuredOnly = wpEat.filter((v) => v.acf?.is_featured);
    setFeatured(featuredOnly.length > 0 ? featuredOnly : wpEat.slice(0, 6));
    setEvents(wpEvents.slice(0, 4));
    setNews(wpNews);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);
  function onRefresh() { setRefreshing(true); load(); }

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

        {/* ── Featured Slider ────────────────────────────── */}
        {featured.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W + 12}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {featured.map((venue) => {
              const img = getFeaturedImage(venue);
              return (
                <TouchableOpacity
                  key={venue.id}
                  onPress={() => router.push(`/(customer)/venue/${venue.id}`)}
                  style={{
                    width: CARD_W, height: 220, borderRadius: 20, overflow: "hidden",
                    shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
                    borderWidth: 1, borderColor: "rgba(251,201,0,0.25)",
                  }}
                >
                  {img ? (
                    <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: "100%", height: "100%", backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="storefront-outline" size={48} color="rgba(255,255,255,0.15)" />
                    </View>
                  )}
                  {/* Dark gradient overlay */}
                  <View style={{
                    position: "absolute", bottom: 0, left: 0, right: 0, height: 120,
                    justifyContent: "flex-end",
                    backgroundColor: "rgba(8,0,22,0.7)",
                    paddingHorizontal: 16, paddingBottom: 16,
                  }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                      <View style={{ backgroundColor: YELLOW, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="star" size={9} color={NAV} />
                        <Text style={{ color: NAV, fontSize: 10, fontWeight: "800" }}>FEATURED</Text>
                      </View>
                    </View>
                    <Text style={{ color: "white", fontWeight: "800", fontSize: 17, lineHeight: 20 }} numberOfLines={1}>
                      {decodeHtml(venue.title.rendered)}
                    </Text>
                    {venue.excerpt?.rendered ? (
                      <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                        {stripHtml(venue.excerpt.rendered)}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── Quick Nav ─────────────────────────────────── */}
        <View style={{ flexDirection: "row", paddingHorizontal: 20, marginTop: 20, gap: 10 }}>
          {[
            { label: "Eat & Drink", icon: "restaurant-outline" as const,  route: "/(customer)/venues" },
            { label: "Events",      icon: "calendar-outline"   as const,  route: "/(customer)/events" },
            { label: "My Card",     icon: "card-outline"       as const,  route: "/(customer)/card"   },
            { label: "Profile",     icon: "person-outline"     as const,  route: "/(customer)/profile" },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.route as any)}
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

        {/* ── News ──────────────────────────────────────── */}
        {news.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>NEWS</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: YELLOW, fontSize: 13, fontWeight: "600" }}>View All </Text>
                <Text style={{ color: YELLOW, fontSize: 13 }}>→</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {news.map((post) => {
                const img = getFeaturedImage(post as any);
                return (
                  <View
                    key={post.id}
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
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Events ────────────────────────────────────── */}
        {events.length > 0 && (
          <View style={{ marginTop: 28, marginBottom: 16 }}>
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
                    onPress={() => router.push(`/(customer)/events` as any)}
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

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
