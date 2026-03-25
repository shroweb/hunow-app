import { useEffect, useState } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { wordpress, getFeaturedImage, type WPPost } from "@/lib/wordpress";
import { decodeHtml } from "@/lib/utils";
import { Skeleton } from "@/components/Skeleton";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

export default function NewsScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<WPPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(1); }, []);

  async function load(p: number) {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    const results = await wordpress.getPosts({ page: p, perPage: 10 });
    if (p === 1) setPosts(results); else setPosts((prev) => [...prev, ...results]);
    setHasMore(results.length === 10);
    setPage(p);
    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
  }

  function onRefresh() { setRefreshing(true); load(1); }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <View style={{ backgroundColor: YELLOW, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 }}>
        <Text style={{ color: NAV, fontSize: 28, fontWeight: "900", letterSpacing: -0.5 }}>NEWS</Text>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0,1,2,3].map((i) => (
            <View key={i} style={{ borderRadius: 18, overflow: "hidden" }}>
              <Skeleton width="100%" height={180} borderRadius={0} />
              <View style={{ backgroundColor: "rgba(255,255,255,0.05)", padding: 16, gap: 8 }}>
                <Skeleton width={100} height={11} borderRadius={5} />
                <Skeleton width="85%" height={16} borderRadius={6} />
                <Skeleton width="60%" height={16} borderRadius={6} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} title="Loading..." titleColor="rgba(255,255,255,0.4)" />
          }
          renderItem={({ item }) => {
            const img = getFeaturedImage(item as any);
            const date = new Date(item.date).toLocaleDateString("en-GB", {
              day: "numeric", month: "long", year: "numeric",
            });
            return (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/(customer)/post/${item.id}` as any); }}
                style={{
                  backgroundColor: "white", borderRadius: 18, overflow: "hidden",
                  shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
                }}
              >
                {img ? (
                  <Image source={{ uri: img }} style={{ width: "100%", height: 180 }} resizeMode="cover" />
                ) : (
                  <View style={{ width: "100%", height: 120, backgroundColor: "#1a0052", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="newspaper" size={40} color={YELLOW} />
                  </View>
                )}
                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 }}>
                    <Ionicons name="calendar-outline" size={12} color={YELLOW} />
                    <Text style={{ color: YELLOW, fontSize: 11, fontWeight: "700" }}>{date}</Text>
                  </View>
                  <Text style={{ color: NAV, fontWeight: "800", fontSize: 16, lineHeight: 22 }} numberOfLines={2}>
                    {decodeHtml(item.title.rendered)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16,
                  paddingVertical: 14, alignItems: "center", marginTop: 4,
                }}
                onPress={() => load(page + 1)}
                disabled={loadingMore}
              >
                {loadingMore
                  ? <ActivityIndicator color={YELLOW} size="small" />
                  : <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" }}>Load more</Text>
                }
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 48 }}>
              <Ionicons name="newspaper-outline" size={40} color="rgba(255,255,255,0.15)" />
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, marginTop: 12 }}>No news yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
