import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Image, ScrollView, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { wordpress, getFeaturedImage, extractOffers, type WPEat } from "@/lib/wordpress";
import { decodeHtml, getDisplayAddress, getTodayOpeningHours, getTodayOpeningStatus } from "@/lib/utils";
import { VenueCardSkeleton } from "@/components/VenueCardSkeleton";
import { HUNowPickBadge } from "@/components/HUNowPickBadge";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const SURFACE = "rgba(255,255,255,0.07)";
const BORDER = "rgba(255,255,255,0.1)";
const BRAND_LOGO_URL = "https://hunow.co.uk/wp-content/uploads/2025/02/Group-1-1.png";

interface Cuisine { id: number | null; name: string; venueIds?: number[] }

export default function VenuesScreen() {
  const [allVenues, setAllVenues] = useState<WPEat[]>([]);
  const [cuisines, setCuisines] = useState<Cuisine[]>([{ id: null, name: "All" }]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<number | string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const results = await wordpress.getEat({ page: 1, perPage: 100 });
    const venuesWithOffers = results.filter(hasOffers);
    const filterMap = new Map<number, Cuisine>();

    venuesWithOffers.forEach((venue) => {
      (venue.filters ?? []).forEach((filter) => {
        const existing = filterMap.get(filter.id);
        if (existing) {
          existing.venueIds = Array.from(new Set([...(existing.venueIds ?? []), venue.id]));
        } else {
          filterMap.set(filter.id, {
            id: filter.id,
            name: filter.name,
            venueIds: [venue.id],
          });
        }
      });
    });

    const availableCats = Array.from(filterMap.values())
      .filter((cat) => (cat.venueIds?.length ?? 0) > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    setAllVenues(venuesWithOffers);
    setCuisines([{ id: null, name: "All", venueIds: venuesWithOffers.map((venue) => venue.id) }, ...availableCats]);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    if (activeFilter !== null && !cuisines.some((c) => c.id === activeFilter)) {
      setActiveFilter(null);
    }
  }, [activeFilter, cuisines]);

  function onRefresh() { setRefreshing(true); load(); }

  function hasOffers(item: WPEat): boolean {
    if (item.offers?.items?.some((o) => o.title?.trim())) return true;
    return !!(item.acf?.offer_title?.trim());
  }

  function getFilteredVenues(): WPEat[] {
    let venues = allVenues;

    if (search.trim()) {
      const q = search.toLowerCase();
      venues = venues.filter((v) => decodeHtml(v.title.rendered).toLowerCase().includes(q));
    }

    if (activeFilter !== null) {
      const selectedCuisine = cuisines.find((c) => c.id === activeFilter);
      const allowedVenueIds = new Set(selectedCuisine?.venueIds ?? []);
      venues = venues.filter((v) => {
        return allowedVenueIds.has(v.id);
      });
    }

    return venues;
  }

  const filtered = getFilteredVenues();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 }}>
          Browse Rewards
        </Text>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900", letterSpacing: -0.5, marginBottom: 8 }}>
          Offers
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.52)", fontSize: 14, lineHeight: 20 }}>
          Explore active rewards across partner venues near you.
        </Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 }}>
        <View style={{
          flexDirection: "row", alignItems: "center",
          backgroundColor: SURFACE,
          borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, gap: 8,
          borderWidth: 1, borderColor: BORDER,
        }}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={{ flex: 1, color: "white", fontSize: 14 }}
            placeholder="Search offers..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter chips from API */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 6, gap: 8, alignItems: "center" }}
      >
        {cuisines.map((c) => {
          const active = activeFilter === c.id;
          return (
            <TouchableOpacity
              key={c.id ?? "all"}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveFilter(c.id); }}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                backgroundColor: active ? YELLOW : SURFACE,
                borderWidth: 1, borderColor: active ? YELLOW : "rgba(255,255,255,0.15)",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: active ? "800" : "600", color: active ? NAV : "rgba(255,255,255,0.7)" }}>
                {c.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <VenueCardSkeleton count={6} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 110, gap: 16, paddingTop: 8, paddingHorizontal: 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={YELLOW}
              title="Loading offers..."
              titleColor="rgba(255,255,255,0.4)"
            />
          }
          renderItem={({ item }) => {
            const img = getFeaturedImage(item);
            const offers = extractOffers(item);
            const firstOfferTitle = offers[0]?.title ?? item.acf?.offer_title ?? null;
            const offerCount = offers.length;
            const featured = Boolean(offers[0]?.featured);
            const location = getDisplayAddress(item.acf?.address);
            const todayHours = getTodayOpeningHours(item.acf?.opening_hours);
            const todayStatus = getTodayOpeningStatus(item.acf?.opening_hours);

            return (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/(customer)/venue/${item.id}`);
                }}
                style={{
                  backgroundColor: "white", borderRadius: 26, overflow: "hidden",
                  shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.18, shadowRadius: 14, elevation: 6,
                }}
              >
                <View style={{ position: "relative" }}>
                  {img ? (
                    <Image source={{ uri: img }} style={{ width: "100%", height: 176 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: "100%", height: 176, backgroundColor: "rgba(15,0,50,0.08)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="storefront-outline" size={32} color="rgba(15,0,50,0.2)" />
                    </View>
                  )}
                  <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 78, backgroundColor: "rgba(15,0,50,0.32)" }} />
                  <View style={{ position: "absolute", top: 10, left: 10 }}>
                    {featured ? <HUNowPickBadge /> : (
                      <View style={{ backgroundColor: YELLOW, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: NAV, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }}>STANDARD</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ position: "absolute", top: 10, right: 10, backgroundColor: "rgba(15,0,50,0.72)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>{offerCount} {offerCount === 1 ? "offer" : "offers"}</Text>
                  </View>
                  <View style={{ position: "absolute", left: 14, right: 14, bottom: 14 }}>
                    <Text style={{ color: "rgba(255,255,255,0.78)", fontWeight: "700", fontSize: 12, marginBottom: 4 }} numberOfLines={1}>
                      {decodeHtml(item.title.rendered)}
                    </Text>
                    {firstOfferTitle ? (
                      <Text style={{ color: "white", fontSize: 24, fontWeight: "900", lineHeight: 28 }} numberOfLines={2}>
                        {decodeHtml(String(firstOfferTitle))}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <View style={{ backgroundColor: "rgba(15,0,50,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ color: NAV, fontSize: 11, fontWeight: "800" }}>+35 pts</Text>
                    </View>
                    <View style={{ backgroundColor: "rgba(15,0,50,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ color: "rgba(15,0,50,0.6)", fontSize: 11, fontWeight: "700" }}>
                        {offerCount > 1 ? `${offerCount} live rewards` : "1 live reward"}
                      </Text>
                    </View>
                    {todayStatus ? (
                      <View style={{ backgroundColor: todayStatus.isOpen ? "rgba(21,128,61,0.12)" : "rgba(180,83,9,0.12)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: todayStatus.isOpen ? "#15803D" : "#B45309", fontSize: 11, fontWeight: "800" }}>
                          {todayStatus.label}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {(location || todayHours) ? (
                    <View style={{ gap: 8, marginBottom: 12 }}>
                      {location ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Ionicons name="location-outline" size={13} color="rgba(15,0,50,0.42)" />
                          <Text style={{ color: "rgba(15,0,50,0.54)", fontSize: 12, flex: 1 }} numberOfLines={1}>
                            {location}
                          </Text>
                        </View>
                      ) : null}
                      {todayHours ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Ionicons name="time-outline" size={13} color="rgba(15,0,50,0.42)" />
                          <Text style={{ color: "rgba(15,0,50,0.54)", fontSize: 12, flex: 1 }} numberOfLines={1}>
                            Today: {todayHours}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(15,0,50,0.08)" }}>
                    <Text style={{ color: NAV, fontSize: 12, fontWeight: "800" }}>View reward details</Text>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: YELLOW + "22", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="arrow-forward" size={15} color={NAV} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 44, marginHorizontal: 20, backgroundColor: SURFACE, borderRadius: 22, padding: 24, borderWidth: 1, borderColor: BORDER }}>
              <Image source={{ uri: BRAND_LOGO_URL }} style={{ width: 72, height: 34, marginLeft: -10, marginBottom: 12 }} resizeMode="contain" />
              <Text style={{ color: "white", fontSize: 16, fontWeight: "800", marginBottom: 6 }}>No offers found</Text>
              <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, textAlign: "center", lineHeight: 19 }}>
                Try another search or category to explore live HU NOW rewards across the city.
              </Text>
            </View>
          }
          ListHeaderComponent={
            <View style={{ paddingBottom: 12 }}>
              <View style={{ backgroundColor: SURFACE, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: BORDER }}>
                <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>
                  Live Rewards
                </Text>
                <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 6 }}>
                  {filtered.length} {filtered.length === 1 ? "venue" : "venues"} with active offers
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.48)", fontSize: 13, lineHeight: 19 }}>
                  Browse the latest venue rewards, opening status, and live redemption opportunities in one place.
                </Text>
              </View>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
