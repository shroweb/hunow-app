import { useEffect, useState } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { wordpress, getFeaturedImage, type WPPost } from "@/lib/wordpress";
import { decodeHtml, stripHtml } from "@/lib/utils";
import { Skeleton } from "@/components/Skeleton";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

function formatNewsDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getExcerpt(post: WPPost) {
  return stripHtml(post.excerpt?.rendered ?? "").trim();
}

export default function NewsScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<WPPost[]>([]);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(1); }, []);
  useEffect(() => {
    wordpress.getSiteBrand().then((brand) => setBrandLogo(brand.logo_url)).catch(() => {});
  }, []);

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

  const sortedPosts = [...posts].sort((a, b) => Number(Boolean(b.sticky)) - Number(Boolean(a.sticky)) || new Date(b.date).getTime() - new Date(a.date).getTime());
  const featuredPost = sortedPosts[0] ?? null;
  const remainingPosts = featuredPost ? sortedPosts.slice(1) : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        {brandLogo ? (
          <View style={{ width: 78, height: 24, overflow: "hidden", marginBottom: 10 }}>
            <Image
              source={{ uri: brandLogo }}
              style={{ width: 96, height: 24, marginLeft: -10 }}
              resizeMode="contain"
            />
          </View>
        ) : null}
        <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 }}>
          City Stories
        </Text>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900", letterSpacing: -0.5, marginBottom: 8 }}>
          News
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.52)", fontSize: 14, lineHeight: 20 }}>
          Updates, launches, and local stories from the HU NOW network.
        </Text>
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
          data={remainingPosts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} title="Loading..." titleColor="rgba(255,255,255,0.4)" />
          }
          ListHeaderComponent={
            featuredPost ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 10 }}>
                  Featured Story
                </Text>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/(customer)/post/${featuredPost.id}` as any); }}
                  style={{
                    backgroundColor: "white",
                    borderRadius: 24,
                    overflow: "hidden",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.18,
                    shadowRadius: 18,
                    elevation: 6,
                  }}
                >
                  {getFeaturedImage(featuredPost as any) ? (
                    <Image source={{ uri: getFeaturedImage(featuredPost as any)! }} style={{ width: "100%", height: 220 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: "100%", height: 160, backgroundColor: "#1a0052", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="newspaper" size={42} color={YELLOW} />
                    </View>
                  )}
                  <View style={{ position: "absolute", top: 14, left: 14, backgroundColor: YELLOW, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Text style={{ color: NAV, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }}>FEATURED</Text>
                  </View>
                  <View style={{ padding: 18 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                      <Ionicons name="calendar-outline" size={12} color={YELLOW} />
                      <Text style={{ color: "rgba(15,0,50,0.5)", fontSize: 11, fontWeight: "800" }}>{formatNewsDate(featuredPost.date)}</Text>
                    </View>
                    <Text style={{ color: NAV, fontWeight: "900", fontSize: 22, lineHeight: 28, marginBottom: 8 }}>
                      {decodeHtml(featuredPost.title.rendered)}
                    </Text>
                    {getExcerpt(featuredPost) ? (
                      <Text style={{ color: "rgba(15,0,50,0.62)", fontSize: 14, lineHeight: 21 }} numberOfLines={3}>
                        {getExcerpt(featuredPost)}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>

                {remainingPosts.length > 0 ? (
                  <Text style={{ color: "white", fontWeight: "800", fontSize: 19, marginTop: 22, marginBottom: 10 }}>
                    More Stories
                  </Text>
                ) : null}
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const img = getFeaturedImage(item as any);
            const date = formatNewsDate(item.date);
            const excerpt = getExcerpt(item);
            return (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/(customer)/post/${item.id}` as any); }}
                style={{
                  backgroundColor: "white",
                  borderRadius: 20,
                  overflow: "hidden",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 4,
                  flexDirection: "row",
                }}
              >
                {img ? (
                  <Image source={{ uri: img }} style={{ width: 126, height: "100%" }} resizeMode="cover" />
                ) : (
                  <View style={{ width: 126, minHeight: 138, backgroundColor: "#1a0052", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="newspaper" size={32} color={YELLOW} />
                  </View>
                )}
                <View style={{ flex: 1, padding: 16, justifyContent: "center" }}>
                  <Text style={{ color: "rgba(15,0,50,0.4)", fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                    HU NOW News
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 }}>
                    <Ionicons name="calendar-outline" size={12} color={YELLOW} />
                    <Text style={{ color: "rgba(15,0,50,0.48)", fontSize: 11, fontWeight: "800" }}>{date}</Text>
                  </View>
                  <Text style={{ color: NAV, fontWeight: "800", fontSize: 17, lineHeight: 23, marginBottom: excerpt ? 8 : 0 }} numberOfLines={2}>
                    {decodeHtml(item.title.rendered)}
                  </Text>
                  {excerpt ? (
                    <Text style={{ color: "rgba(15,0,50,0.58)", fontSize: 13, lineHeight: 19 }} numberOfLines={3}>
                      {excerpt}
                    </Text>
                  ) : null}
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
