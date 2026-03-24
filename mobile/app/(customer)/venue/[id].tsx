import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Image, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { wordpress, getFeaturedImage, extractOffers, type WPEat, type WPOffer } from "@/lib/wordpress";
import { decodeHtml, stripHtml } from "@/lib/utils";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

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
      <View style={{ flex: 1, backgroundColor: NAV, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={YELLOW} />
      </View>
    );
  }

  if (!venue) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NAV, paddingHorizontal: 20 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="chevron-back" size={20} color="white" />
          <Text style={{ color: "white", fontSize: 14, marginLeft: 4 }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, textAlign: "center", marginTop: 80 }}>Venue not found</Text>
      </SafeAreaView>
    );
  }

  const img = getFeaturedImage(venue);
  const ctaUrl = venue.acf?.offer_cta_url as string | undefined;
  const ctaText = venue.acf?.offer_cta_text as string | undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={{ position: "relative" }}>
          {img ? (
            <Image source={{ uri: img }} style={{ width: "100%", height: 240 }} resizeMode="cover" />
          ) : (
            <View style={{ width: "100%", height: 240, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="storefront-outline" size={56} color="rgba(255,255,255,0.12)" />
            </View>
          )}
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              position: "absolute", top: 16, left: 16,
              backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 20,
              width: 36, height: 36, alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={20} color="white" />
          </TouchableOpacity>
          {/* Gradient overlay for readability */}
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, backgroundColor: "rgba(15,0,50,0.5)" }} />
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          {/* Title */}
          <Text style={{ color: "white", fontSize: 26, fontWeight: "900", marginBottom: 6, letterSpacing: -0.5 }}>
            {decodeHtml(venue.title.rendered)}
          </Text>
          {venue.excerpt?.rendered ? (
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
              {stripHtml(venue.excerpt.rendered)}
            </Text>
          ) : null}

          {/* Contact */}
          {(venue.acf?.phone || venue.acf?.website) && (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16,
              marginBottom: 16, gap: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            }}>
              {venue.acf?.phone && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                  onPress={() => Linking.openURL(`tel:${venue.acf!.phone}`)}
                >
                  <View style={{ backgroundColor: YELLOW + "22", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="call-outline" size={18} color={YELLOW} />
                  </View>
                  <Text style={{ color: "white", fontSize: 14, fontWeight: "500" }}>{venue.acf.phone as string}</Text>
                </TouchableOpacity>
              )}
              {venue.acf?.website && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                  onPress={() => Linking.openURL(venue.acf!.website as string)}
                >
                  <View style={{ backgroundColor: YELLOW + "22", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="globe-outline" size={18} color={YELLOW} />
                  </View>
                  <Text style={{ color: "white", fontSize: 14, fontWeight: "500" }} numberOfLines={1}>{venue.acf.website as string}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Opening Hours */}
          {venue.acf?.opening_hours && (venue.acf.opening_hours as any[]).length > 0 && (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16,
              marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            }}>
              <Text style={{ color: "white", fontWeight: "800", fontSize: 14, marginBottom: 12 }}>Opening Hours</Text>
              {(venue.acf.opening_hours as { day: string; hours: string }[]).map((h, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{h.day}</Text>
                  <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>{h.hours}</Text>
                </View>
              ))}
            </View>
          )}

          {/* HU NOW Offers */}
          <View style={{ marginBottom: 32 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: "white", fontWeight: "800", fontSize: 18 }}>HU NOW Offers</Text>
              {offers.length > 0 && (
                <View style={{ backgroundColor: YELLOW + "33", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: YELLOW, fontSize: 12, fontWeight: "700" }}>{offers.length} available</Text>
                </View>
              )}
            </View>

            {offers.length === 0 ? (
              <View style={{
                backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 24, alignItems: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
              }}>
                <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 14 }}>No active offers at this venue</Text>
              </View>
            ) : (
              offers.map((offer) => (
                <View
                  key={offer.index}
                  style={{
                    backgroundColor: "white", borderRadius: 18, overflow: "hidden",
                    marginBottom: 12,
                    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
                  }}
                >
                  <View style={{ backgroundColor: YELLOW, height: 4 }} />
                  <View style={{ padding: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: NAV, fontWeight: "800", fontSize: 15 }}>{decodeHtml(offer.title)}</Text>
                        {offer.description ? (
                          <Text style={{ color: "rgba(15,0,50,0.5)", fontSize: 13, marginTop: 4 }}>{decodeHtml(offer.description)}</Text>
                        ) : null}
                      </View>
                      <View style={{ backgroundColor: YELLOW + "33", borderRadius: 20, width: 38, height: 38, alignItems: "center", justifyContent: "center", marginLeft: 12 }}>
                        <Ionicons name="ticket-outline" size={18} color={NAV} />
                      </View>
                    </View>
                    {ctaText && ctaUrl && (
                      <TouchableOpacity
                        style={{ marginTop: 12, backgroundColor: NAV, borderRadius: 12, paddingVertical: 10, alignItems: "center" }}
                        onPress={() => Linking.openURL(ctaUrl)}
                      >
                        <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>{decodeHtml(ctaText)}</Text>
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
