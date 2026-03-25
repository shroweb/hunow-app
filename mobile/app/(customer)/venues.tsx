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
import { decodeHtml, getDisplayAddress } from "@/lib/utils";
import { VenueCardSkeleton } from "@/components/VenueCardSkeleton";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

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
  const CARD_W = (width - 20 * 2 - 12) / 2;

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [results, cats] = await Promise.all([
      wordpress.getEat({ page: 1, perPage: 100 }),
      wordpress.getCuisines().catch(() => [] as { id: number; name: string }[]),
    ]);
    setAllVenues(results.filter(hasOffers));
    setCuisines([{ id: null, name: "All" }, ...cats]);
    setLoading(false);
    setRefreshing(false);
  }

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
        const cuisineType = (v.acf?.cuisine_type as string | undefined)?.toLowerCase() ?? "";
        const category = (v.acf?.category as string | undefined)?.toLowerCase() ?? "";
        const selectedName = cuisines.find((c) => c.id === activeFilter)?.name.toLowerCase() ?? "";
        return cuisineType.includes(selectedName) || category.includes(selectedName);
      });
    }

    return venues;
  }

  const filtered = getFilteredVenues();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      {/* Yellow header */}
      <View style={{ backgroundColor: YELLOW, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 }}>
        <Text style={{ color: NAV, fontSize: 28, fontWeight: "900", letterSpacing: -0.5 }}>OFFERS</Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 }}>
        <View style={{
          flexDirection: "row", alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 8,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
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
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: active ? YELLOW : "rgba(255,255,255,0.1)",
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
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
          contentContainerStyle={{ paddingBottom: 110, gap: 12 }}
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
            const firstOfferTitle = item.offers?.items?.[0]?.title ?? item.acf?.offer_title ?? null;
            const offerCount = offers.length;

            return (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/(customer)/venue/${item.id}`);
                }}
                style={{
                  width: CARD_W, backgroundColor: "white", borderRadius: 16, overflow: "hidden",
                  shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
                }}
              >
                <View style={{ position: "relative" }}>
                  {img ? (
                    <Image source={{ uri: img }} style={{ width: "100%", height: 110 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: "100%", height: 110, backgroundColor: "rgba(15,0,50,0.08)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="storefront-outline" size={32} color="rgba(15,0,50,0.2)" />
                    </View>
                  )}
                  <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: YELLOW, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ color: NAV, fontSize: 10, fontWeight: "800" }}>OFFER</Text>
                  </View>
                </View>

                <View style={{ padding: 10 }}>
                  <Text style={{ color: NAV, fontWeight: "700", fontSize: 13, marginBottom: 3 }} numberOfLines={1}>
                    {decodeHtml(item.title.rendered)}
                  </Text>
                  {firstOfferTitle ? (
                    <Text style={{ color: YELLOW, fontSize: 11, fontStyle: "italic", fontWeight: "600", marginBottom: 3 }} numberOfLines={1}>
                      {decodeHtml(String(firstOfferTitle))}
                    </Text>
                  ) : null}
                  <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 10, marginBottom: 4 }} numberOfLines={1}>
                    {offerCount > 1 ? `${offerCount} offers • Earn 35pts each` : "Earn 35pts"}
                  </Text>
                  {getDisplayAddress(item.acf?.address) ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Ionicons name="location" size={10} color={YELLOW} />
                      <Text style={{ color: "rgba(15,0,50,0.5)", fontSize: 11 }} numberOfLines={1}>
                        {getDisplayAddress(item.acf?.address)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 48 }}>
              <Ionicons name="pricetag-outline" size={40} color="rgba(255,255,255,0.15)" />
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, marginTop: 12 }}>No offers found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
