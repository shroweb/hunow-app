import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { wordpress, getFeaturedImage, type WPEvent } from "@/lib/wordpress";
import { decodeHtml, stripHtml, parseEventDate } from "@/lib/utils";

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
    <SafeAreaView className="flex-1 bg-[#F5F5F7]">
      <View className="px-5 pt-6 pb-3">
        <Text className="text-[#0F0032] text-2xl font-bold">What's On</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0F0032" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const img = getFeaturedImage(item);
            const date = item.acf?.event_date ? parseEventDate(item.acf.event_date) : null;
            return (
              <View
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 }}
                className="bg-white rounded-2xl overflow-hidden"
              >
                {img && (
                  <Image source={{ uri: img }} className="w-full h-36" resizeMode="cover" />
                )}
                <View className="p-4 flex-row items-start gap-3">
                  {/* Date badge */}
                  <View className="bg-brand-yellow/15 rounded-xl px-3 py-2 items-center min-w-[52px]">
                    {date ? (
                      <>
                        <Text className="text-[#0F0032] font-black text-xl leading-tight">{date.getDate()}</Text>
                        <Text className="text-[#0F0032]/60 text-xs font-semibold uppercase">
                          {date.toLocaleDateString("en-GB", { month: "short" })}
                        </Text>
                      </>
                    ) : (
                      <Ionicons name="calendar-outline" size={20} color="rgba(15,0,50,0.3)" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-[#0F0032] font-bold text-base" numberOfLines={2}>
                      {decodeHtml(item.title.rendered)}
                    </Text>
                    {date && (
                      <Text className="text-[#0F0032]/50 text-xs mt-1">
                        {date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </Text>
                    )}
                    {item.excerpt?.rendered ? (
                      <Text className="text-[#0F0032]/40 text-xs mt-1" numberOfLines={2}>
                        {stripHtml(item.excerpt.rendered)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View className="items-center mt-12">
              <Ionicons name="calendar-outline" size={40} color="rgba(15,0,50,0.15)" />
              <Text className="text-[#0F0032]/30 text-sm mt-3">No upcoming events</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
