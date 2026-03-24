import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Image, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { wordpress, getFeaturedImage, extractOffers, type WPEat, type WPOffer } from "@/lib/wordpress";
import { decodeHtml, stripHtml } from "@/lib/utils";

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [venue, setVenue] = useState<WPEat | null>(null);
  const [offers, setOffers] = useState<WPOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const wpVenue = await wordpress.getEatById(Number(id)).catch(() => null);
      setVenue(wpVenue);
      if (wpVenue?.acf) setOffers(extractOffers(wpVenue.acf as Record<string, unknown>));
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 bg-[#F5F5F7] items-center justify-center">
        <ActivityIndicator color="#0F0032" />
      </View>
    );
  }

  if (!venue) {
    return (
      <SafeAreaView className="flex-1 bg-[#F5F5F7] px-5">
        <TouchableOpacity onPress={() => router.back()} className="mt-6 mb-4 flex-row items-center">
          <Ionicons name="chevron-back" size={20} color="#0F0032" />
          <Text className="text-[#0F0032] text-sm ml-1">Back</Text>
        </TouchableOpacity>
        <Text className="text-[#0F0032]/40 text-sm text-center mt-20">Venue not found</Text>
      </SafeAreaView>
    );
  }

  const img = getFeaturedImage(venue);
  const ctaUrl = venue.acf?.offer_cta_url as string | undefined;
  const ctaText = venue.acf?.offer_cta_text as string | undefined;

  return (
    <SafeAreaView className="flex-1 bg-[#F5F5F7]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View className="relative">
          {img ? (
            <Image source={{ uri: img }} className="w-full h-52" resizeMode="cover" />
          ) : (
            <View className="w-full h-52 bg-[#0F0032]/10 items-center justify-center">
              <Ionicons name="storefront-outline" size={48} color="rgba(15,0,50,0.15)" />
            </View>
          )}
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute top-4 left-4 bg-white rounded-full w-9 h-9 items-center justify-center"
            style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 }}
          >
            <Ionicons name="chevron-back" size={20} color="#0F0032" />
          </TouchableOpacity>
        </View>

        <View className="px-5 pt-5">
          {/* Title */}
          <Text className="text-[#0F0032] text-2xl font-bold mb-1">
            {decodeHtml(venue.title.rendered)}
          </Text>
          {venue.excerpt?.rendered ? (
            <Text className="text-[#0F0032]/50 text-sm leading-5 mb-4">
              {stripHtml(venue.excerpt.rendered)}
            </Text>
          ) : null}

          {/* Contact info */}
          {(venue.acf?.phone || venue.acf?.website) && (
            <View className="bg-white rounded-2xl p-4 mb-4 gap-3"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}
            >
              {venue.acf?.phone && (
                <TouchableOpacity
                  className="flex-row items-center gap-3"
                  onPress={() => Linking.openURL(`tel:${venue.acf!.phone}`)}
                >
                  <View className="bg-[#0F0032]/5 rounded-xl w-9 h-9 items-center justify-center">
                    <Ionicons name="call-outline" size={18} color="#0F0032" />
                  </View>
                  <Text className="text-[#0F0032] text-sm font-medium">{venue.acf.phone as string}</Text>
                </TouchableOpacity>
              )}
              {venue.acf?.website && (
                <TouchableOpacity
                  className="flex-row items-center gap-3"
                  onPress={() => Linking.openURL(venue.acf!.website as string)}
                >
                  <View className="bg-[#0F0032]/5 rounded-xl w-9 h-9 items-center justify-center">
                    <Ionicons name="globe-outline" size={18} color="#0F0032" />
                  </View>
                  <Text className="text-[#0F0032] text-sm font-medium" numberOfLines={1}>{venue.acf.website as string}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Opening Hours */}
          {venue.acf?.opening_hours && (venue.acf.opening_hours as any[]).length > 0 && (
            <View className="bg-white rounded-2xl p-4 mb-4"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }}
            >
              <Text className="text-[#0F0032] font-bold mb-3">Opening Hours</Text>
              {(venue.acf.opening_hours as { day: string; hours: string }[]).map((h, i) => (
                <View key={i} className="flex-row justify-between mb-2">
                  <Text className="text-[#0F0032]/50 text-sm">{h.day}</Text>
                  <Text className="text-[#0F0032] text-sm font-medium">{h.hours}</Text>
                </View>
              ))}
            </View>
          )}

          {/* HU NOW Offers */}
          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[#0F0032] font-bold text-lg">HU NOW Offers</Text>
              {offers.length > 0 && (
                <View className="bg-brand-yellow/20 rounded-full px-2 py-0.5">
                  <Text className="text-[#0F0032] text-xs font-semibold">{offers.length} available</Text>
                </View>
              )}
            </View>

            {offers.length === 0 ? (
              <View className="bg-white rounded-2xl p-5 items-center"
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }}
              >
                <Text className="text-[#0F0032]/30 text-sm">No active offers at this venue</Text>
              </View>
            ) : (
              offers.map((offer) => (
                <View
                  key={offer.index}
                  className="bg-white rounded-2xl overflow-hidden mb-3"
                  style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 }}
                >
                  <View className="bg-brand-yellow h-1" />
                  <View className="p-4">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1">
                        <Text className="text-[#0F0032] font-bold text-base">{decodeHtml(offer.title)}</Text>
                        {offer.description ? (
                          <Text className="text-[#0F0032]/50 text-sm mt-1">{decodeHtml(offer.description)}</Text>
                        ) : null}
                      </View>
                      <View className="bg-brand-yellow/20 rounded-full w-9 h-9 items-center justify-center ml-3">
                        <Ionicons name="ticket-outline" size={18} color="#0F0032" />
                      </View>
                    </View>
                    {ctaText && ctaUrl && (
                      <TouchableOpacity
                        className="mt-3 bg-[#0F0032] rounded-xl py-2.5 items-center"
                        onPress={() => Linking.openURL(ctaUrl)}
                      >
                        <Text className="text-white text-sm font-semibold">{decodeHtml(ctaText)}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
