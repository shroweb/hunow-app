import { useEffect, useState } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, Dimensions, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { wordpress, getFeaturedImage, type WPEvent } from "@/lib/wordpress";
import { decodeHtml, parseEventDate } from "@/lib/utils";
import { VenueCardSkeleton } from "@/components/VenueCardSkeleton";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const CARD_GAP = 10;
const SIDE_PAD = 16;
const CARD_W = (Dimensions.get("window").width - SIDE_PAD * 2 - CARD_GAP) / 2;

export default function EventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<WPEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await wordpress.getEvents({ perPage: 20 });
    setEvents(data);
    setLoading(false);
    setRefreshing(false);
  }

  function onRefresh() { setRefreshing(true); load(); }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <View style={{ backgroundColor: YELLOW, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 }}>
        <Text style={{ color: NAV, fontSize: 28, fontWeight: "900", letterSpacing: -0.5 }}>EVENTS</Text>
      </View>

      {loading ? (
        <VenueCardSkeleton count={6} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: CARD_GAP, paddingHorizontal: SIDE_PAD }}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 110, gap: CARD_GAP }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} title="Loading..." titleColor="rgba(255,255,255,0.4)" />
          }
          renderItem={({ item }) => {
            const img = getFeaturedImage(item);
            const date = item.acf?.event_date ? parseEventDate(item.acf.event_date) : null;
            return (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/(customer)/event/${item.id}` as any); }}
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
                {/* Image — placeholder gradient if none */}
                {img ? (
                  <Image source={{ uri: img }} style={{ width: "100%", height: 110 }} resizeMode="cover" />
                ) : (
                  <View style={{ width: "100%", height: 110, backgroundColor: "#1a0052", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="calendar" size={32} color={YELLOW} />
                  </View>
                )}

                {/* Date badge overlay */}
                {date && (
                  <View style={{
                    position: "absolute", top: 8, left: 8,
                    backgroundColor: YELLOW, borderRadius: 8,
                    paddingHorizontal: 8, paddingVertical: 4,
                    alignItems: "center",
                  }}>
                    <Text style={{ color: NAV, fontWeight: "900", fontSize: 16, lineHeight: 18 }}>{date.getDate()}</Text>
                    <Text style={{ color: NAV, fontSize: 9, fontWeight: "700", textTransform: "uppercase" }}>
                      {date.toLocaleDateString("en-GB", { month: "short" })}
                    </Text>
                  </View>
                )}

                <View style={{ padding: 10 }}>
                  <Text style={{ color: NAV, fontWeight: "700", fontSize: 13, lineHeight: 17 }} numberOfLines={2}>
                    {decodeHtml(item.title.rendered)}
                  </Text>
                  {date && (
                    <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 11, marginTop: 4 }} numberOfLines={1}>
                      {date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 48 }}>
              <Ionicons name="calendar-outline" size={40} color="rgba(255,255,255,0.15)" />
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, marginTop: 12 }}>No upcoming events</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
