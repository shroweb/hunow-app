import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Image, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { wordpress, getFeaturedImage, type WPEvent } from "@/lib/wordpress";
import { decodeHtml, stripHtml, parseEventDate } from "@/lib/utils";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

export default function EventsScreen() {
  const [events, setEvents] = useState<WPEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    wordpress.getEvents({ perPage: 20 }).then((data) => {
      setEvents(data);
      setLoading(false);
    });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      {/* Yellow header */}
      <View style={{ backgroundColor: YELLOW, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 }}>
        <Text style={{ color: NAV, fontSize: 28, fontWeight: "900", letterSpacing: -0.5 }}>EVENTS</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={YELLOW} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const img = getFeaturedImage(item);
            const date = item.acf?.event_date ? parseEventDate(item.acf.event_date) : null;
            return (
              <View style={{
                backgroundColor: "white", borderRadius: 18, overflow: "hidden",
                shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
              }}>
                {img && (
                  <Image source={{ uri: img }} style={{ width: "100%", height: 160 }} resizeMode="cover" />
                )}
                <View style={{ padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  {/* Date badge */}
                  <View style={{
                    backgroundColor: YELLOW, borderRadius: 12,
                    paddingHorizontal: 12, paddingVertical: 8,
                    alignItems: "center", minWidth: 52,
                  }}>
                    {date ? (
                      <>
                        <Text style={{ color: NAV, fontWeight: "900", fontSize: 22, lineHeight: 24 }}>{date.getDate()}</Text>
                        <Text style={{ color: NAV, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
                          {date.toLocaleDateString("en-GB", { month: "short" })}
                        </Text>
                      </>
                    ) : (
                      <Ionicons name="calendar-outline" size={20} color={NAV} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: NAV, fontWeight: "700", fontSize: 15, marginBottom: 4 }} numberOfLines={2}>
                      {decodeHtml(item.title.rendered)}
                    </Text>
                    {date && (
                      <Text style={{ color: "rgba(15,0,50,0.5)", fontSize: 12 }}>
                        {date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                      </Text>
                    )}
                    {item.excerpt?.rendered ? (
                      <Text style={{ color: "rgba(15,0,50,0.4)", fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                        {stripHtml(item.excerpt.rendered)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
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
