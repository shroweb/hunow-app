import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Image, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { wordpress, getFeaturedImage, extractOffers, type WPEat } from "@/lib/wordpress";
import { decodeHtml } from "@/lib/utils";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

export default function VenuesScreen() {
  const [venues, setVenues] = useState<WPEat[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();
  const { width } = useWindowDimensions();

  const CARD_W = (width - 20 * 2 - 12) / 2; // 2 columns with 12px gap

  useEffect(() => { load(1); }, []);

  async function load(p: number, query = "") {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    const results = await wordpress.getEat({ page: p, search: query, perPage: 12 });
    if (p === 1) setVenues(results);
    else setVenues((prev) => [...prev, ...results]);
    setHasMore(results.length === 12);
    setPage(p);
    setLoading(false);
    setLoadingMore(false);
  }

  function handleSearch(text: string) {
    setSearch(text);
    load(1, text);
  }

  function hasOffers(item: WPEat): boolean {
    return !!(item.acf && Object.keys(item.acf).some(
      (k) => k.startsWith("offer_title_") && item.acf![k]
    ));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      {/* Yellow header bar */}
      <View style={{ backgroundColor: YELLOW, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 }}>
        <Text style={{ color: NAV, fontSize: 28, fontWeight: "900", letterSpacing: -0.5 }}>EAT & DRINK</Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
        <View style={{
          flexDirection: "row", alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 8,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
        }}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={{ flex: 1, color: "white", fontSize: 14 }}
            placeholder="Search venues..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={YELLOW} />
        </View>
      ) : (
        <FlatList
          data={venues}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const img = getFeaturedImage(item);
            const offerBadge = hasOffers(item);
            return (
              <TouchableOpacity
                onPress={() => router.push(`/(customer)/venue/${item.id}`)}
                style={{
                  width: CARD_W,
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
                {/* Image */}
                <View style={{ position: "relative" }}>
                  {img ? (
                    <Image source={{ uri: img }} style={{ width: "100%", height: 110 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: "100%", height: 110, backgroundColor: "rgba(15,0,50,0.08)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="storefront-outline" size={32} color="rgba(15,0,50,0.2)" />
                    </View>
                  )}
                  {offerBadge && (
                    <View style={{
                      position: "absolute", top: 8, right: 8,
                      backgroundColor: YELLOW, borderRadius: 8,
                      paddingHorizontal: 7, paddingVertical: 3,
                    }}>
                      <Text style={{ color: NAV, fontSize: 10, fontWeight: "800" }}>OFFER</Text>
                    </View>
                  )}
                </View>

                {/* Info */}
                <View style={{ padding: 10 }}>
                  <Text style={{ color: NAV, fontWeight: "700", fontSize: 13, marginBottom: 2 }} numberOfLines={1}>
                    {decodeHtml(item.title.rendered)}
                  </Text>
                  {item.acf?.address ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Ionicons name="location" size={10} color={YELLOW} />
                      <Text style={{ color: "rgba(15,0,50,0.5)", fontSize: 11 }} numberOfLines={1}>
                        {item.acf.address as string}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            hasMore ? (
              <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
                <TouchableOpacity
                  style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, paddingVertical: 14, alignItems: "center" }}
                  onPress={() => load(page + 1, search)}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? <ActivityIndicator color={YELLOW} size="small" />
                    : <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" }}>Load more</Text>
                  }
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 48 }}>
              <Ionicons name="search-outline" size={40} color="rgba(255,255,255,0.15)" />
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, marginTop: 12 }}>No venues found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
