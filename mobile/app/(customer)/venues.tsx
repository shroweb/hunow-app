import { useEffect, useState } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { wordpress, getFeaturedImage, type WPEat } from "@/lib/wordpress";
import { decodeHtml, stripHtml } from "@/lib/utils";

export default function VenuesScreen() {
  const [venues, setVenues] = useState<WPEat[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();

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

  return (
    <SafeAreaView className="flex-1 bg-[#F5F5F7]">
      <View className="px-5 pt-6 pb-3">
        <Text className="text-[#0F0032] text-2xl font-bold mb-4">Venues</Text>
        <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 gap-2"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
        >
          <Ionicons name="search" size={16} color="rgba(15,0,50,0.35)" />
          <TextInput
            className="flex-1 text-[#0F0032] text-sm"
            placeholder="Search venues..."
            placeholderTextColor="rgba(15,0,50,0.35)"
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={16} color="rgba(15,0,50,0.3)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0F0032" />
        </View>
      ) : (
        <FlatList
          data={venues}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const img = getFeaturedImage(item);
            return (
              <TouchableOpacity
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 }}
                className="bg-white rounded-2xl overflow-hidden flex-row"
                onPress={() => router.push(`/(customer)/venue/${item.id}`)}
              >
                {img ? (
                  <Image source={{ uri: img }} style={{ width: 88, height: 88 }} resizeMode="cover" />
                ) : (
                  <View style={{ width: 88, height: 88 }} className="bg-[#0F0032]/5 items-center justify-center">
                    <Ionicons name="storefront-outline" size={28} color="rgba(15,0,50,0.2)" />
                  </View>
                )}
                <View className="flex-1 p-3 justify-center">
                  <Text className="text-[#0F0032] font-semibold text-sm" numberOfLines={1}>
                    {decodeHtml(item.title.rendered)}
                  </Text>
                  {item.excerpt?.rendered ? (
                    <Text className="text-[#0F0032]/50 text-xs mt-1" numberOfLines={2}>
                      {stripHtml(item.excerpt.rendered)}
                    </Text>
                  ) : null}
                  {item.acf?.is_featured === "1" && (
                    <View className="mt-2 self-start bg-brand-yellow/20 rounded-full px-2 py-0.5">
                      <Text className="text-[#0F0032] text-xs font-semibold">Featured</Text>
                    </View>
                  )}
                </View>
                <View className="items-center justify-center pr-3">
                  <Ionicons name="chevron-forward" size={16} color="rgba(15,0,50,0.2)" />
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                className="bg-white rounded-2xl py-4 items-center mt-2"
                onPress={() => load(page + 1, search)}
                disabled={loadingMore}
              >
                {loadingMore
                  ? <ActivityIndicator color="#0F0032" size="small" />
                  : <Text className="text-[#0F0032]/50 text-sm font-medium">Load more</Text>
                }
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center mt-12">
              <Ionicons name="search-outline" size={40} color="rgba(15,0,50,0.15)" />
              <Text className="text-[#0F0032]/30 text-sm mt-3">No venues found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
