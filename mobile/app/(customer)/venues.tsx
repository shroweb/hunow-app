import { useEffect, useState } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { wordpress, type WPEat } from "@/lib/wordpress";

export default function VenuesScreen() {
  const [venues, setVenues] = useState<WPEat[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();

  useEffect(() => {
    load(1);
  }, []);

  async function load(p: number, query = "") {
    setLoading(true);
    const results = await wordpress.getEat({ page: p, search: query, perPage: 12 });
    if (p === 1) {
      setVenues(results);
    } else {
      setVenues((prev) => [...prev, ...results]);
    }
    setHasMore(results.length === 12);
    setPage(p);
    setLoading(false);
  }

  function handleSearch(text: string) {
    setSearch(text);
    load(1, text);
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-navy">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold mb-4">Venues</Text>
        <TextInput
          className="bg-white/10 text-white rounded-xl px-4 py-3 border border-white/20 mb-2"
          placeholder="Search venues..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={search}
          onChangeText={handleSearch}
        />
      </View>

      <FlatList
        data={venues}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-white/10 border border-white/20 rounded-2xl p-4 mb-3"
            onPress={() => router.push(`/(customer)/venue/${item.id}`)}
          >
            <Text className="text-white font-semibold text-base">{item.title.rendered}</Text>
            {item.excerpt?.rendered ? (
              <Text className="text-white/50 text-xs mt-1" numberOfLines={2}>
                {item.excerpt.rendered.replace(/<[^>]+>/g, "")}
              </Text>
            ) : null}
            {item.acf?.is_featured === "1" && (
              <View className="mt-2 self-start bg-brand-yellow/20 border border-brand-yellow/40 rounded-full px-2 py-0.5">
                <Text className="text-brand-yellow text-xs font-semibold">Featured</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity
              className="bg-white/10 rounded-xl py-3 items-center mt-2"
              onPress={() => load(page + 1, search)}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FBC900" /> : <Text className="text-white/60 text-sm">Load more</Text>}
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          !loading ? <Text className="text-white/40 text-sm text-center mt-8">No venues found</Text> : null
        }
      />
    </SafeAreaView>
  );
}
