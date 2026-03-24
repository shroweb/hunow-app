import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { wordpress, getFeaturedImage, type WPEat, type WPEvent } from "@/lib/wordpress";
import { decodeHtml, stripHtml, parseEventDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [featured, setFeatured] = useState<WPEat[]>([]);
  const [events, setEvents] = useState<WPEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const [wpEat, wpEvents] = await Promise.all([
      wordpress.getEat({ perPage: 12 }),
      wordpress.getEvents({ perPage: 6 }),
    ]);

    setFeatured(wpEat.filter((v) => v.acf?.is_featured === "1"));
    setEvents(wpEvents.slice(0, 4));
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  function onRefresh() { setRefreshing(true); load(); }

  if (loading) {
    return (
      <View className="flex-1 bg-[#F5F5F7] items-center justify-center">
        <ActivityIndicator color="#0F0032" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F5F5F7]">
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F0032" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-5 pt-6 pb-2">
          <Text className="text-[#0F0032]/50 text-sm">{greeting()}</Text>
          <Text className="text-[#0F0032] text-3xl font-bold">
            {user?.display_name?.split(" ")[0] ?? "Welcome"}
          </Text>
        </View>

        {/* Featured Venues */}
        {featured.length > 0 && (
          <View className="mt-6 mb-2">
            <View className="px-5 flex-row items-center justify-between mb-3">
              <Text className="text-[#0F0032] font-bold text-lg">Featured Venues</Text>
              <TouchableOpacity onPress={() => router.push("/(customer)/venues")} className="flex-row items-center">
                <Text className="text-[#0F0032]/50 text-sm mr-1">See all</Text>
                <Ionicons name="chevron-forward" size={14} color="rgba(15,0,50,0.4)" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {featured.map((venue) => {
                const img = getFeaturedImage(venue);
                return (
                  <TouchableOpacity
                    key={venue.id}
                    style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}
                    className="bg-white rounded-2xl overflow-hidden w-52"
                    onPress={() => router.push(`/(customer)/venue/${venue.id}`)}
                  >
                    {img ? (
                      <Image source={{ uri: img }} className="w-full h-28" resizeMode="cover" />
                    ) : (
                      <View className="w-full h-28 bg-brand-navy/10 items-center justify-center">
                        <Ionicons name="storefront-outline" size={32} color="rgba(15,0,50,0.2)" />
                      </View>
                    )}
                    <View className="p-3">
                      <Text className="text-[#0F0032] font-semibold text-sm" numberOfLines={1}>
                        {decodeHtml(venue.title.rendered)}
                      </Text>
                      {venue.excerpt?.rendered ? (
                        <Text className="text-[#0F0032]/40 text-xs mt-0.5" numberOfLines={2}>
                          {stripHtml(venue.excerpt.rendered)}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* What's On */}
        {events.length > 0 && (
          <View className="mt-6 mb-8">
            <View className="px-5 flex-row items-center justify-between mb-3">
              <Text className="text-[#0F0032] font-bold text-lg">What's On</Text>
              <TouchableOpacity onPress={() => router.push("/(customer)/events")} className="flex-row items-center">
                <Text className="text-[#0F0032]/50 text-sm mr-1">See all</Text>
                <Ionicons name="chevron-forward" size={14} color="rgba(15,0,50,0.4)" />
              </TouchableOpacity>
            </View>
            <View className="px-5 gap-3">
              {events.map((event) => {
                const img = getFeaturedImage(event);
                const date = event.acf?.event_date ? parseEventDate(event.acf.event_date) : null;
                return (
                  <View
                    key={event.id}
                    style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
                    className="bg-white rounded-2xl overflow-hidden flex-row"
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: 80, height: 80 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: 80, height: 80 }} className="bg-brand-yellow/20 items-center justify-center">
                        {date ? (
                          <View className="items-center">
                            <Text className="text-[#0F0032] font-black text-xl leading-tight">
                              {date.getDate()}
                            </Text>
                            <Text className="text-[#0F0032]/60 text-xs font-semibold uppercase">
                              {date.toLocaleDateString("en-GB", { month: "short" })}
                            </Text>
                          </View>
                        ) : (
                          <Ionicons name="calendar-outline" size={24} color="rgba(15,0,50,0.3)" />
                        )}
                      </View>
                    )}
                    <View className="flex-1 p-3 justify-center">
                      <Text className="text-[#0F0032] font-semibold text-sm" numberOfLines={2}>
                        {decodeHtml(event.title.rendered)}
                      </Text>
                      {date && (
                        <Text className="text-[#0F0032]/40 text-xs mt-1">
                          {date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" })}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
