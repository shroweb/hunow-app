import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Image, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import RenderHtml from "react-native-render-html";
import { wordpress, getFeaturedImage, type WPPost } from "@/lib/wordpress";
import { decodeHtml } from "@/lib/utils";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

// Styled HTML tag overrides so WP content looks good on the dark background
const htmlTagStyles = {
  body: { color: "rgba(255,255,255,0.80)", fontSize: 15, lineHeight: 24 },
  p:    { marginBottom: 16, marginTop: 0 },
  h1:   { color: "#ffffff", fontSize: 22, fontWeight: "900" as const, marginBottom: 12, marginTop: 20 },
  h2:   { color: "#ffffff", fontSize: 19, fontWeight: "800" as const, marginBottom: 10, marginTop: 18 },
  h3:   { color: "#ffffff", fontSize: 17, fontWeight: "800" as const, marginBottom: 8,  marginTop: 16 },
  h4:   { color: "#ffffff", fontSize: 15, fontWeight: "700" as const, marginBottom: 6,  marginTop: 14 },
  strong: { color: "#ffffff", fontWeight: "700" as const },
  em:   { fontStyle: "italic" as const },
  a:    { color: YELLOW, textDecorationLine: "underline" as const },
  ul:   { marginBottom: 12 },
  ol:   { marginBottom: 12 },
  li:   { color: "rgba(255,255,255,0.80)", fontSize: 15, marginBottom: 6 },
  blockquote: {
    borderLeftColor: YELLOW, borderLeftWidth: 3,
    paddingLeft: 14, marginLeft: 0, marginBottom: 16,
    opacity: 0.8,
  },
  hr: { backgroundColor: "rgba(255,255,255,0.1)", height: 1, marginVertical: 20 },
};

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [post, setPost] = useState<WPPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    wordpress.getPostById(Number(id))
      .then((data) => { setPost(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: NAV, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={YELLOW} />
      </View>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NAV, paddingHorizontal: 20 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="chevron-back" size={20} color="white" />
          <Text style={{ color: "white", fontSize: 14, marginLeft: 4 }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, textAlign: "center", marginTop: 80 }}>Post not found</Text>
      </SafeAreaView>
    );
  }

  const img = getFeaturedImage(post as any);
  const publishDate = new Date(post.date).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const htmlSource = post.content?.rendered || post.excerpt?.rendered || "";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={{ position: "relative" }}>
          {img ? (
            <Image source={{ uri: img }} style={{ width: "100%", height: 260 }} resizeMode="cover" />
          ) : (
            <View style={{ width: "100%", height: 160, backgroundColor: "#1a0052", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="newspaper" size={52} color={YELLOW} />
            </View>
          )}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              position: "absolute", top: 16, left: 16,
              backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20,
              width: 36, height: 36, alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={20} color="white" />
          </TouchableOpacity>
          {img && (
            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, backgroundColor: "rgba(15,0,50,0.6)" }} />
          )}
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 48 }}>

          {/* Date */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <Ionicons name="calendar-outline" size={13} color={YELLOW} />
            <Text style={{ color: YELLOW, fontSize: 12, fontWeight: "700" }}>{publishDate}</Text>
          </View>

          {/* Title */}
          <Text style={{ color: "white", fontSize: 24, fontWeight: "900", letterSpacing: -0.5, lineHeight: 30, marginBottom: 24 }}>
            {decodeHtml(post.title.rendered)}
          </Text>

          {/* Rendered HTML content */}
          {htmlSource ? (
            <RenderHtml
              contentWidth={width - 40}
              source={{ html: htmlSource }}
              tagsStyles={htmlTagStyles}
              baseStyle={{ color: "rgba(255,255,255,0.80)", fontSize: 15, lineHeight: 24 }}
              enableExperimentalMarginCollapsing
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
