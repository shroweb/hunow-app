import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Image, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { wordpress, getFeaturedImage, type WPEvent } from "@/lib/wordpress";
import { decodeHtml, stripHtml, parseEventDate } from "@/lib/utils";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<WPEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    wordpress.getEventById(Number(id)).then((data) => {
      setEvent(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: NAV, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={YELLOW} />
      </View>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NAV, paddingHorizontal: 20 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="chevron-back" size={20} color="white" />
          <Text style={{ color: "white", fontSize: 14, marginLeft: 4 }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, textAlign: "center", marginTop: 80 }}>Event not found</Text>
      </SafeAreaView>
    );
  }

  const img = getFeaturedImage(event);
  const startDate = event.acf?.event_date ? parseEventDate(event.acf.event_date) : null;
  const endDate = event.acf?.event_end ? parseEventDate(event.acf.event_end) : null;
  const ticketUrl = event.acf?.ticket_url as string | undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={{ position: "relative" }}>
          {img ? (
            <Image source={{ uri: img }} style={{ width: "100%", height: 280 }} resizeMode="cover" />
          ) : (
            <View style={{ width: "100%", height: 280, backgroundColor: "#1a0052", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="calendar" size={64} color={YELLOW} />
            </View>
          )}
          {/* Back button */}
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
          {/* Dark gradient at bottom of image */}
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 100, backgroundColor: "rgba(15,0,50,0.6)" }} />
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>

          {/* Title */}
          <Text style={{ color: "white", fontSize: 26, fontWeight: "900", marginBottom: 16, letterSpacing: -0.5, lineHeight: 31 }}>
            {decodeHtml(event.title.rendered)}
          </Text>

          {/* Date card */}
          {startDate && (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16,
              marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 16,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            }}>
              <View style={{
                backgroundColor: YELLOW, borderRadius: 14,
                paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", minWidth: 58,
              }}>
                <Text style={{ color: NAV, fontWeight: "900", fontSize: 26, lineHeight: 28 }}>{startDate.getDate()}</Text>
                <Text style={{ color: NAV, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
                  {startDate.toLocaleDateString("en-GB", { month: "short" })}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                  {startDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </Text>
                {endDate && endDate.toDateString() !== startDate.toDateString() && (
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 4 }}>
                    Until {endDate.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Location / Venue */}
          {(event.acf?.venue || event.acf?.location) && (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16,
              marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 14,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            }}>
              <View style={{ backgroundColor: YELLOW + "22", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="location-outline" size={18} color={YELLOW} />
              </View>
              <Text style={{ color: "white", fontSize: 14, fontWeight: "500", flex: 1 }}>
                {(event.acf.venue || event.acf.location) as string}
              </Text>
            </View>
          )}

          {/* Price */}
          {event.acf?.price && (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16,
              marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 14,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            }}>
              <View style={{ backgroundColor: YELLOW + "22", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="ticket-outline" size={18} color={YELLOW} />
              </View>
              <Text style={{ color: "white", fontSize: 14, fontWeight: "500" }}>{event.acf.price as string}</Text>
            </View>
          )}

          {/* Description */}
          {event.excerpt?.rendered && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, lineHeight: 23 }}>
                {stripHtml(event.excerpt.rendered)}
              </Text>
            </View>
          )}

          {/* Ticket CTA */}
          {ticketUrl && (
            <TouchableOpacity
              onPress={() => Linking.openURL(ticketUrl)}
              style={{
                backgroundColor: YELLOW, borderRadius: 18,
                paddingVertical: 16, alignItems: "center",
                marginBottom: 32,
              }}
            >
              <Text style={{ color: NAV, fontWeight: "800", fontSize: 16 }}>Get Tickets</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
