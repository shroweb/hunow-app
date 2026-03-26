import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Image, useWindowDimensions, ScrollView, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { wordpress, getFeaturedImage, extractOffers, type WPEat } from "@/lib/wordpress";
import { decodeHtml, getDisplayAddress, getTodayOpeningHours, getTodayOpeningStatus, getSearchableText } from "@/lib/utils";
import { VenueCardSkeleton } from "@/components/VenueCardSkeleton";
import { HUNowPickBadge } from "@/components/HUNowPickBadge";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const SURFACE = "rgba(255,255,255,0.07)";
const BORDER = "rgba(255,255,255,0.1)";
const BRAND_LOGO_URL = "https://hunow.co.uk/wp-content/uploads/2025/02/Group-1-1.png";

interface Cuisine { id: number | null; name: string }

export default function VenuesScreen() {
  const [allVenues, setAllVenues] = useState<WPEat[]>([]);
  const [cuisines, setCuisines] = useState<Cuisine[]>([{ id: null, name: "All" }]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const CARD_W = (width - 20 * 2 - 14) / 2;

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [results, cats] = await Promise.all([
      wordpress.getEat({ page: 1, perPage: 100 }),
      wordpress.getCuisines().catch(() => [] as { id: number; name: string }[]),
    ]);
    const venuesWithOffers = results.filter(hasOffers);
    const availableCats = cats.filter((cat) => {
      const selectedName = cat.name.toLowerCase();
      return venuesWithOffers.some((venue) => {
        const cuisineType = getSearchableText(venue.acf?.cuisine_type);
        const category = getSearchableText(venue.acf?.category);
        return cuisineType.includes(selectedName) || category.includes(selectedName);
      });
    });
    setAllVenues(venuesWithOffers);
    setCuisines([{ id: null, name: "All" }, ...availableCats]);
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
      venues = venues.filter((v) => {
        const cuisineType = getSearchableText(v.acf?.cuisine_type);
        const category = getSearchableText(v.acf?.category);
        const selectedName = cuisines.find((c) => c.id === activeFilter)?.name.toLowerCase() ?? "";
        return cuisineType.includes(selectedName) || category.includes(selectedName);
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
          borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, gap: 8,
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
          numColumns={2}
          columnWrapperStyle={{ gap: 14, paddingHorizontal: 20 }}
          contentContainerStyle={{ paddingBottom: 110, gap: 14, paddingTop: 8 }}
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
                  width: CARD_W, backgroundColor: "white", borderRadius: 22, overflow: "hidden",
                  shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
                }}
              >
                <View style={{ position: "relative" }}>
                  {img ? (
                    <Image source={{ uri: img }} style={{ width: "100%", height: 122 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: "100%", height: 122, backgroundColor: "rgba(15,0,50,0.08)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="storefront-outline" size={32} color="rgba(15,0,50,0.2)" />
                    </View>
                  )}
                  <View style={{ position: "absolute", top: 10, left: 10 }}>
                    {featured ? <HUNowPickBadge /> : (
                      <View style={{ backgroundColor: YELLOW, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }}>
                        <Text style={{ color: NAV, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }}>STANDARD</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ position: "absolute", top: 10, right: 10, backgroundColor: "rgba(15,0,50,0.72)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 }}>
                    <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>{offerCount} {offerCount === 1 ? "offer" : "offers"}</Text>
                  </View>
                </View>

                <View style={{ padding: 13 }}>
                  <Text style={{ color: "rgba(15,0,50,0.58)", fontWeight: "700", fontSize: 12, marginBottom: 6 }} numberOfLines={1}>
                    {decodeHtml(item.title.rendered)}
                  </Text>
                  {firstOfferTitle ? (
                    <Text style={{ color: NAV, fontSize: 15, fontWeight: "800", lineHeight: 19, marginBottom: 6 }} numberOfLines={2}>
                      {decodeHtml(String(firstOfferTitle))}
                    </Text>
                  ) : null}
                  <Text style={{ color: "rgba(15,0,50,0.46)", fontSize: 11, marginBottom: 2 }} numberOfLines={1}>
                    {offerCount > 1 ? `${offerCount} offers • Earn 35pts` : "Earn 35pts"}
                  </Text>
                  {(location || todayHours || todayStatus) ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                      {location ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "58%" }}>
                          <Ionicons name="location-outline" size={11} color="rgba(15,0,50,0.4)" />
                          <Text style={{ color: "rgba(15,0,50,0.48)", fontSize: 11, flexShrink: 1 }} numberOfLines={1}>
                            {location}
                          </Text>
                        </View>
                      ) : null}
                      {todayStatus ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "42%" }}>
                          <Ionicons name={todayStatus.isOpen ? "checkmark-circle-outline" : "time-outline"} size={11} color={todayStatus.isOpen ? "#15803D" : "#B45309"} />
                          <Text style={{ color: todayStatus.isOpen ? "#15803D" : "#B45309", fontSize: 11, fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>
                            {todayStatus.label}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
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
            <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
              <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 12 }}>
                {filtered.length} {filtered.length === 1 ? "venue" : "venues"} with active offers
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
