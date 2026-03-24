import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { wordpress, type WPEat, type WPEvent } from "@/lib/wordpress";

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

function formatEventDate(ymd: string): string {
  if (!ymd || ymd.length !== 8) return ymd;
  return new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
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

    const [{ data: profile }, wpFeatured, wpEvents, { data: activeOffers }] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", user.id).single(),
      wordpress.getEat({ perPage: 6, orderby: "date", order: "desc" }),
      wordpress.getEvents({ perPage: 5, orderby: "date", order: "asc" }),
      supabase
        .from("offers")
        .select("id, title, description, redemption_type, businesses(name, wp_post_id)")
        .eq("is_active", true)
        .limit(8),
    ]);

    setUserName(profile?.name ?? "");
    setFeatured(wpFeatured.filter((v) => v.acf?.is_featured === "1").slice(0, 4));
    setEvents(wpEvents.slice(0, 3));
    setOffers((activeOffers ?? []) as Offer[]);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  if (loading) {
    return (
      <View className="flex-1 bg-brand-navy items-center justify-center">
        <ActivityIndicator color="#FBC900" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-navy">
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FBC900" />}
      >
        {/* Header */}
        <View className="px-5 pt-6 pb-4">
          <Text className="text-white/60 text-sm">{greeting()}</Text>
          <Text className="text-white text-2xl font-bold">{userName || "Welcome"}</Text>
        </View>

        {/* Active Offers */}
        {offers.length > 0 && (
          <View className="mb-6">
            <View className="px-5 flex-row items-center justify-between mb-3">
              <Text className="text-white font-bold text-lg">Active Offers</Text>
              <Text className="text-brand-yellow text-xs">HU NOW exclusive</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {offers.map((offer) => (
                <TouchableOpacity
                  key={offer.id}
                  className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-2xl p-4 mr-3 w-56"
                  onPress={() => offer.businesses?.wp_post_id
                    ? router.push(`/(customer)/venue/${offer.businesses.wp_post_id}`)
                    : null
                  }
                >
                  <Text className="text-brand-yellow font-bold text-sm mb-1" numberOfLines={2}>{offer.title}</Text>
                  {offer.description && (
                    <Text className="text-white/60 text-xs" numberOfLines={2}>{offer.description}</Text>
                  )}
                  <Text className="text-white/30 text-xs mt-2 font-medium">
                    {offer.businesses?.name ?? ""}
                  </Text>
                  <View className="mt-2 self-start bg-brand-yellow/20 rounded-full px-2 py-0.5">
                    <Text className="text-brand-yellow text-xs">{offer.redemption_type.replace(/_/g, " ")}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Featured Venues */}
        {featured.length > 0 && (
          <View className="mb-6">
            <View className="px-5 flex-row items-center justify-between mb-3">
              <Text className="text-white font-bold text-lg">Featured Venues</Text>
              <TouchableOpacity onPress={() => router.push("/(customer)/venues")}>
                <Text className="text-brand-yellow text-xs">See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {featured.map((venue) => (
                <TouchableOpacity
                  key={venue.id}
                  className="bg-white/10 border border-white/20 rounded-2xl p-4 mr-3 w-48"
                  onPress={() => router.push(`/(customer)/venue/${venue.id}`)}
                >
                  <View className="self-start bg-brand-yellow/20 border border-brand-yellow/30 rounded-full px-2 py-0.5 mb-2">
                    <Text className="text-brand-yellow text-xs font-semibold">Featured</Text>
                  </View>
                  <Text className="text-white font-semibold text-sm" numberOfLines={2}>
                    {venue.title.rendered}
                  </Text>
                  {venue.excerpt?.rendered ? (
                    <Text className="text-white/40 text-xs mt-1" numberOfLines={2}>
                      {venue.excerpt.rendered.replace(/<[^>]+>/g, "")}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Upcoming Events */}
        {events.length > 0 && (
          <View className="mb-8">
            <View className="px-5 flex-row items-center justify-between mb-3">
              <Text className="text-white font-bold text-lg">What's On</Text>
              <TouchableOpacity onPress={() => router.push("/(customer)/events")}>
                <Text className="text-brand-yellow text-xs">See all</Text>
              </TouchableOpacity>
            </View>
            <View className="px-5">
              {events.map((event) => (
                <View key={event.id} className="bg-white/10 border border-white/20 rounded-2xl p-4 mb-3 flex-row items-start">
                  <View className="bg-brand-yellow/20 rounded-xl px-3 py-2 mr-3 items-center min-w-[52px]">
                    {event.acf?.event_date ? (
                      <>
                        <Text className="text-brand-yellow font-bold text-lg leading-tight">
                          {event.acf.event_date.slice(6, 8)}
                        </Text>
                        <Text className="text-brand-yellow/70 text-xs">
                          {new Date(`${event.acf.event_date.slice(0,4)}-${event.acf.event_date.slice(4,6)}-${event.acf.event_date.slice(6,8)}`).toLocaleDateString("en-GB", { month: "short" })}
                        </Text>
                      </>
                    ) : (
                      <Text className="text-brand-yellow text-xs">TBC</Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-sm">{event.title.rendered}</Text>
                    {event.excerpt?.rendered ? (
                      <Text className="text-white/50 text-xs mt-1" numberOfLines={2}>
                        {event.excerpt.rendered.replace(/<[^>]+>/g, "")}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
