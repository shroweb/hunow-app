import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { wordpress, type WPEat } from "@/lib/wordpress";
import { supabase } from "@/lib/supabase";

type Offer = {
  id: string;
  title: string;
  description: string | null;
  terms: string | null;
  redemption_type: string;
};

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [venue, setVenue] = useState<WPEat | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const wpVenue = await wordpress.getEatById(Number(id)).catch(() => null);
      setVenue(wpVenue);

      // Load Supabase offers for this venue
      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("wp_post_id", Number(id))
        .single();

      if (biz) {
        const { data } = await supabase
          .from("offers")
          .select("id, title, description, terms, redemption_type")
          .eq("business_id", biz.id)
          .eq("is_active", true);
        setOffers(data ?? []);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 bg-brand-navy items-center justify-center">
        <ActivityIndicator color="#FBC900" />
      </View>
    );
  }

  if (!venue) {
    return (
      <SafeAreaView className="flex-1 bg-brand-navy px-5">
        <TouchableOpacity onPress={() => router.back()} className="mt-6 mb-4">
          <Text className="text-brand-yellow text-sm">← Back</Text>
        </TouchableOpacity>
        <Text className="text-white/50 text-center mt-20">Venue not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-navy">
      <ScrollView className="flex-1 px-5">
        <TouchableOpacity onPress={() => router.back()} className="mt-6 mb-4">
          <Text className="text-brand-yellow text-sm">← Back</Text>
        </TouchableOpacity>

        <Text className="text-white text-2xl font-bold mb-1">
          {venue.title.rendered}
        </Text>

        {venue.acf?.is_featured === "1" && (
          <View className="self-start bg-brand-yellow/20 border border-brand-yellow/40 rounded-full px-3 py-1 mb-4">
            <Text className="text-brand-yellow text-xs font-semibold">Featured</Text>
          </View>
        )}

        {venue.excerpt?.rendered ? (
          <Text className="text-white/60 text-sm mb-6 leading-5">
            {venue.excerpt.rendered.replace(/<[^>]+>/g, "")}
          </Text>
        ) : null}

        {/* Opening Hours */}
        {venue.acf?.opening_hours && venue.acf.opening_hours.length > 0 && (
          <View className="bg-white/10 border border-white/20 rounded-2xl p-4 mb-4">
            <Text className="text-white font-bold mb-3">Opening Hours</Text>
            {venue.acf.opening_hours.map((h, i) => (
              <View key={i} className="flex-row justify-between mb-1">
                <Text className="text-white/60 text-sm">{h.day}</Text>
                <Text className="text-white text-sm font-medium">{h.hours}</Text>
              </View>
            ))}
          </View>
        )}

        {/* HU NOW Offers */}
        <Text className="text-white font-bold text-lg mb-3">HU NOW Offers</Text>
        {offers.length === 0 ? (
          <View className="bg-white/10 border border-white/20 rounded-2xl p-4 mb-6">
            <Text className="text-white/40 text-sm">No active offers at this venue</Text>
          </View>
        ) : (
          offers.map((offer) => (
            <View key={offer.id} className="bg-white/10 border border-brand-yellow/30 rounded-2xl p-4 mb-3">
              <Text className="text-brand-yellow font-bold text-base">{offer.title}</Text>
              {offer.description && (
                <Text className="text-white/70 text-sm mt-1">{offer.description}</Text>
              )}
              {offer.terms && (
                <Text className="text-white/30 text-xs mt-2">{offer.terms}</Text>
              )}
              <View className="mt-2 self-start bg-brand-yellow/10 rounded-full px-2 py-0.5">
                <Text className="text-brand-yellow/70 text-xs">
                  {offer.redemption_type.replace(/_/g, " ")}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
