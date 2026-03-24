import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { wordpress, getFeaturedImage, type WPEat, type WPEvent } from "@/lib/wordpress";
import { decodeHtml, stripHtml, parseEventDate } from "@/lib/utils";

type Offer = {
  id: string;
  title: string;
  description: string | null;
  redemption_type: string;
  businesses: { name: string; wp_post_id: number | null } | null;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [featured, setFeatured] = useState<WPEat[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [events, setEvents] = useState<WPEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profile }, wpEat, wpEvents, { data: activeOffers }] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", user.id).single(),
      wordpress.getEat({ perPage: 12 }),
      wordpress.getEvents({ perPage: 6 }),
      supabase
        .from("offers")
        .select("id, title, description, redemption_type, businesses(name, wp_post_id)")
        .eq("is_active", true)
        .limit(10),
    ]);

    setUserName(profile?.name?.split(" ")[0] ?? "");
    setFeatured(wpEat.filter((v) => v.acf?.is_featured === "1"));
    setEvents(wpEvents.slice(0, 4));
    setOffers((activeOffers ?? []) as Offer[]);
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
          <Text className="text-[#0F0032] text-3xl font-bold">{userName || "Welcome"}</Text>
        </View>

        {/* Active Offers */}
        {offers.length > 0 && (
          <View className="mt-6 mb-2">
            <View className="px-5 flex-row items-center justify-between mb-3">
              <Text className="text-[#0F0032] font-bold text-lg">Active Offers</Text>
              <View className="bg-brand-yellow/20 rounded-full px-2 py-0.5">
                <Text className="text-[#0F0032] text-xs font-semibold">HU NOW exclusive</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {offers.map((offer) => (
                <TouchableOpacity
                  key={offer.id}
                  style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}
                  className="bg-white rounded-2xl overflow-hidden w-60"
                  onPress={() => offer.businesses?.wp_post_id
                    ? router.push(`/(customer)/venue/${offer.businesses.wp_post_id}`)
                    : null
                  }
                >
                  <View className="bg-brand-yellow h-1.5 w-full" />
                  <View className="p-4">
                    <Text className="text-[#0F0032] font-bold text-sm mb-1" numberOfLines={2}>
                      {decodeHtml(offer.title)}
                    </Text>
                    {offer.description && (
                      <Text className="text-[#0F0032]/50 text-xs mb-3" numberOfLines={2}>
                        {decodeHtml(offer.description)}
                      </Text>
                    )}
                    <View className="flex-row items-center justify-between mt-auto">
                      <Text className="text-[#0F0032]/40 text-xs font-medium">
                        {decodeHtml(offer.businesses?.name ?? "")}
                      </Text>
                      <View className="bg-[#F5F5F7] rounded-full px-2 py-0.5">
                        <Text className="text-[#0F0032]/50 text-xs">
                          {offer.redemption_type.replace(/_/g, " ")}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

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
