import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { wordpress, getFeaturedImage, type WPEvent } from "@/lib/wordpress";
import { decodeHtml, parseEventDate } from "@/lib/utils";
import { VenueCardSkeleton } from "@/components/VenueCardSkeleton";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

function formatEventMeta(event: WPEvent) {
  const date = event.acf?.event_date ? parseEventDate(event.acf.event_date) : null;
  return {
    date,
    dateLabel: date ? date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "Date TBC",
    timeLabel: date ? date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "Time TBC",
  };
}

export default function EventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<WPEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await wordpress.getEvents({ perPage: 20 }).catch(() => [] as WPEvent[]);
    setEvents(data);
    setLoading(false);
    setRefreshing(false);
  }

  function onRefresh() { setRefreshing(true); load(); }

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aDate = a.acf?.event_date ? parseEventDate(a.acf.event_date)?.getTime() ?? 0 : 0;
      const bDate = b.acf?.event_date ? parseEventDate(b.acf.event_date)?.getTime() ?? 0 : 0;
      return aDate - bDate;
    });
  }, [events]);

  const featured = sortedEvents[0];
  const remaining = sortedEvents.slice(1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 }}>
          <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 }}>What&apos;s On</Text>
          <Text style={{ color: "white", fontSize: 28, fontWeight: "900", letterSpacing: -0.5, marginBottom: 8 }}>Events</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 20 }}>
            Discover what&apos;s happening tonight, this weekend, and across the city.
          </Text>
        </View>

        {loading ? (
          <VenueCardSkeleton count={4} />
        ) : events.length === 0 ? (
          <View style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 22, padding: 28, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Ionicons name="calendar-outline" size={42} color="rgba(255,255,255,0.18)" />
            <Text style={{ color: "white", fontSize: 16, fontWeight: "800", marginTop: 12, marginBottom: 6 }}>No upcoming events</Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", lineHeight: 19 }}>
              New events will appear here as venues publish them.
            </Text>
          </View>
        ) : (
          <>
            {featured && (() => {
              const meta = formatEventMeta(featured);
              const img = getFeaturedImage(featured);
              return (
                <TouchableOpacity
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/(customer)/event/${featured.id}` as any); }}
                  style={{ marginHorizontal: 20, backgroundColor: "white", borderRadius: 24, overflow: "hidden", marginBottom: 26 }}
                >
                  {img ? (
                    <Image source={{ uri: img }} style={{ width: "100%", height: 220 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: "100%", height: 220, backgroundColor: "#14003e", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="calendar" size={38} color={YELLOW} />
                    </View>
                  )}
                  <View style={{ position: "absolute", top: 14, left: 14, backgroundColor: YELLOW, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Text style={{ color: NAV, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Featured Event</Text>
                  </View>
                  <View style={{ padding: 18 }}>
                    <Text style={{ color: NAV, fontWeight: "900", fontSize: 21, lineHeight: 26, marginBottom: 8 }}>{decodeHtml(featured.title.rendered)}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      <View style={{ backgroundColor: YELLOW + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Ionicons name="calendar-outline" size={12} color={NAV} />
                        <Text style={{ color: NAV, fontSize: 11, fontWeight: "700" }}>{meta.dateLabel}</Text>
                      </View>
                      <View style={{ backgroundColor: "rgba(15,0,50,0.08)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Ionicons name="time-outline" size={12} color={NAV} />
                        <Text style={{ color: NAV, fontSize: 11, fontWeight: "700" }}>{meta.timeLabel}</Text>
                      </View>
                    </View>
                    {featured.excerpt?.rendered ? (
                      <Text style={{ color: "rgba(15,0,50,0.58)", fontSize: 13, lineHeight: 19 }} numberOfLines={3}>
                        {decodeHtml(featured.excerpt.rendered.replace(/<[^>]+>/g, ""))}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })()}

            <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
              <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>Coming Up</Text>
            </View>

            <View style={{ paddingHorizontal: 20 }}>
              {remaining.map((event) => {
                const meta = formatEventMeta(event);
                const img = getFeaturedImage(event);
                return (
                  <TouchableOpacity
                    key={event.id}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/(customer)/event/${event.id}` as any); }}
                    style={{ backgroundColor: "rgba(255,255,255,0.98)", borderRadius: 20, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center" }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: 88, height: 88, borderRadius: 14, marginRight: 12 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: 88, height: 88, borderRadius: 14, marginRight: 12, backgroundColor: "rgba(15,0,50,0.08)", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="calendar-outline" size={24} color={NAV} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: NAV, fontSize: 15, fontWeight: "800", marginBottom: 6 }} numberOfLines={2}>
                        {decodeHtml(event.title.rendered)}
                      </Text>
                      <Text style={{ color: "rgba(15,0,50,0.48)", fontSize: 12, marginBottom: 6 }}>
                        {meta.dateLabel} · {meta.timeLabel}
                      </Text>
                      {event.acf?.venue ? (
                        <Text style={{ color: "rgba(15,0,50,0.58)", fontSize: 12 }} numberOfLines={1}>
                          {event.acf.venue as string}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(15,0,50,0.35)" />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
